/**
 * Timestamp parsing for the statistics feed.
 *
 * Every rule in the rulebook is defined in UTC — the daily loss counter resets at
 * 00:00 UTC, profitable days are UTC days, and the weekend cutoff is a UTC hour. The
 * feed reports timestamps like "2026-09-07 03:58:00" with no timezone designator, and
 * `new Date()` reads those in the *server's* local timezone. That silently shifted
 * every trade by the deployment's UTC offset, moving trades onto the wrong day and the
 * daily-loss boundary off 00:00 UTC, so the same account could pass or hard breach
 * depending on where the app happened to be running.
 *
 * Zone-less values are therefore read as UTC, which is what the feed means and what
 * the dashboard already displays.
 */
const NAIVE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const EPOCH_NUMBER = /^\d{9,13}$/;

export function parseStatisticsDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Seconds and milliseconds both appear in the wild; anything below ~1973 in
    // milliseconds is far more likely to be a seconds-based epoch.
    const date = new Date(value > 1e11 ? value : value * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (EPOCH_NUMBER.test(raw)) return parseStatisticsDate(Number(raw));

  const normalized = NAIVE_TIMESTAMP.test(raw) ? `${raw.replace(" ", "T")}Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The UTC calendar day (YYYY-MM-DD) a statistics timestamp falls on. */
export function statisticsUtcDay(value: unknown): string | null {
  return parseStatisticsDate(value)?.toISOString().slice(0, 10) ?? null;
}

/**
 * When a statistics trade was opened. recent_trades_duration rows do not always carry
 * a distinct open timestamp, so when it is missing or equals the close time the open is
 * derived as close − duration (same as the news rule), instead of showing the close.
 */
export function statisticsTradeOpenedAt(trade: any): Date | null {
  const closedAt = parseStatisticsDate(trade?.close_time ?? trade?.closed_at ?? trade?.closeTime);
  const openedAt = parseStatisticsDate(trade?.open_time ?? trade?.opened_at ?? trade?.openTime);
  const duration = Number(trade?.duration ?? trade?.duration_seconds);
  if (closedAt && Number.isFinite(duration) && duration > 0 && (!openedAt || openedAt.getTime() === closedAt.getTime())) {
    return new Date(closedAt.getTime() - duration * 1000);
  }
  return openedAt;
}
