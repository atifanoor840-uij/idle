// Shared by the server refresher and the dashboard countdown, so it must not
// import anything server-only.

/** ShowMyTrades is called at most once per account in this window; everything else is served from Supabase. */
export const STATS_REFRESH_MS = 10 * 60 * 1000;

/** After a failed call (e.g. 429) wait this long before trying the endpoint again. */
export const STATS_FAILED_RETRY_MS = 2 * 60 * 1000;

export type StatisticsSyncMeta = {
  lastAttemptAt?: string;
  lastError?: string;
  lastStatusCode?: number;
};

export function getStatisticsSyncMeta(payload: any): StatisticsSyncMeta {
  return (payload && typeof payload === "object" && payload._statsSync) || {};
}

/**
 * When ShowMyTrades last synced the trading account itself (metadata.last_updated).
 * This can be much older than statisticsUpdatedAt, which is only when we fetched it:
 * ShowMyTrades serves pre-computed data that refreshes when the account syncs.
 */
export function getStatisticsDataSyncedAt(payload: any): string | undefined {
  const value = payload?.metadata?.last_updated;
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : undefined;
}

/** "14:07" for today, otherwise "3 Nov, 15:17" — in the viewer's local time. */
export function formatSyncedAt(value: string) {
  const date = new Date(value);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === new Date().toDateString()
    ? time
    : `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
}

function toTime(value?: string) {
  if (!value) return NaN;
  return new Date(value).getTime();
}

/** When the server will next call ShowMyTrades for this account (ms epoch), or null if it has no statistics ID. */
export function getStatisticsNextRefreshAt(account: {
  statisticsUpdatedAt?: string;
  statisticsPayload?: any;
  externalStatisticsId?: string;
}): number | null {
  if (!account.externalStatisticsId) return null;

  const meta = getStatisticsSyncMeta(account.statisticsPayload);
  const lastSuccess = toTime(account.statisticsUpdatedAt);
  const lastAttempt = toTime(meta.lastAttemptAt);

  // A failed attempt is always newer than the last success, so its retry window wins.
  if (meta.lastError && !Number.isNaN(lastAttempt)) {
    return lastAttempt + STATS_FAILED_RETRY_MS;
  }

  if (Number.isNaN(lastSuccess)) return Date.now();
  return lastSuccess + STATS_REFRESH_MS;
}
