import { DBTradingAccount, db } from "@/lib/db";
import { STATS_FAILED_RETRY_MS, STATS_REFRESH_MS, getStatisticsSyncMeta } from "@/lib/statisticsSync";

export const STATISTICS_API_BASE_URL =
  process.env.STATISTICS_API_BASE_URL || "https://showmytrades.com/api/statistics";

// ShowMyTrades allows 10 requests/sec. Space calls out so a burst (admin loading
// every account at once) stays well under it.
const MIN_REQUEST_GAP_MS = 150;

type AccountStatisticsPayload = {
  success?: boolean;
  error?: boolean;
  statusCode?: number;
  statusMessage?: string;
  message?: string;
  url?: string;
  id?: string;
  account_info?: Record<string, any>;
  statistics?: Record<string, any>;
  metadata?: Record<string, any>;
  open_trades?: Record<string, any>;
};

function normalizeStatsId(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  const match = trimmed.match(/\/api\/statistics\/([^/?#]+)/i);
  if (match?.[1]) return decodeURIComponent(match[1]);
  return trimmed.replace(/^\/+|\/+$/g, "");
}

export function getAccountStatisticsId(account: DBTradingAccount) {
  return normalizeStatsId(account.externalStatisticsId || account.statisticsApiId);
}

function getPayloadStatisticsId(payload: AccountStatisticsPayload | undefined) {
  if (!payload) return "";
  return normalizeStatsId(payload.id || payload.url);
}

function statisticsPayloadMatchesAccount(account: DBTradingAccount) {
  const accountStatisticsId = getAccountStatisticsId(account);
  if (!accountStatisticsId) return true;
  const payloadStatisticsId = getPayloadStatisticsId(account.statisticsPayload);
  if (!payloadStatisticsId) return true;
  return payloadStatisticsId === accountStatisticsId;
}

function hasGoodStatistics(account: DBTradingAccount) {
  const payload = account.statisticsPayload;
  return Boolean(
    payload && !payload.error && payload.success !== false && statisticsPayloadMatchesAccount(account),
  );
}

function isStatsStale(account: DBTradingAccount) {
  const now = Date.now();
  const meta = getStatisticsSyncMeta(account.statisticsPayload);

  // Back off after a failure instead of hammering the endpoint on every page load.
  if (meta.lastError && meta.lastAttemptAt && statisticsPayloadMatchesAccount(account)) {
    const lastAttempt = new Date(meta.lastAttemptAt).getTime();
    if (!Number.isNaN(lastAttempt) && now - lastAttempt < STATS_FAILED_RETRY_MS) return false;
    return true;
  }

  if (!account.statisticsUpdatedAt || !hasGoodStatistics(account)) return true;
  const lastUpdated = new Date(account.statisticsUpdatedAt).getTime();
  return Number.isNaN(lastUpdated) || now - lastUpdated >= STATS_REFRESH_MS;
}

let nextRequestSlot = 0;

async function waitForRequestSlot() {
  const now = Date.now();
  const slot = Math.max(now, nextRequestSlot);
  nextRequestSlot = slot + MIN_REQUEST_GAP_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));
}

// Concurrent requests for the same account (two tabs, strict mode, admin + trader)
// share one upstream call.
const inFlightRefreshes = new Map<string, Promise<DBTradingAccount>>();

async function readStatisticsResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as AccountStatisticsPayload;
  } catch {
    return { error: true, message: text };
  }
}

async function persist(account: DBTradingAccount) {
  try {
    return await db.saveAccount(account);
  } catch (error) {
    console.error(`Unable to save statistics for ${account.id}:`, error);
    return account;
  }
}

async function saveFailedAttempt(
  account: DBTradingAccount,
  statisticsId: string,
  payload: AccountStatisticsPayload,
) {
  const syncMeta = {
    lastAttemptAt: new Date().toISOString(),
    lastError: payload.message || payload.statusMessage || "Statistics request failed",
    lastStatusCode: payload.statusCode,
  };

  // Keep the last good snapshot on screen; only record that this attempt failed.
  if (hasGoodStatistics(account)) {
    return persist({
      ...account,
      statisticsPayload: { ...account.statisticsPayload, _statsSync: syncMeta },
    });
  }

  return persist({
    ...account,
    externalStatisticsId: statisticsId,
    statisticsPayload: {
      ...payload,
      id: payload.id || statisticsId,
      url: payload.url || `${STATISTICS_API_BASE_URL}/${statisticsId}`,
      _range4exCompliance: account.statisticsPayload?._range4exCompliance,
      _statsSync: syncMeta,
    },
  });
}

async function fetchAndStoreStatistics(account: DBTradingAccount, statisticsId: string) {
  await waitForRequestSlot();

  let response: Response;
  try {
    response = await fetch(`${STATISTICS_API_BASE_URL}/${encodeURIComponent(statisticsId)}`, {
      cache: "no-store",
    });
  } catch (error: any) {
    console.warn(`Statistics request failed for ${account.id}:`, error);
    return saveFailedAttempt(account, statisticsId, {
      error: true,
      success: false,
      message: error?.message || "Network error",
    });
  }

  const payload = await readStatisticsResponse(response);

  if (!response.ok) {
    console.warn(`Statistics refresh failed for ${account.id}: ${response.status}`);
    return saveFailedAttempt(account, statisticsId, {
      ...payload,
      error: true,
      success: false,
      statusCode: response.status,
      statusMessage: response.statusText,
      url: `${STATISTICS_API_BASE_URL}/${statisticsId}`,
    });
  }

  if (payload.success === false || payload.error) {
    return saveFailedAttempt(account, statisticsId, {
      ...payload,
      error: payload.error ?? true,
      success: false,
      url: `${STATISTICS_API_BASE_URL}/${statisticsId}`,
    });
  }

  const info = payload.account_info || {};
  const accountStats = payload.statistics?.account_stats || {};
  const periodReturns = payload.statistics?.monthly_yearly_performance?.period_returns || {};
  const today = periodReturns.today || {};
  const now = new Date().toISOString();

  return persist({
    ...account,
    externalStatisticsId: statisticsId,
    statisticsPayload: {
      ...payload,
      id: payload.id || statisticsId,
      url: payload.url || `${STATISTICS_API_BASE_URL}/${statisticsId}`,
      _range4exCompliance: account.statisticsPayload?._range4exCompliance,
      _statsSync: { lastAttemptAt: now },
    },
    statisticsUpdatedAt: now,
    balance: Number(info.balance ?? accountStats.balance ?? account.balance),
    equity: Number(info.equity ?? accountStats.equity ?? account.equity),
    todayPl: Number(today.profit ?? account.todayPl),
    totalPl: Number(accountStats.profit ?? info.profit ?? account.totalPl),
  });
}

/** `force` skips the 30 min window and the failure back-off — admin "Refresh now" only. */
export async function refreshAccountStatisticsIfNeeded(
  account: DBTradingAccount,
  { force = false }: { force?: boolean } = {},
) {
  const statisticsId = getAccountStatisticsId(account);
  if (!statisticsId || (!force && !isStatsStale(account))) return account;

  const key = `${account.id}:${statisticsId}`;
  const existing = inFlightRefreshes.get(key);
  if (existing) return existing;

  const refresh = fetchAndStoreStatistics(account, statisticsId).finally(() => {
    inFlightRefreshes.delete(key);
  });
  inFlightRefreshes.set(key, refresh);
  return refresh;
}

export async function refreshAccountsStatistics(accounts: DBTradingAccount[]) {
  return Promise.all(accounts.map((account) => refreshAccountStatisticsIfNeeded(account)));
}
