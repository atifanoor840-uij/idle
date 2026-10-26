import { parseStatisticsDate } from "./statisticsTime";

export const TRADE_LAYERING_WINDOW_MS = 10 * 60 * 1000;
// Instant accounts: most positions (any instrument, any direction) that may be
// open at once. Opening a 3rd concurrent layer fails the account.
export const MAX_CONCURRENT_LAYERS = 2;

export type TradeLayeringViolation = {
  instrument: string;
  direction: "Buy" | "Sell" | "Unknown";
  previousInstrument: string;
  previousDirection: "Buy" | "Sell" | "Unknown";
  previousTradeId: string;
  currentTradeId: string;
  previousOpenedAt: string;
  currentOpenedAt: string;
  elapsedSeconds: number;
};

type NormalizedTrade = {
  id: string;
  instrument: string;
  direction: "Buy" | "Sell" | "Unknown";
  openedAt: Date;
};

function normalizeDirection(value: unknown): "Buy" | "Sell" | "Unknown" {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "buy" || normalized === "long" || normalized === "0") return "Buy";
  if (normalized === "sell" || normalized === "short" || normalized === "1") return "Sell";
  return "Unknown";
}

// Only the open timestamp gates inclusion here — the Standard Rule (below) applies
// across every trade regardless of instrument or direction, so a trade with an
// unparseable symbol/side must still count toward the 10-minute window instead of
// silently dropping out of it.
function normalizeTrade(trade: any, index: number): NormalizedTrade | null {
  const openedAt = parseStatisticsDate(trade?.open_time ?? trade?.opened_at ?? trade?.openTime);
  if (!openedAt) return null;

  return {
    id: String(trade?.ticket ?? trade?.id ?? `trade-${index + 1}`),
    instrument: String(trade?.symbol ?? trade?.instrument ?? "").trim().toUpperCase() || "UNKNOWN",
    direction: normalizeDirection(trade?.type ?? trade?.direction ?? trade?.side),
    openedAt,
  };
}

export function getStatisticsTrades(payload: any): any[] {
  const rows = payload?.statistics?.advanced_statistics?.charts?.recent_trades_duration;
  return Array.isArray(rows) ? rows : [];
}

// Standard Rule: only 1 trade may be opened within a 10-minute window from the
// previous trade's opening time — across every instrument and direction, not just
// matching pairs (Help Center: Trade Layering — "applies to all trades"). Every
// trade is compared to whichever trade opened immediately before it, in open-time
// order, regardless of symbol or side.
export function detectTradeLayering(trades: any[]): TradeLayeringViolation[] {
  const normalized = trades
    .map(normalizeTrade)
    .filter((trade): trade is NormalizedTrade => Boolean(trade))
    .sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());

  const violations: TradeLayeringViolation[] = [];

  for (let i = 1; i < normalized.length; i += 1) {
    const previous = normalized[i - 1];
    const trade = normalized[i];
    const elapsedMs = trade.openedAt.getTime() - previous.openedAt.getTime();
    if (elapsedMs >= 0 && elapsedMs < TRADE_LAYERING_WINDOW_MS) {
      violations.push({
        instrument: trade.instrument,
        direction: trade.direction,
        previousInstrument: previous.instrument,
        previousDirection: previous.direction,
        previousTradeId: previous.id,
        currentTradeId: trade.id,
        previousOpenedAt: previous.openedAt.toISOString(),
        currentOpenedAt: trade.openedAt.toISOString(),
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      });
    }
  }

  return violations;
}

export function flattenOpenTrades(value: any): any[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const directValues = Object.values(value);
  const nested = directValues.flatMap((item) => {
    if (Array.isArray(item)) return item;
    if (item && typeof item === "object" && ("open_time" in item || "opened_at" in item || "openTime" in item)) {
      return [item];
    }
    return [];
  });
  return nested;
}

// Layering is a breach the moment the second trade opens — there is no warning
// step — so still-open positions must be checked too. Reading closed trades alone
// let a layered pair sit undetected (and unbreached) until both were closed. A
// trade can appear in both feeds right after it closes, so dedupe by ticket.
export function detectStatisticsTradeLayering(payload: any) {
  const closed = getStatisticsTrades(payload);
  const closedIds = new Set(
    closed.map((trade) => trade?.ticket ?? trade?.id).filter((id) => id !== undefined && id !== null).map(String),
  );
  const open = flattenOpenTrades(payload?.open_trades).filter((trade) => {
    const id = trade?.ticket ?? trade?.id;
    return id === undefined || id === null || !closedIds.has(String(id));
  });
  return detectTradeLayering([...closed, ...open]);
}

function formatTimestamp(iso: string) {
  return iso.slice(0, 19).replace("T", " ");
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

// Renders the exact violating trades so a failed account can point to what
// triggered it, not just a count.
export function formatTradeLayeringViolations(violations: TradeLayeringViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.instrument} ${violation.direction} opened ${formatTimestamp(violation.currentOpenedAt)} — only ${formatElapsed(violation.elapsedSeconds)} after ${violation.previousInstrument} ${violation.previousDirection} opened ${formatTimestamp(violation.previousOpenedAt)}`,
    )
    .join("; ");
}

type OverlapInterval = {
  key: string;
  id: string;
  instrument: string;
  direction: "Buy" | "Sell" | "Unknown";
  start: number;
  end: number;
  isOpen: boolean;
};

export type ConcurrentLayerTrade = {
  id: string;
  instrument: string;
  direction: "Buy" | "Sell" | "Unknown";
  openedAt: string;
  closedAt: string | null;
};

export type ConcurrentLayeringResult = {
  maxOverlap: number;
  violatingTrades: ConcurrentLayerTrade[];
};

function normalizeForOverlap(trade: any, index: number, isOpen: boolean, nowMs: number): OverlapInterval | null {
  const instrument = String(trade?.symbol ?? trade?.instrument ?? "").trim().toUpperCase() || "UNKNOWN";
  const direction = normalizeDirection(trade?.type ?? trade?.direction ?? trade?.side);
  const openedAt = parseStatisticsDate(trade?.open_time ?? trade?.opened_at ?? trade?.openTime);
  if (!openedAt) return null;

  const closedAt = isOpen ? null : parseStatisticsDate(trade?.close_time ?? trade?.closed_at ?? trade?.closeTime);
  // A closed trade with no close time cannot be bounded, so it cannot prove an overlap.
  if (!isOpen && !closedAt) return null;
  return {
    // Every trade is a layer, whatever its symbol or side (Help Center: Trade
    // Layering — "Applies to all trades and all instruments").
    key: "ALL",
    id: String(trade?.ticket ?? trade?.id ?? `${isOpen ? "open" : "closed"}-${index + 1}`),
    instrument,
    direction,
    start: openedAt.getTime(),
    end: closedAt ? closedAt.getTime() : nowMs,
    isOpen,
  };
}

// Instant's additional layering cap: the maximum number of positions ever held open
// at the same time, regardless of how far apart each was opened (Help Center: Trade
// Layering — Instant accounts: additional cap). Closed trades need a close time to bound their interval; still-open
// positions are bounded by `now`. Also returns the exact trades held open at the
// peak so a breach can name them.
export function getMaxConcurrentLayers(
  closedTrades: any[],
  openTrades: any[] = [],
  now = new Date(),
): ConcurrentLayeringResult {
  const nowMs = now.getTime();
  const closedIntervals = closedTrades
    .map((trade, index) => normalizeForOverlap(trade, index, false, nowMs))
    .filter((interval): interval is OverlapInterval => Boolean(interval));
  // A trade can appear in both feeds right after it closes; count it once.
  const closedIds = new Set(closedIntervals.map((interval) => interval.id));
  const intervals = [
    ...closedIntervals,
    ...openTrades
      .map((trade, index) => normalizeForOverlap(trade, index, true, nowMs))
      .filter((interval): interval is OverlapInterval => Boolean(interval) && !closedIds.has(interval!.id)),
  ];

  const byKey = new Map<string, OverlapInterval[]>();
  for (const interval of intervals) {
    const list = byKey.get(interval.key) || [];
    list.push(interval);
    byKey.set(interval.key, list);
  }

  let maxOverlap = 0;
  let violatingIntervals: OverlapInterval[] = [];

  for (const list of byKey.values()) {
    type OverlapEvent = { time: number; delta: 1 | -1; interval: OverlapInterval };
    const events: OverlapEvent[] = [];
    for (const interval of list) {
      events.push({ time: interval.start, delta: 1, interval });
      events.push({ time: interval.end, delta: -1, interval });
    }
    // Process closes before opens at the same instant so a position that closes
    // exactly when another opens is never counted as overlapping.
    events.sort((a, b) => a.time - b.time || a.delta - b.delta);

    const active = new Map<string, OverlapInterval>();
    for (const event of events) {
      if (event.delta === 1) {
        active.set(event.interval.id, event.interval);
        if (active.size > maxOverlap) {
          maxOverlap = active.size;
          violatingIntervals = Array.from(active.values());
        }
      } else {
        active.delete(event.interval.id);
      }
    }
  }

  return {
    maxOverlap,
    violatingTrades: violatingIntervals.map((interval) => ({
      id: interval.id,
      instrument: interval.instrument,
      direction: interval.direction,
      openedAt: new Date(interval.start).toISOString(),
      closedAt: interval.isOpen ? null : new Date(interval.end).toISOString(),
    })),
  };
}

export function formatConcurrentLayeringTrades(trades: ConcurrentLayerTrade[]): string {
  return trades
    .map(
      (trade) =>
        `${trade.instrument} ${trade.direction} opened ${formatTimestamp(trade.openedAt)}${
          trade.closedAt ? `, closed ${formatTimestamp(trade.closedAt)}` : " (still open)"
        }`,
    )
    .join("; ");
}
