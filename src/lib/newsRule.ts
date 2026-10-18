/**
 * News Trading Rule — pure detection logic (no database, no network).
 *
 * Rule (see rulebook.ts for every tunable number): on Instant and Funded-stage
 * accounts, opening or closing a trade on an instrument exposed to a covered
 * currency within NEWS_RESTRICTED_MINUTES_EACH_SIDE of a high-impact calendar
 * event for that currency is a soft breach. Positions merely held through the
 * window are fine. The violating trade's positive profit is not withdrawable.
 *
 * Kept free of DB imports so it can be unit-tested and reused by the rule engine
 * (accountCompliance.ts), the payout route and the dashboard alike.
 */
import { NEWS_COVERED_CURRENCIES, NEWS_RESTRICTED_IMPACT } from "./rulebook";
import { getStatisticsTrades, flattenOpenTrades } from "./tradeLayering";
import { parseDurationSeconds } from "./accountTradingRules";

export type NewsEvent = {
  id?: string;
  /** UTC ISO timestamp of the release. */
  eventTime: string;
  currency: string;
  title: string;
  impact?: string;
  isRestricted?: boolean;
};

export type NewsTrade = {
  ticket: string;
  symbol: string;
  openTime: Date;
  /** Undefined while the position is still open. */
  closeTime?: Date;
  profit: number;
};

export type NewsViolationType = "opened_in_window" | "closed_in_window";

export type NewsViolation = {
  ticket: string;
  symbol: string;
  eventTitle: string;
  currency: string;
  eventTime: string;
  type: NewsViolationType;
  /** Trade timestamp minus event time; negative = before the release. */
  secondsFromEvent: number;
  profit: number;
};

// ---------------------------------------------------------------------------
// Symbols
// ---------------------------------------------------------------------------

/** ISO codes that can appear on either side of a 6-letter FX pair. */
const FX_CODES = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD",
  "SEK", "NOK", "DKK", "PLN", "HUF", "CZK", "TRY", "ZAR", "MXN", "SGD", "HKD", "CNH", "ILS", "THB",
]);
const METAL_CODES = new Set(["XAU", "XAG", "XPT", "XPD"]);
const CRYPTO_CODES = new Set(["BTC", "ETH", "LTC", "XRP", "SOL", "BCH", "ADA", "DOGE", "DOT", "BNB"]);

/**
 * Non-FX instruments: canonical name, the aliases brokers use for it, and the
 * currencies whose news moves it. Aliases are matched after suffix stripping.
 */
const INSTRUMENT_ALIASES: Array<{ canonical: string; aliases: string[]; currencies: string[] }> = [
  { canonical: "US30", aliases: ["US30", "DJ30", "DOW30", "WS30", "DJI", "USA30", "US30CASH"], currencies: ["USD"] },
  { canonical: "US100", aliases: ["US100", "NAS100", "NASDAQ100", "USTEC", "NDX", "USA100", "NQ100", "US100CASH"], currencies: ["USD"] },
  { canonical: "US500", aliases: ["US500", "SPX500", "SP500", "SPX", "USA500", "US500CASH"], currencies: ["USD"] },
  { canonical: "US2000", aliases: ["US2000", "RUSSELL2000", "RUT"], currencies: ["USD"] },
  { canonical: "USDX", aliases: ["USDX", "DXY", "DOLLARINDEX"], currencies: ["USD"] },
  { canonical: "USOIL", aliases: ["USOIL", "WTI", "XTIUSD", "CRUDEOIL", "OILUSD", "CL"], currencies: ["USD"] },
  { canonical: "UKOIL", aliases: ["UKOIL", "BRENT", "XBRUSD"], currencies: ["USD"] },
  { canonical: "NATGAS", aliases: ["NATGAS", "XNGUSD", "NGAS"], currencies: ["USD"] },
  { canonical: "GER40", aliases: ["GER40", "DE40", "DAX40", "GER30", "DE30", "DAX", "GERMANY40"], currencies: ["EUR"] },
  { canonical: "FRA40", aliases: ["FRA40", "FR40", "CAC40"], currencies: ["EUR"] },
  { canonical: "EU50", aliases: ["EU50", "EUSTX50", "STOXX50", "ESTX50"], currencies: ["EUR"] },
  { canonical: "SPA35", aliases: ["SPA35", "ES35", "IBEX35"], currencies: ["EUR"] },
  { canonical: "UK100", aliases: ["UK100", "FTSE100", "FTSE", "GB100"], currencies: ["GBP"] },
  { canonical: "JP225", aliases: ["JP225", "JPN225", "NIKKEI225", "NIKKEI", "NI225"], currencies: ["JPY"] },
  { canonical: "AUS200", aliases: ["AUS200", "AU200", "ASX200"], currencies: ["AUD"] },
  { canonical: "SWI20", aliases: ["SWI20", "CH20", "SMI20", "SMI"], currencies: ["CHF"] },
  { canonical: "CAN60", aliases: ["CAN60", "CA60", "TSX60"], currencies: ["CAD"] },
];

// Longest alias first so "US30CASH" wins over "US30" and "NASDAQ100" over "NDX".
const ALIAS_LOOKUP = INSTRUMENT_ALIASES.flatMap((entry) =>
  entry.aliases.map((alias) => ({ alias, entry })),
).sort((a, b) => b.alias.length - a.alias.length);

function isSixLetterPair(value: string) {
  if (!/^[A-Z]{6}$/.test(value)) return false;
  const base = value.slice(0, 3);
  const quote = value.slice(3);
  return (FX_CODES.has(base) || METAL_CODES.has(base) || CRYPTO_CODES.has(base)) && FX_CODES.has(quote);
}

/**
 * Strip broker decoration so "EURUSD.r", "EURUSD-ECN", "EURUSD+", "#EURUSD",
 * "XAUUSDm", "EURUSD_i" and "eurusd" all become "EURUSD".
 *
 * 1. Drop leading "#"/".", cut at the first separator (. - _ + ! / space).
 * 2. Upper-case and keep only letters/digits.
 * 3. If a known instrument alias is a prefix (with at most 4 extra chars of
 *    suffix), return its canonical name.
 * 4. If the first 6 letters form a real pair (e.g. XAUUSDM → XAUUSD), keep them.
 */
export function normalizeSymbol(raw: unknown): string {
  let value = String(raw ?? "").trim().replace(/^[#.]+/, "");
  const cut = value.search(/[.\-_+!/\s]/);
  if (cut > 0) value = value.slice(0, cut);
  value = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!value) return "";

  for (const { alias, entry } of ALIAS_LOOKUP) {
    if (value === alias) return entry.canonical;
  }
  for (const { alias, entry } of ALIAS_LOOKUP) {
    // Short aliases like "CL" or "RUT" only match exactly — as a prefix they
    // would swallow unrelated symbols.
    if (alias.length >= 4 && value.startsWith(alias) && value.length - alias.length <= 4) {
      return entry.canonical;
    }
  }

  if (isSixLetterPair(value)) return value;
  // Crypto quoted in USD with a 4-letter base (DOGEUSD).
  const cryptoMatch = value.match(/^([A-Z]{3,4})(USD|USDT)/);
  if (cryptoMatch && CRYPTO_CODES.has(cryptoMatch[1])) return `${cryptoMatch[1]}USD`;
  const head = value.slice(0, 6);
  if (value.length > 6 && isSixLetterPair(head)) return head;
  return value;
}

/** Currencies whose news moves this instrument. Empty = not tied to covered news. */
export function getSymbolCurrencies(raw: unknown): string[] {
  const symbol = normalizeSymbol(raw);
  if (!symbol) return [];

  const alias = INSTRUMENT_ALIASES.find((entry) => entry.canonical === symbol);
  if (alias) return alias.currencies;

  if (/^[A-Z]{6}$/.test(symbol)) {
    const base = symbol.slice(0, 3);
    const quote = symbol.slice(3);
    // Metals and crypto move on the quote currency's news (XAUUSD → USD).
    if (METAL_CODES.has(base) || CRYPTO_CODES.has(base)) return FX_CODES.has(quote) ? [quote] : [];
    if (FX_CODES.has(base) && FX_CODES.has(quote)) return [base, quote];
  }
  const crypto = symbol.match(/^([A-Z]{3,4})USD$/);
  if (crypto && CRYPTO_CODES.has(crypto[1])) return ["USD"];
  return [];
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/**
 * Broker/statistics timestamps → UTC.
 *
 * ShowMyTrades documents every timestamp as "ISO 8601 in UTC, with a trailing Z
 * … never a broker's server time" (showmytrades.com/docs/api/conventions). The
 * older statistics endpoint this app reads can still send zone-less strings like
 * "2026-09-07 03:58:00", which statisticsTime.ts already treats as UTC. So:
 *
 *  - a value that carries a zone ("Z" or "+03:00") is trusted as-is;
 *  - a zone-less value is wall-clock time at `offsetMinutes` east of UTC, so
 *    UTC = wall clock − offset. With the documented UTC feed the offset is 0 and
 *    nothing moves; a broker feed on UTC+3 would pass 180, turning
 *    "12:28:00" into 09:28:00Z.
 *
 * The offset comes from resolveStatisticsUtcOffsetMinutes() below.
 */
const NAIVE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

export function toUtcDate(value: unknown, offsetMinutes = 0): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value > 1e11 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{9,13}$/.test(raw)) return toUtcDate(Number(raw), offsetMinutes);
  if (NAIVE_TIMESTAMP.test(raw)) {
    const wallClock = new Date(`${raw.replace(" ", "T")}Z`);
    if (Number.isNaN(wallClock.getTime())) return null;
    return new Date(wallClock.getTime() - offsetMinutes * 60_000);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Parses "+3", "-4.5", "UTC+03:00", "GMT+2", "+0300" → minutes east of UTC. */
function parseOffset(value: unknown, unit: "hours" | "minutes"): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return unit === "hours" ? Math.round(value * 60) : Math.round(value);
  }
  const text = String(value).trim().toUpperCase().replace(/^(UTC|GMT)/, "");
  if (!text) return 0;
  const clock = text.match(/^([+-])(\d{1,2}):?(\d{2})$/);
  if (clock) return (clock[1] === "-" ? -1 : 1) * (Number(clock[2]) * 60 + Number(clock[3]));
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return null;
  return unit === "hours" ? Math.round(numeric * 60) : Math.round(numeric);
}

/**
 * Offset (minutes east of UTC) that zone-less timestamps in this statistics
 * payload are written in. Looks for an explicit field first, then the
 * STATISTICS_SERVER_UTC_OFFSET_MINUTES env var, and defaults to 0 because the
 * ShowMyTrades feed is documented as UTC.
 */
export function resolveStatisticsUtcOffsetMinutes(payload: any): number {
  const sources = [payload?.account_info, payload?.metadata, payload?.statistics?.account_stats, payload];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const minutes =
      parseOffset(source.utc_offset_minutes, "minutes") ??
      parseOffset(source.server_utc_offset_minutes, "minutes");
    if (minutes !== null) return minutes;
    const hours =
      parseOffset(source.server_utc_offset, "hours") ??
      parseOffset(source.gmt_offset, "hours") ??
      parseOffset(source.utc_offset, "hours") ??
      parseOffset(source.server_timezone, "hours") ??
      parseOffset(source.timezone, "hours");
    if (hours !== null) return hours;
  }
  const env = parseOffset(
    typeof process !== "undefined" ? process.env.STATISTICS_SERVER_UTC_OFFSET_MINUTES : undefined,
    "minutes",
  );
  return env ?? 0;
}

// ---------------------------------------------------------------------------
// Trades from the statistics payload
// ---------------------------------------------------------------------------

function tradeTicket(trade: any, index: number, prefix: string) {
  return String(trade?.ticket ?? trade?.id ?? trade?.position_id ?? `${prefix}-${index + 1}`);
}

/**
 * Closed + open trades from a ShowMyTrades statistics payload, in UTC.
 *
 * recent_trades_duration rows do not always carry a distinct open timestamp
 * (see accountTradingRules.normalizeTrade) but do carry an explicit duration, so
 * when the open time is missing or equals the close time the open is derived as
 * close − duration. Without that a TP hit would also read as an "open" inside
 * the window.
 */
export function extractNewsTrades(payload: any): NewsTrade[] {
  const offset = resolveStatisticsUtcOffsetMinutes(payload);
  const seen = new Set<string>();
  const trades: NewsTrade[] = [];

  getStatisticsTrades(payload).forEach((trade, index) => {
    const ticket = tradeTicket(trade, index, "closed");
    const closeTime = toUtcDate(trade?.close_time ?? trade?.closed_at ?? trade?.closeTime, offset) || undefined;
    let openTime = toUtcDate(trade?.open_time ?? trade?.opened_at ?? trade?.openTime, offset);
    const duration = parseDurationSeconds(trade?.duration ?? trade?.holding_time ?? trade?.duration_seconds);
    if (closeTime && duration && duration > 0 && (!openTime || openTime.getTime() === closeTime.getTime())) {
      openTime = new Date(closeTime.getTime() - duration * 1000);
    }
    if (!openTime || seen.has(ticket)) return;
    seen.add(ticket);
    trades.push({
      ticket,
      symbol: String(trade?.symbol ?? trade?.instrument ?? ""),
      openTime,
      closeTime,
      profit: Number(trade?.net_profit ?? trade?.profit ?? trade?.pnl) || 0,
    });
  });

  flattenOpenTrades(payload?.open_trades).forEach((trade, index) => {
    const ticket = tradeTicket(trade, index, "open");
    const openTime = toUtcDate(trade?.open_time ?? trade?.opened_at ?? trade?.openTime, offset);
    if (!openTime || seen.has(ticket)) return;
    seen.add(ticket);
    trades.push({
      ticket,
      symbol: String(trade?.symbol ?? trade?.instrument ?? ""),
      openTime,
      profit: Number(trade?.profit ?? trade?.floating_profit ?? trade?.pnl) || 0,
    });
  });

  return trades;
}

const COVERED = new Set<string>(NEWS_COVERED_CURRENCIES);

// ---------------------------------------------------------------------------
// Calendar feed (Forex Factory weekly JSON)
// ---------------------------------------------------------------------------

export type CalendarFeedEvent = Required<Pick<NewsEvent, "eventTime" | "currency" | "title" | "impact" | "isRestricted">> & {
  source: string;
};

type FeedItem = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
};

/** Keeps covered high-impact rows and converts their offset time to UTC. */
export function parseCalendarFeed(items: unknown): CalendarFeedEvent[] {
  if (!Array.isArray(items)) return [];
  const rows: CalendarFeedEvent[] = [];
  for (const item of items as FeedItem[]) {
    const currency = String(item?.country || "").toUpperCase();
    if (String(item?.impact || "") !== NEWS_RESTRICTED_IMPACT || !COVERED.has(currency)) continue;
    // "2026-10-02T08:30:00-04:00" carries its own offset; Date resolves it to UTC.
    const at = new Date(String(item?.date || ""));
    const title = String(item?.title || "").trim();
    if (Number.isNaN(at.getTime()) || !title) continue;
    rows.push({
      eventTime: at.toISOString(),
      currency,
      title,
      impact: NEWS_RESTRICTED_IMPACT,
      isRestricted: true,
      source: "forexfactory",
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Pure check. For each trade and each event whose currency the trade's symbol
 * is exposed to: an open or close timestamp within ±windowMinutes (inclusive)
 * of the event is a violation. Still-open trades are checked on open only. A
 * position opened before and closed after the window is not a violation.
 */
export function detectNewsViolations(
  trades: NewsTrade[],
  events: NewsEvent[],
  windowMinutes: number,
): NewsViolation[] {
  const windowMs = windowMinutes * 60_000;
  const parsedEvents = events
    .map((event) => ({ event, at: new Date(event.eventTime).getTime(), currency: event.currency.toUpperCase() }))
    .filter((item) => Number.isFinite(item.at) && COVERED.has(item.currency) && item.event.isRestricted !== false);
  const violations: NewsViolation[] = [];

  for (const trade of trades) {
    const currencies = getSymbolCurrencies(trade.symbol);
    if (currencies.length === 0) continue;
    const symbol = normalizeSymbol(trade.symbol) || trade.symbol;

    for (const { event, at, currency } of parsedEvents) {
      if (!currencies.includes(currency)) continue;
      const checks: Array<[NewsViolationType, Date | undefined]> = [
        ["opened_in_window", trade.openTime],
        ["closed_in_window", trade.closeTime],
      ];
      for (const [type, time] of checks) {
        if (!time) continue;
        const diffMs = time.getTime() - at;
        if (Math.abs(diffMs) > windowMs) continue;
        violations.push({
          ticket: trade.ticket,
          symbol,
          eventTitle: event.title,
          currency,
          eventTime: new Date(at).toISOString(),
          type,
          secondsFromEvent: Math.round(diffMs / 1000),
          profit: trade.profit,
        });
      }
    }
  }

  return violations.sort((a, b) => a.eventTime.localeCompare(b.eventTime) || a.ticket.localeCompare(b.ticket));
}

/**
 * Profit removed from withdrawable profit: each violating trade's positive
 * profit, counted once per trade however many events/timestamps flagged it.
 * Losing trades are not refunded.
 */
export function newsProfitToDeduct(violations: NewsViolation[]): number {
  const byTicket = new Map<string, number>();
  for (const violation of violations) byTicket.set(violation.ticket, violation.profit);
  const total = Array.from(byTicket.values()).reduce((sum, profit) => sum + Math.max(0, profit), 0);
  return Number(total.toFixed(2));
}

export function newsViolationKey(violation: Pick<NewsViolation, "ticket" | "eventTime" | "currency" | "eventTitle" | "type">) {
  return `${violation.ticket}|${violation.eventTime}|${violation.currency}|${violation.eventTitle}|${violation.type}`;
}

// ---------------------------------------------------------------------------
// Persistence inside statisticsPayload._range4exCompliance
//
// The feed only returns recent trades, so a violating trade would drop out of
// the payload (and out of the payout deduction) a few days later. Violations are
// therefore stored the same way minimum-holding violations are.
// ---------------------------------------------------------------------------

export function getStoredNewsViolations(payload: any): NewsViolation[] {
  const stored = payload?._range4exCompliance?.newsViolations;
  return Array.isArray(stored) ? stored.filter((item) => item && item.ticket && item.eventTime) : [];
}

/**
 * Current detections plus stored ones whose trade has left the payload. A
 * stored violation is dropped when its event is no longer restricted (an admin
 * excluded it). `restrictedEventKeys` must come from a successful calendar read.
 */
export function mergeNewsViolations(
  stored: NewsViolation[],
  current: NewsViolation[],
  visibleTickets: Set<string>,
  restrictedEventKeys: Set<string>,
): NewsViolation[] {
  const merged = new Map<string, NewsViolation>();
  for (const violation of stored) {
    if (visibleTickets.has(violation.ticket)) continue; // re-derived from live data below
    const eventKey = `${new Date(violation.eventTime).toISOString()}|${violation.currency}|${violation.eventTitle}`;
    if (!restrictedEventKeys.has(eventKey)) continue;
    merged.set(newsViolationKey(violation), violation);
  }
  for (const violation of current) merged.set(newsViolationKey(violation), violation);
  return Array.from(merged.values()).sort(
    (a, b) => a.eventTime.localeCompare(b.eventTime) || a.ticket.localeCompare(b.ticket),
  );
}

export function newsEventKey(event: Pick<NewsEvent, "eventTime" | "currency" | "title">) {
  return `${new Date(event.eventTime).toISOString()}|${event.currency.toUpperCase()}|${event.title}`;
}

export function storedNewsViolationsChanged(payload: any, next: NewsViolation[]) {
  const stored = getStoredNewsViolations(payload);
  if (stored.length !== next.length) return true;
  const storedKeys = new Set(stored.map((v) => `${newsViolationKey(v)}|${v.profit}`));
  return next.some((v) => !storedKeys.has(`${newsViolationKey(v)}|${v.profit}`));
}

export function withStoredNewsViolations(payload: any, violations: NewsViolation[]) {
  return {
    ...(payload || {}),
    _range4exCompliance: {
      ...(payload?._range4exCompliance || {}),
      newsViolations: violations,
    },
  };
}

export function formatNewsViolation(violation: NewsViolation) {
  const seconds = violation.secondsFromEvent;
  const when = seconds === 0 ? "at the release" : `${Math.abs(seconds)}s ${seconds < 0 ? "before" : "after"}`;
  const action = violation.type === "opened_in_window" ? "opened" : "closed";
  return `${violation.symbol} #${violation.ticket} ${action} ${when} ${violation.currency} "${violation.eventTitle}" (${violation.eventTime.slice(0, 16).replace("T", " ")} UTC)`;
}
