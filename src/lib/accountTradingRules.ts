import { flattenOpenTrades, getStatisticsTrades } from "./tradeLayering";
import { parseStatisticsDate } from "./statisticsTime";
import {
  INACTIVITY_LIMIT_DAYS,
  TICK_SCALPING_MAX_HOLD_SECONDS,
  TICK_SCALPING_TRADE_LIMIT,
  TICK_SCALPING_WINDOW_SECONDS,
} from "./rulebook";

export const MINIMUM_PROFITABLE_DAYS = 3;
export const PROFITABLE_DAY_THRESHOLD_PERCENT = 0.5;
export const MINIMUM_HOLDING_SECONDS = 180;
// No free pass: the first trade closed in under 3 minutes is a hard breach.
export const MINIMUM_HOLDING_RELAXATIONS = 0;
// Bump whenever the violation detector changes. Ids written by an older detector are
// thrown away rather than trusted: v1 measured a hold as `close_time - open_time`, so
// rows with a missing or duplicated open timestamp read as a 0-second hold and were
// permanently recorded as violations even though the trade never broke the rule.
export const MINIMUM_HOLDING_DETECTOR_VERSION = 2;
// Weekend closure per the rulebook: Friday 23:00 UTC to Sunday 23:00 UTC, a fixed
// 48-hour window applied to every instrument, crypto included (Help Center:
// Overnight & Weekend Holding). Expressed as hours after Friday 00:00 UTC.
export const DEFAULT_WEEKEND_CLOSE_UTC_HOUR = 23;
export const WEEKEND_CLOSURE_DURATION_MS = 48 * 60 * 60 * 1000;

type NormalizedTimedTrade = {
  id: string;
  instrument: string;
  openedAt: Date;
  closedAt?: Date;
  durationSeconds?: number;
  profit: number;
};

export type MinimumHoldingViolation = {
  tradeId: string;
  instrument: string;
  openedAt: string;
  closedAt: string;
  durationSeconds: number;
};

export type WeekendHoldingViolation = {
  tradeId: string;
  instrument: string;
  openedAt: string;
  closedAt?: string;
  weekendCloseAt: string;
};

export type OvernightHoldingViolation = {
  tradeId: string;
  instrument: string;
  openedAt: string;
  closedAt?: string;
  /** First 00:00 UTC reset the position was still open through. */
  resetAt: string;
};

export type SingleTradeLossViolation = {
  tradeId: string;
  instrument: string;
  loss: number;
  limit: number;
  status: "open" | "closed";
  openedAt?: string;
  closedAt?: string;
};

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDate(value: unknown) {
  return parseStatisticsDate(value);
}

export function parseDurationSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  const normalized = String(value ?? "").trim();
  if (!normalized) return undefined;
  if (/^\d+(\.\d+)?$/.test(normalized)) return Math.max(0, Number(normalized));

  const clock = normalized.match(/^(\d+):(\d{1,2})(?::(\d{1,2}(?:\.\d+)?))?$/);
  if (clock) {
    if (clock[3] !== undefined) {
      return Number(clock[1]) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    }
    return Number(clock[1]) * 60 + Number(clock[2]);
  }

  const hours = Number(normalized.match(/(\d+(?:\.\d+)?)\s*h/i)?.[1] || 0);
  const minutes = Number(normalized.match(/(\d+(?:\.\d+)?)\s*m/i)?.[1] || 0);
  const seconds = Number(normalized.match(/(\d+(?:\.\d+)?)\s*s/i)?.[1] || 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : undefined;
}

function tradeId(trade: any, index: number) {
  return String(trade?.ticket ?? trade?.id ?? trade?.position_id ?? `trade-${index + 1}`);
}

function normalizeTrade(trade: any, index: number): NormalizedTimedTrade | null {
  const openedAt = parseDate(trade?.open_time ?? trade?.opened_at ?? trade?.openTime);
  if (!openedAt) return null;
  const closedAt = parseDate(trade?.close_time ?? trade?.closed_at ?? trade?.closeTime) || undefined;
  const timestampDuration = closedAt ? (closedAt.getTime() - openedAt.getTime()) / 1000 : undefined;
  const suppliedDuration = parseDurationSeconds(trade?.duration ?? trade?.holding_time ?? trade?.duration_seconds);

  return {
    id: tradeId(trade, index),
    instrument: String(trade?.symbol ?? trade?.instrument ?? "N/A").trim().toUpperCase(),
    openedAt,
    closedAt,
    // The recent_trades_duration rows carry an explicit `duration` in seconds but do
    // not reliably carry a distinct open timestamp, so a close/open delta of 0 used to
    // win over a perfectly good duration and made every trade look like a 0-second
    // hold. Trust the supplied duration first — it is also what the trade table
    // renders, so compliance and the UI can no longer disagree — and only fall back
    // to the timestamp delta when no duration is supplied.
    durationSeconds:
      suppliedDuration !== undefined && suppliedDuration > 0
        ? suppliedDuration
        : timestampDuration !== undefined && timestampDuration > 0
          ? timestampDuration
          : undefined,
    profit: finiteNumber(trade?.net_profit ?? trade?.profit ?? trade?.pnl, 0),
  };
}

export function getOpenStatisticsTrades(payload: any) {
  return flattenOpenTrades(payload?.open_trades);
}

function formatMoney(value: number) {
  return `$${Math.abs(value).toFixed(2)}`;
}

// Single Trade Loss Limit (Instant accounts only): no individual trade may lose
// more than `limitPercent` of the Initial Account Balance. Closed trades are
// checked against their final realized result; still-open trades are checked
// against their current floating (unrealized) loss, since the rule fails the
// account the moment the loss is touched — even if the position is later closed
// at a smaller loss or in profit. Floating loss is only as fresh as the last
// statistics poll, so a spike that recovers between polls can be missed; that
// limitation is shared with every other floating-P&L check in this file.
export function getSingleTradeLossViolations(
  payload: any,
  initialBalance: number,
  limitPercent: number,
): SingleTradeLossViolation[] {
  if (!(initialBalance > 0) || !(limitPercent > 0)) return [];
  const limit = initialBalance * (limitPercent / 100);
  const violations: SingleTradeLossViolation[] = [];

  getStatisticsTrades(payload).forEach((trade, index) => {
    // Gross trade result: the rule is about the position's own floating loss, so
    // commission and swap are not counted toward it.
    const profit = finiteNumber(trade?.profit ?? trade?.net_profit ?? trade?.pnl, 0);
    if (profit >= 0 || -profit <= limit) return;
    violations.push({
      tradeId: tradeId(trade, index),
      instrument: String(trade?.symbol ?? trade?.instrument ?? "N/A").trim().toUpperCase(),
      loss: -profit,
      limit,
      status: "closed",
      openedAt: parseDate(trade?.open_time ?? trade?.opened_at ?? trade?.openTime)?.toISOString(),
      closedAt: parseDate(trade?.close_time ?? trade?.closed_at ?? trade?.closeTime)?.toISOString(),
    });
  });

  getOpenStatisticsTrades(payload).forEach((trade, index) => {
    const profit = finiteNumber(
      trade?.profit ?? trade?.floating_profit ?? trade?.unrealized_profit ?? trade?.pnl,
      0,
    );
    if (profit >= 0 || -profit <= limit) return;
    violations.push({
      tradeId: tradeId(trade, index),
      instrument: String(trade?.symbol ?? trade?.instrument ?? "N/A").trim().toUpperCase(),
      loss: -profit,
      limit,
      status: "open",
      openedAt: parseDate(trade?.open_time ?? trade?.opened_at ?? trade?.openTime)?.toISOString(),
    });
  });

  return violations;
}

export function formatSingleTradeLossViolations(violations: SingleTradeLossViolation[]): string {
  return violations
    .map((violation) => {
      const state = violation.status === "open" ? "still open, floating loss" : "closed, realized loss";
      return `${violation.instrument} (${violation.tradeId}) ${state} ${formatMoney(violation.loss)} against a ${formatMoney(violation.limit)} limit`;
    })
    .join("; ");
}

function normalizedClosedTrades(payload: any) {
  return getStatisticsTrades(payload)
    .map(normalizeTrade)
    .filter((trade): trade is NormalizedTimedTrade => Boolean(trade?.closedAt));
}

export function getMinimumHoldingViolations(payload: any): MinimumHoldingViolation[] {
  const seen = new Set<string>();
  return normalizedClosedTrades(payload).flatMap((trade) => {
    if (
      seen.has(trade.id) ||
      trade.durationSeconds === undefined ||
      trade.durationSeconds >= MINIMUM_HOLDING_SECONDS
    ) {
      return [];
    }
    seen.add(trade.id);
    return [{
      tradeId: trade.id,
      instrument: trade.instrument,
      openedAt: trade.openedAt.toISOString(),
      closedAt: trade.closedAt!.toISOString(),
      durationSeconds: Math.floor(trade.durationSeconds),
    }];
  });
}

export function getStoredMinimumHoldingViolationIds(payload: any): string[] {
  const compliance = payload?._range4exCompliance;
  if (Number(compliance?.minimumHoldingDetectorVersion) !== MINIMUM_HOLDING_DETECTOR_VERSION) return [];
  const ids = compliance?.minimumHoldingViolationTradeIds;
  return Array.isArray(ids) ? ids.map(String) : [];
}

export function getAllMinimumHoldingViolationIds(payload: any) {
  const currentIds = new Set(getMinimumHoldingViolations(payload).map((violation) => violation.tradeId));
  const visibleIds = new Set(getStatisticsTrades(payload).map(tradeId));
  // Stored ids are kept so violations that have already rolled out of the "recent
  // trades" window still count against the account. A stored id whose trade is still
  // in the payload is re-checked instead: if it no longer measures under the limit it
  // was a bad reading, and keeping it would breach the account permanently.
  const retainedStored = getStoredMinimumHoldingViolationIds(payload).filter(
    (id) => currentIds.has(id) || !visibleIds.has(id),
  );
  return Array.from(new Set([...retainedStored, ...currentIds]));
}

export type StoredBreachReason = {
  id: string;
  title: string;
  message: string;
  recordedAt: string;
};

// The reason an account was failed is recorded at the moment it fails, because the
// live rule evaluation can stop reporting it later — statistics get corrected, a
// reading turns out to be wrong, or an admin fails the account by hand. Without this
// the breach banner silently degrades to a generic "violated a hard account rule".
export function getStoredBreachReason(payload: any): StoredBreachReason | null {
  const reason = payload?._range4exCompliance?.breachReason;
  if (!reason || typeof reason !== "object") return null;
  const title = String(reason.title ?? "").trim();
  const message = String(reason.message ?? "").trim();
  if (!title || !message) return null;
  return {
    id: String(reason.id || "recorded-breach-reason"),
    title,
    message,
    recordedAt: String(reason.recordedAt || ""),
  };
}

export function withStoredBreachReason(payload: any, reason: Omit<StoredBreachReason, "recordedAt"> | null) {
  return {
    ...(payload || {}),
    _range4exCompliance: {
      ...(payload?._range4exCompliance || {}),
      breachReason: reason ? { ...reason, recordedAt: new Date().toISOString() } : undefined,
    },
  };
}

export function storedMinimumHoldingViolationsChanged(payload: any, tradeIds: string[]) {
  const compliance = payload?._range4exCompliance;
  // Ids left behind by an older detector still need one write to clear them out.
  if (compliance && Number(compliance.minimumHoldingDetectorVersion) !== MINIMUM_HOLDING_DETECTOR_VERSION) {
    return true;
  }
  const stored = getStoredMinimumHoldingViolationIds(payload);
  if (stored.length !== tradeIds.length) return true;
  const next = new Set(tradeIds);
  return stored.some((id) => !next.has(id));
}

export function withStoredMinimumHoldingViolations(payload: any, tradeIds: string[]) {
  return {
    ...(payload || {}),
    _range4exCompliance: {
      ...(payload?._range4exCompliance || {}),
      minimumHoldingDetectorVersion: MINIMUM_HOLDING_DETECTOR_VERSION,
      minimumHoldingViolationTradeIds: Array.from(new Set(tradeIds)),
    },
  };
}

function dayProfitFromRow(row: any) {
  const direct = row?.daily_profit ?? row?.net_profit ?? row?.profit ?? row?.pnl ?? row?.net_pnl;
  const parsed = Number(direct);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Net profit per UTC day, keyed by YYYY-MM-DD. Prefers the feed's daily
 * performance rows and falls back to summing closed trades. Today is left out
 * while positions are still open, because its result is not final yet.
 */
export function getDailyNetProfits(payload: any, since?: string | null): Map<string, number> {
  const all = getAllDailyNetProfits(payload);
  // Winning Days restart in each new trading cycle after a withdrawal: only days
  // after the cycle start count.
  const sinceDay = since ? String(since).slice(0, 10) : "";
  if (!sinceDay) return all;
  return new Map(Array.from(all.entries()).filter(([date]) => date > sinceDay || !/^\d{4}-\d{2}-\d{2}$/.test(date)));
}

function getAllDailyNetProfits(payload: any): Map<string, number> {
  const rows = payload?.statistics?.equity_curve?.daily_performance;
  const openTrades = getOpenStatisticsTrades(payload);
  const today = new Date().toISOString().slice(0, 10);
  const dailyResults = new Map<string, number>();

  // Rows whose profit field we cannot read are not "zero profit days" — they are no
  // data at all. Counting them as zero drives the profitable-day total to 0, which can
  // turn a legitimate profit target into an early-target hard breach, so fall through
  // to the trade-derived figures instead.
  const rowsCarryProfitData =
    Array.isArray(rows) &&
    rows.some(
      (row: any) =>
        dayProfitFromRow(row) !== undefined ||
        Number.isFinite(Number(row?.cumulative_profit ?? row?.cumulative_pnl)),
    );

  if (Array.isArray(rows) && rows.length > 0 && rowsCarryProfitData) {
    const sorted = [...rows].sort((a, b) => String(a?.date ?? "").localeCompare(String(b?.date ?? "")));
    let previousCumulative = 0;
    for (const [index, row] of sorted.entries()) {
      const date = String(row?.date ?? `day-${index + 1}`).slice(0, 10);
      const direct = dayProfitFromRow(row);
      const cumulative = Number(row?.cumulative_profit ?? row?.cumulative_pnl);
      const profit = direct !== undefined
        ? direct
        : Number.isFinite(cumulative)
          ? cumulative - previousCumulative
          : 0;
      if (Number.isFinite(cumulative)) previousCumulative = cumulative;
      if (date === today && openTrades.length > 0) continue;
      dailyResults.set(date, (dailyResults.get(date) || 0) + profit);
    }
  } else {
    for (const trade of normalizedClosedTrades(payload)) {
      const date = trade.closedAt!.toISOString().slice(0, 10);
      dailyResults.set(date, (dailyResults.get(date) || 0) + trade.profit);
    }
  }

  return dailyResults;
}

export type ProfitConsistency = {
  /** Sum of every day's net result; the rule only applies while this is positive. */
  totalProfit: number;
  bestDay: { date: string; profit: number } | null;
  /** Best day as a percent of total profit; 0 when there is no net profit yet. */
  ratioPercent: number;
};

/** Best single trading day measured against total net profit (consistency rule). */
export function getProfitConsistency(payload: any, since?: string | null): ProfitConsistency {
  const days = Array.from(getDailyNetProfits(payload, since).entries());
  const totalProfit = Number(days.reduce((sum, [, profit]) => sum + profit, 0).toFixed(2));
  let bestDay: ProfitConsistency["bestDay"] = null;
  for (const [date, profit] of days) {
    if (profit > 0 && (!bestDay || profit > bestDay.profit)) bestDay = { date, profit };
  }
  const ratioPercent =
    totalProfit > 0 && bestDay ? Number(((bestDay.profit / totalProfit) * 100).toFixed(2)) : 0;
  return { totalProfit, bestDay, ratioPercent };
}

// Winning Days: separate UTC days whose profit reached at least 0.5% of the Initial
// Account Balance. `since` restricts the count to the current trading cycle.
export function calculateProfitableTradingDays(payload: any, initialBalance: number, since?: string | null) {
  const threshold = Number((Math.max(0, initialBalance) * (PROFITABLE_DAY_THRESHOLD_PERCENT / 100)).toFixed(2));
  const dailyResults = getDailyNetProfits(payload, since);

  const qualifyingDays = Array.from(dailyResults.entries())
    .filter(([, profit]) => profit >= threshold)
    .map(([date, profit]) => ({ date, profit }));

  return {
    requiredDays: MINIMUM_PROFITABLE_DAYS,
    threshold,
    qualifyingDays,
    count: qualifyingDays.length,
  };
}

// A Trading Day is any UTC calendar day on which at least one position was closed
// (a trade opened and closed). Every Profitable Day is also a Trading Day, so the
// Profitable Days already counted are a subset of this set.
export function calculateTradingDays(payload: any) {
  const days = new Set<string>();

  const rows = payload?.statistics?.equity_curve?.daily_performance;
  if (Array.isArray(rows) && rows.length > 0) {
    for (const [index, row] of rows.entries()) {
      const hasActivity =
        Number(row?.trades ?? row?.total_trades ?? row?.closed_trades ?? row?.deals) > 0 ||
        dayProfitFromRow(row) !== undefined;
      if (!hasActivity) continue;
      days.add(String(row?.date ?? `day-${index + 1}`).slice(0, 10));
    }
  }

  for (const trade of normalizedClosedTrades(payload)) {
    days.add(trade.closedAt!.toISOString().slice(0, 10));
  }

  return { count: days.size, days: Array.from(days).sort() };
}

export type TickScalpingViolation = {
  windowStart: string;
  windowEnd: string;
  tradeIds: string[];
};

// Closing 3+ trades that were each held under 10 seconds inside any rolling
// 1-hour window is an immediate hard breach (Help Center: Prohibited Trading
// Practices — Tick Scalping).
export function getTickScalpingViolations(payload: any): TickScalpingViolation[] {
  const shortTrades = normalizedClosedTrades(payload)
    .filter(
      (trade) =>
        trade.durationSeconds !== undefined &&
        trade.durationSeconds < TICK_SCALPING_MAX_HOLD_SECONDS,
    )
    .sort((a, b) => a.closedAt!.getTime() - b.closedAt!.getTime());

  const violations: TickScalpingViolation[] = [];
  const windowMs = TICK_SCALPING_WINDOW_SECONDS * 1000;
  let start = 0;
  for (let end = 0; end < shortTrades.length; end += 1) {
    while (shortTrades[end].closedAt!.getTime() - shortTrades[start].closedAt!.getTime() > windowMs) {
      start += 1;
    }
    if (end - start + 1 >= TICK_SCALPING_TRADE_LIMIT) {
      violations.push({
        windowStart: shortTrades[start].closedAt!.toISOString(),
        windowEnd: shortTrades[end].closedAt!.toISOString(),
        tradeIds: shortTrades.slice(start, end + 1).map((trade) => trade.id),
      });
      break;
    }
  }
  return violations;
}

/** Most recent executed trade (an open or a close), or null when nothing has traded. */
export function getLastTradeActivity(payload: any): Date | null {
  const closed = normalizedClosedTrades(payload);
  const open = getOpenStatisticsTrades(payload)
    .map(normalizeTrade)
    .filter((trade): trade is NormalizedTimedTrade => Boolean(trade));
  const timestamps = [...closed, ...open].flatMap((trade) =>
    trade.closedAt ? [trade.openedAt.getTime(), trade.closedAt.getTime()] : [trade.openedAt.getTime()],
  );
  return timestamps.length ? new Date(Math.max(...timestamps)) : null;
}

// At least one trade must be executed every 30 consecutive calendar days, counted
// from the last executed trade (Help Center: Is there an inactivity rule?). An
// account that has never traded counts from `anchor` (its delivery date).
export function getInactivityBreach(payload: any, now = new Date(), anchor?: string | null) {
  const anchorDate = anchor ? parseDate(anchor) : null;
  if (!getLastTradeActivity(payload) && anchorDate) {
    const daysSince = Math.floor((now.getTime() - anchorDate.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince < INACTIVITY_LIMIT_DAYS) return null;
    return { lastActivityAt: anchorDate.toISOString(), daysSinceLastTrade: daysSince };
  }
  return getInactivityBreachFromTrades(payload, now);
}

function getInactivityBreachFromTrades(payload: any, now: Date) {
  const closed = normalizedClosedTrades(payload);
  const open = getOpenStatisticsTrades(payload)
    .map(normalizeTrade)
    .filter((trade): trade is NormalizedTimedTrade => Boolean(trade));

  const timestamps = [...closed, ...open].flatMap((trade) => {
    const values = [trade.openedAt.getTime()];
    if (trade.closedAt) values.push(trade.closedAt.getTime());
    return values;
  });
  if (timestamps.length === 0) return null;

  const lastActivityMs = Math.max(...timestamps);
  const daysSince = Math.floor((now.getTime() - lastActivityMs) / (24 * 60 * 60 * 1000));
  if (daysSince < INACTIVITY_LIMIT_DAYS) return null;

  return {
    lastActivityAt: new Date(lastActivityMs).toISOString(),
    daysSinceLastTrade: daysSince,
  };
}

const WEEKEND_START_UTC_DAY = 5; // Friday

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// The most recent weekend closure's start (Friday 00:00 UTC + `closeUtcHour`
// hours) at or before `at`. Used with WEEKEND_CLOSURE_DURATION_MS to test whether
// any given instant falls inside the closure window, regardless of which day `at`
// itself falls on. Hours are added in milliseconds so 24 cleanly means Saturday 00:00.
function mostRecentWeekendStartAtOrBefore(at: Date, closeUtcHour: number) {
  const dayStart = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  const daysSinceFriday = (at.getUTCDay() - WEEKEND_START_UTC_DAY + 7) % 7;
  let start = dayStart - daysSinceFriday * DAY_MS + closeUtcHour * HOUR_MS;
  if (start > at.getTime()) start -= 7 * DAY_MS;
  return new Date(start);
}

export function getWeekendHoldingViolations(
  payload: any,
  now = new Date(),
  closeUtcHour = DEFAULT_WEEKEND_CLOSE_UTC_HOUR,
): WeekendHoldingViolation[] {
  const closed = normalizedClosedTrades(payload);
  const open = getOpenStatisticsTrades(payload)
    .map(normalizeTrade)
    .filter((trade): trade is NormalizedTimedTrade => Boolean(trade));
  const seen = new Set<string>();

  return [...closed, ...open].flatMap((trade) => {
    if (seen.has(trade.id)) return [];
    seen.add(trade.id);
    const end = trade.closedAt || now;
    // Anchor the closure window off the trade's END, not its open time. A trade
    // opened before Friday close and still open past it, AND a trade opened and
    // closed entirely inside the weekend (e.g. a 24/7 crypto position opened on
    // Saturday), both land in the same weekend window this way — the earlier
    // version only anchored off the open time and never flagged the second case.
    const weekendStart = mostRecentWeekendStartAtOrBefore(end, closeUtcHour);
    const weekendEnd = new Date(weekendStart.getTime() + WEEKEND_CLOSURE_DURATION_MS);
    const overlapsWeekend = trade.openedAt.getTime() < weekendEnd.getTime() && end.getTime() > weekendStart.getTime();
    if (!overlapsWeekend) return [];

    return [{
      tradeId: trade.id,
      instrument: trade.instrument,
      openedAt: trade.openedAt.toISOString(),
      closedAt: trade.closedAt?.toISOString(),
      weekendCloseAt: weekendStart.toISOString(),
    }];
  });
}

// Overnight holding (1-Step, 2-Step and Instant): every trade must open and close
// inside the same UTC day, so no position may stay open through a 00:00 UTC reset.
// With the Weekend Holding add-on, the resets that fall inside the weekend closure
// (Saturday, Sunday and the Monday reset that ends it) are not counted, so a
// position held from Friday into the next week is not an overnight violation.
export function getOvernightHoldingViolations(
  payload: any,
  options: { weekendHoldingAddon?: boolean } = {},
  now = new Date(),
): OvernightHoldingViolation[] {
  const closed = normalizedClosedTrades(payload);
  const open = getOpenStatisticsTrades(payload)
    .map(normalizeTrade)
    .filter((trade): trade is NormalizedTimedTrade => Boolean(trade));
  const seen = new Set<string>();

  return [...closed, ...open].flatMap((trade) => {
    if (seen.has(trade.id)) return [];
    seen.add(trade.id);
    const end = (trade.closedAt || now).getTime();
    const openedDay = Date.UTC(
      trade.openedAt.getUTCFullYear(),
      trade.openedAt.getUTCMonth(),
      trade.openedAt.getUTCDate(),
    );
    // A position closed exactly at 00:00:00 closed on the old day, so a reset only
    // counts once the position is still open after it.
    for (let reset = openedDay + DAY_MS; reset < end; reset += DAY_MS) {
      const weekday = new Date(reset).getUTCDay(); // 6 = Sat, 0 = Sun, 1 = Mon
      if (options.weekendHoldingAddon && (weekday === 6 || weekday === 0 || weekday === 1)) continue;
      return [{
        tradeId: trade.id,
        instrument: trade.instrument,
        openedAt: trade.openedAt.toISOString(),
        closedAt: trade.closedAt?.toISOString(),
        resetAt: new Date(reset).toISOString(),
      }];
    }
    return [];
  });
}

// Flex Maximum Loss trails the highest CLOSED balance (floating profit never raises
// it). The feed's daily rows carry the closed balance per day; the live balance is
// the latest closed balance.
export function getPeakClosedBalance(payload: any, initialBalance: number, currentBalance: number) {
  const rows = payload?.statistics?.equity_curve?.daily_performance;
  let peak = Math.max(initialBalance, Number.isFinite(currentBalance) ? currentBalance : initialBalance);
  if (Array.isArray(rows)) {
    for (const row of rows) {
      const balance = Number(row?.cumulative_balance ?? row?.balance);
      if (Number.isFinite(balance) && balance > peak) peak = balance;
    }
  }
  return peak;
}

