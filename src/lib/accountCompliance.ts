import { DBChallengePlan, DBNotification, DBOrder, DBTradingAccount, db } from "@/lib/db";
import { calculateDrawdownSnapshot, exceedsDrawdownLimit } from "@/lib/drawdown";
import {
  getChallengeRule,
  getDrawdownLimits,
  getMinimumTradingDays,
  getPhaseTargetPercent,
  newsRuleApplies,
  requiresQualifyingTradingDays,
  resolveRuleVersion,
  FUNDED_MIN_PROFITABLE_DAYS,
  FUNDED_MIN_QUALIFYING_DAYS,
  INACTIVITY_LIMIT_DAYS,
  LEGACY_PROFIT_CONSISTENCY_PERCENT,
  LEVERAGE_LIMIT,
  SINGLE_TRADE_LOSS_LIMIT_PERCENT,
  NEWS_RESTRICTED_MINUTES_EACH_SIDE,
  TICK_SCALPING_MAX_HOLD_SECONDS,
  TICK_SCALPING_TRADE_LIMIT,
} from "@/lib/rulebook";
import { getOrderStatusForPhase, getStageAccountStatus } from "@/lib/challengeStages";
import {
  detectStatisticsTradeLayering,
  formatConcurrentLayeringTrades,
  formatTradeLayeringViolations,
  getMaxConcurrentLayers,
  getStatisticsTrades,
  MAX_CONCURRENT_LAYERS,
} from "@/lib/tradeLayering";
import {
  calculateProfitableTradingDays,
  calculateTradingDays,
  formatSingleTradeLossViolations,
  getAllMinimumHoldingViolationIds,
  getOpenStatisticsTrades,
  getSingleTradeLossViolations,
  storedMinimumHoldingViolationsChanged,
  getStoredBreachReason,
  withStoredBreachReason,
  getWeekendHoldingViolations,
  getTickScalpingViolations,
  getInactivityBreach,
  getProfitConsistency,
  MINIMUM_HOLDING_RELAXATIONS,
  withStoredMinimumHoldingViolations,
} from "@/lib/accountTradingRules";
import { getTodayClosedLoss } from "@/lib/tradingStatistics";
import {
  detectNewsViolations,
  extractNewsTrades,
  formatNewsViolation,
  getStoredNewsViolations,
  mergeNewsViolations,
  newsEventKey,
  newsProfitToDeduct,
  storedNewsViolationsChanged,
  withStoredNewsViolations,
  type NewsEvent,
  type NewsViolation,
} from "@/lib/newsRule";
import { getRestrictedEvents } from "@/lib/newsCalendar";

export type RuleCheckStatus = "passed" | "pending" | "warning" | "failed";

export type AccountRuleCheck = {
  id: string;
  label: string;
  status: RuleCheckStatus;
  info: string;
};

export type AccountRuleAlert = {
  id: string;
  title: string;
  message: string;
  type: "warning" | "error" | "success" | "info";
};

type AccountRuleContext = {
  order?: DBOrder;
  plan?: DBChallengePlan;
  /**
   * Restricted high-impact events covering this account's trades. `null` means
   * the calendar could not be read: stored violations are kept as they are and
   * nothing new is detected. Omitted = news not evaluated in this call.
   */
  newsEvents?: NewsEvent[] | null;
};

type AccountRuleEvaluation = {
  accountType: string;
  size: number;
  target: number;
  dailyLossLimit: number;
  maxDrawdown: number;
  currentDailyLoss: number;
  currentMaxDrawdown: number;
  minTradingDays: number;
  currentTradingDays: number;
  legacyRules: boolean;
  /** News Trading Rule soft breaches (stored + current), one row per trade/event/timestamp. */
  newsViolations: NewsViolation[];
  /** Positive profit of news-violating trades, each trade once — not withdrawable. */
  newsProfitToDeduct: number;
  ruleChecks: AccountRuleCheck[];
  ruleAlerts: AccountRuleAlert[];
  recommendedStatus?: DBTradingAccount["status"];
};

function asNumber(value: any, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: number) {
  return `$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function resolveRuleName(context: AccountRuleContext, account: DBTradingAccount) {
  return context.plan?.name || context.order?.planId || account.phase || "";
}

function resolveInitialBalance(account: DBTradingAccount, context: AccountRuleContext, targetPercent: number) {
  const statisticsInitialBalance = asNumber(
    account.statisticsPayload?.account_info?.initial_balance ??
      account.statisticsPayload?.statistics?.account_stats?.initial_balance,
    0,
  );
  const targetImpliedBalance =
    targetPercent > 0 && asNumber(account.profitTarget, 0) > 0
      ? asNumber(account.profitTarget, 0) / (targetPercent / 100)
      : 0;
  const profitImpliedBalance = asNumber(account.balance, 0) - asNumber(account.totalPl, 0);
  const candidates = [
    asNumber(context.plan?.size, 0),
    statisticsInitialBalance,
    targetImpliedBalance,
    profitImpliedBalance,
    asNumber(account.balance, 0),
  ];
  return candidates.find((value) => Number.isFinite(value) && value > 0) || 0;
}

// Only used to render limits for an account whose real size is unknown. It is never
// allowed to decide a breach — see accountSizeKnown below.
const PLACEHOLDER_ACCOUNT_SIZE = 100000;

export function evaluateAccountRules(account: DBTradingAccount, context: AccountRuleContext = {}): AccountRuleEvaluation {
  // Orders an admin has pinned to "legacy" keep the pre-2026-09 rulebook, and the
  // rules added in that update are not applied to their accounts.
  const ruleVersion = resolveRuleVersion(context.order);
  const legacyRules = ruleVersion === "legacy";
  const newRulesEnforced = !legacyRules;
  const rule = getChallengeRule(resolveRuleName(context, account), ruleVersion);
  const targetPercent = getPhaseTargetPercent(rule, account.phase, account.status);
  const resolvedSize = resolveInitialBalance(account, context, targetPercent);
  // A size that resolved from nothing is a guess. It still drives the displayed limits
  // so the dashboard has numbers to show, but measuring a real balance against a
  // fabricated $100k size reads as a near-total loss and would fail the account
  // outright, so it must never decide a breach.
  const accountSizeKnown = resolvedSize > 0;
  const size = accountSizeKnown ? resolvedSize : PLACEHOLDER_ACCOUNT_SIZE;
  const drawdownLimits = getDrawdownLimits(rule, account.phase, account.status, ruleVersion);
  const target = size * (targetPercent / 100);
  const dailyLossLimit = size * (drawdownLimits.dailyDrawdownPercent / 100);
  const maxDrawdown = size * (drawdownLimits.overallDrawdownPercent / 100);
  const todayPl = asNumber(account.todayPl, 0);
  const todayClosedLoss = getTodayClosedLoss(account.statisticsPayload, todayPl);
  const drawdownSnapshot = calculateDrawdownSnapshot({
    initialBalance: size,
    balance: asNumber(account.balance, size),
    equity: asNumber(account.equity, account.balance),
    todayClosedPl: -todayClosedLoss,
  });
  const currentDailyLoss = drawdownSnapshot.currentDailyLoss;
  const currentMaxDrawdown = drawdownSnapshot.currentOverallLoss;
  const minTradingDays = getMinimumTradingDays(rule, account.phase, account.status);
  const profitableDays = calculateProfitableTradingDays(account.statisticsPayload, size);
  const currentTradingDays = profitableDays.count;
  // Instant and every Funded stage also need 5 qualifying days in total — 3
  // Profitable Days plus 2 more that can be plain Trading Days.
  const qualifyingDaysApply = requiresQualifyingTradingDays(rule, account.phase, account.status, ruleVersion);
  const tradingDays = calculateTradingDays(account.statisticsPayload);
  const currentQualifyingDays = qualifyingDaysApply
    ? Math.max(currentTradingDays, tradingDays.count)
    : currentTradingDays;
  const targetReached = target === 0 || asNumber(account.totalPl, 0) >= target;
  const profitableDaysReached = minTradingDays === 0 || currentTradingDays >= minTradingDays;
  const qualifyingDaysReached =
    !qualifyingDaysApply || currentQualifyingDays >= FUNDED_MIN_QUALIFYING_DAYS;
  const minDaysReached = profitableDaysReached && qualifyingDaysReached;
  // Balance and equity both at zero means the statistics feed has not populated this
  // account yet, not that the trader lost everything — a blown account still reports a
  // balance. Without this guard the drawdown maths reads it as a full loss and hard
  // breaches an account that has not placed a trade.
  const accountValueKnown = asNumber(account.balance, 0) > 0 || asNumber(account.equity, 0) > 0;
  // An account that has never traded cannot have lost money. The first sync after
  // delivery can carry a half-populated snapshot (one of balance/equity still 0, the
  // other falling back to the stored size), which reads as a 100% loss and used to
  // hard-breach brand-new accounts before a single trade was placed.
  const hasTradingActivity =
    getStatisticsTrades(account.statisticsPayload).length > 0 ||
    getOpenStatisticsTrades(account.statisticsPayload).length > 0 ||
    tradingDays.count > 0 ||
    asNumber(account.totalPl, 0) !== 0 ||
    asNumber(account.todayPl, 0) !== 0;
  const drawdownMeasurable = accountSizeKnown && accountValueKnown && hasTradingActivity;
  const dailyBreached = drawdownMeasurable && exceedsDrawdownLimit(currentDailyLoss, dailyLossLimit);
  const overallBreached = drawdownMeasurable && exceedsDrawdownLimit(currentMaxDrawdown, maxDrawdown);
  const fundedStage = account.status === "Funded" || account.phase === "Funded (Live)";
  const instantFunded = rule.key === "instant_funding";
  const minimumHoldingApplies = instantFunded || fundedStage;
  // News Trading Rule: Instant + every Funded stage, current rulebook only. A
  // violation is a soft breach — never part of hardBreach — whose trade profit is
  // removed from withdrawable profit (see payouts route).
  const newsRestrictionApplies = newsRuleApplies(rule, account.phase, account.status, ruleVersion);
  const storedNewsViolations = getStoredNewsViolations(account.statisticsPayload);
  const newsEvents = context.newsEvents;
  let newsViolations: NewsViolation[] = [];
  if (newsRestrictionApplies) {
    if (Array.isArray(newsEvents)) {
      const newsTrades = extractNewsTrades(account.statisticsPayload);
      newsViolations = mergeNewsViolations(
        storedNewsViolations,
        detectNewsViolations(newsTrades, newsEvents, NEWS_RESTRICTED_MINUTES_EACH_SIDE),
        new Set(newsTrades.map((trade) => trade.ticket)),
        new Set(newsEvents.map(newsEventKey)),
      );
    } else {
      newsViolations = storedNewsViolations;
    }
  }
  const newsDeduction = newsProfitToDeduct(newsViolations);
  const newsViolationTickets = Array.from(new Set(newsViolations.map((violation) => violation.ticket)));
  const statisticsTrades = getStatisticsTrades(account.statisticsPayload);
  // Trade layering is a hard breach on both Live (Funded) and Instant accounts:
  // opening any second trade — any instrument, any direction — inside the 5-minute
  // window from the previous trade's opening time is a violation "resulting in
  // account termination", not a warning. The first violation fails the account, and
  // still-open positions count, so it breaches while the layered trades are live.
  // The precise 5-minute-window definition (and the concurrent-layer cap below) is
  // also part of the 2026-09 update — the legacy rulebook only had a subjective
  // "no grid/martingale/rapid correlated positions, reviewed manually" standard, not
  // an automated same-instrument/same-direction timer. So, like tick scalping and the
  // single trade loss limit, neither is applied to accounts pinned to the legacy
  // rulebook.
  const layeringApplies = newRulesEnforced && (instantFunded || fundedStage);
  const layeringViolations = layeringApplies
    ? detectStatisticsTradeLayering(account.statisticsPayload)
    : [];
  const layeringBreached = layeringApplies && layeringViolations.length > 0;
  // Instant Funded's additional cap: a maximum of 2 concurrent same-instrument,
  // same-direction positions. Opening a 3rd at any time fails the account, even if
  // every entry was more than 5 minutes apart.
  const concurrentLayeringApplies = newRulesEnforced && instantFunded;
  const concurrentLayering = concurrentLayeringApplies
    ? getMaxConcurrentLayers(statisticsTrades, getOpenStatisticsTrades(account.statisticsPayload))
    : { maxOverlap: 0, violatingTrades: [] };
  const maxConcurrentLayers = concurrentLayering.maxOverlap;
  const concurrentLayerBreached = concurrentLayeringApplies && maxConcurrentLayers > MAX_CONCURRENT_LAYERS;
  // Single Trade Loss Limit: added in the 2026-09 update, so — like tick scalping,
  // inactivity, and the news restriction above — it is never applied to accounts
  // pinned to the legacy rulebook. Instant accounts only. No individual trade —
  // closed or still open — may lose more than SINGLE_TRADE_LOSS_LIMIT_PERCENT of
  // the Initial Account Balance. Guarded by accountSizeKnown so a fabricated
  // placeholder size can never decide this breach.
  const singleTradeLossApplies = newRulesEnforced && instantFunded;
  const singleTradeLossLimit = size * (SINGLE_TRADE_LOSS_LIMIT_PERCENT / 100);
  const singleTradeLossViolations =
    singleTradeLossApplies && accountSizeKnown
      ? getSingleTradeLossViolations(account.statisticsPayload, size, SINGLE_TRADE_LOSS_LIMIT_PERCENT)
      : [];
  const singleTradeLossBreached = singleTradeLossViolations.length > 0;

  const minimumHoldingViolationIds = minimumHoldingApplies
    ? getAllMinimumHoldingViolationIds(account.statisticsPayload)
    : [];
  const minimumHoldingBreached = minimumHoldingViolationIds.length > MINIMUM_HOLDING_RELAXATIONS;
  // Current rules: weekend holding is prohibited by default everywhere and only the
  // paid add-on unlocks it. Legacy rules: allowed on the funded stage of Step 1 /
  // Step 2, restricted in evaluation and on Instant.
  const weekendHoldingAllowed = legacyRules
    ? (fundedStage && rule.fundedWeekendHolding) || Boolean(account.weekendHoldingAddon)
    : rule.fundedWeekendHolding || Boolean(account.weekendHoldingAddon);
  const weekendHoldingViolations = weekendHoldingAllowed
    ? []
    : getWeekendHoldingViolations(account.statisticsPayload);
  // Overnight holding (through the 00:00 UTC rollover) is allowed on every account.
  // Tick scalping and inactivity are hard breaches added in the 2026-09 update, so
  // they are not applied to legacy-pinned accounts.
  const tickScalpingViolations = newRulesEnforced
    ? getTickScalpingViolations(account.statisticsPayload)
    : [];
  const tickScalpingBreached = tickScalpingViolations.length > 0;
  const inactivityBreach =
    newRulesEnforced && account.status !== "Failed"
      ? getInactivityBreach(account.statisticsPayload)
      : null;
  const inactivityBreached = Boolean(inactivityBreach);
  // Profit consistency (legacy rulebook only): on funded and Instant accounts the
  // best single trading day may be at most LEGACY_PROFIT_CONSISTENCY_PERCENT of the
  // total net profit; exactly 30% passes. Going above it is a hard breach and fails
  // the account.
  const consistencyApplies = legacyRules && (fundedStage || instantFunded);
  const consistency = consistencyApplies ? getProfitConsistency(account.statisticsPayload) : null;
  const consistencyBreached =
    Boolean(consistency) && consistency!.ratioPercent > LEGACY_PROFIT_CONSISTENCY_PERCENT;
  // Stay true once the account has actually failed for this reason (not just while
  // still "Active") — otherwise the very next evaluation re-checks with the account
  // already marked Failed, the "Active" guard fails, and both the rule-check row and
  // the breach banner silently fall back to a generic reason instead of this one.
  const earlyTargetBreach =
    accountSizeKnown &&
    (account.status === "Active" || account.status === "Failed") &&
    target > 0 &&
    targetReached &&
    !minDaysReached;
  const hardBreach =
    dailyBreached ||
    overallBreached ||
    minimumHoldingBreached ||
    earlyTargetBreach ||
    tickScalpingBreached ||
    inactivityBreached ||
    layeringBreached ||
    concurrentLayerBreached ||
    singleTradeLossBreached ||
    consistencyBreached;

  const ruleChecks: AccountRuleCheck[] = [
    {
      id: "minimum-profitable-trading-days",
      label: qualifyingDaysApply
        ? `Minimum Qualifying Days (${FUNDED_MIN_PROFITABLE_DAYS} profitable + ${FUNDED_MIN_QUALIFYING_DAYS - FUNDED_MIN_PROFITABLE_DAYS} trading)`
        : `Minimum Profitable Trading Days (${minTradingDays})`,
      status: minDaysReached ? "passed" : earlyTargetBreach ? "failed" : "pending",
      info: earlyTargetBreach
        ? `Profit target was reached after only ${currentTradingDays}/${minTradingDays} days at ${money(profitableDays.threshold)} (0.5% of initial balance); the account has failed`
        : qualifyingDaysApply
          ? `${currentTradingDays}/${FUNDED_MIN_PROFITABLE_DAYS} profitable days (>= ${money(profitableDays.threshold)}) and ${currentQualifyingDays}/${FUNDED_MIN_QUALIFYING_DAYS} qualifying days completed`
          : `${currentTradingDays}/${minTradingDays} days reached at least ${money(profitableDays.threshold)} (0.5% of initial balance)`,
    },
    {
      id: "profit-target",
      label: target > 0 ? `Profit Target (${targetPercent}%)` : "Funded Stage Profit Target",
      status: targetReached ? "passed" : "pending",
      info: target > 0 ? `${money(account.totalPl)} / ${money(target)} reached` : "No profit target in funded stage",
    },
    {
      id: "tick-scalping",
      label: `Tick Scalping (max ${TICK_SCALPING_TRADE_LIMIT - 1} sub-${TICK_SCALPING_MAX_HOLD_SECONDS}s trades / hour)`,
      status: !newRulesEnforced
        ? "passed"
        : tickScalpingBreached
          ? "failed"
          : statisticsTrades.length > 0
            ? "passed"
            : "pending",
      info: !newRulesEnforced
        ? "Not applied to legacy-rule accounts"
        : tickScalpingBreached
          ? `${TICK_SCALPING_TRADE_LIMIT}+ trades held under ${TICK_SCALPING_MAX_HOLD_SECONDS} seconds closed within a single hour; the account has failed`
          : statisticsTrades.length > 0
            ? `No hour contains ${TICK_SCALPING_TRADE_LIMIT} or more sub-${TICK_SCALPING_MAX_HOLD_SECONDS}-second closures`
            : "Awaiting closed-trade history",
    },
    {
      id: "inactivity",
      label: `Inactivity (${INACTIVITY_LIMIT_DAYS} days)`,
      status: !newRulesEnforced
        ? "passed"
        : inactivityBreached
          ? "failed"
          : statisticsTrades.length > 0
            ? "passed"
            : "pending",
      info: !newRulesEnforced
        ? "Not applied to legacy-rule accounts"
        : inactivityBreach
          ? `No trade executed for ${inactivityBreach.daysSinceLastTrade} days (last activity ${inactivityBreach.lastActivityAt.slice(0, 10)}); the account has failed`
          : statisticsTrades.length > 0
            ? `At least one trade executed within the last ${INACTIVITY_LIMIT_DAYS} days`
            : "Awaiting first executed trade",
    },
    {
      id: "leverage",
      label: `Leverage (1:${LEVERAGE_LIMIT})`,
      status: "passed",
      info: `Capped at 1:${LEVERAGE_LIMIT} across every asset class and account stage`,
    },
    {
      id: "minimum-holding-time",
      label: "Minimum Holding Time (3 minutes)",
      status: !minimumHoldingApplies
        ? "passed"
        : minimumHoldingBreached
          ? "failed"
          : statisticsTrades.length > 0
            ? "passed"
            : "pending",
      info: !minimumHoldingApplies
        ? "Applies only to Instant Funded and Funded phases"
        : minimumHoldingBreached
          ? `${minimumHoldingViolationIds.length} trade${minimumHoldingViolationIds.length === 1 ? "" : "s"} closed in under 3 minutes; the account has failed`
          : statisticsTrades.length > 0
            ? "All recorded closed trades were held for at least 180 seconds"
            : "Awaiting closed-trade history",
    },
    {
      id: "news-trading",
      label: `News Trading (±${NEWS_RESTRICTED_MINUTES_EACH_SIDE} min high-impact window)`,
      status: !newsRestrictionApplies
        ? "passed"
        : newsViolations.length > 0
          ? "warning"
          : newsEvents === null
            ? "pending"
            : statisticsTrades.length > 0
              ? "passed"
              : "pending",
      info: !newRulesEnforced
        ? "Legacy rules: news trading is allowed on every account type"
        : !newsRestrictionApplies
          ? "Unrestricted during the Step 1 / Step 2 challenge phase"
          : newsViolations.length > 0
            ? `${newsViolationTickets.length} trade${newsViolationTickets.length === 1 ? "" : "s"} opened or closed within ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes of high-impact news (soft breach). ${money(newsDeduction)} profit is not withdrawable. ${newsViolations.slice(0, 3).map(formatNewsViolation).join("; ")}${newsViolations.length > 3 ? ` (+${newsViolations.length - 3} more)` : ""}`
            : newsEvents === null
              ? "News calendar unavailable; trades will be checked on the next sync"
              : `No trade opened or closed within ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes of high-impact news on an affected instrument`,
    },
    {
      id: "weekend-holding",
      label: "Weekend Holding",
      status: weekendHoldingAllowed
        ? "passed"
        : weekendHoldingViolations.length > 0
          ? "warning"
          : statisticsTrades.length > 0
            ? "passed"
            : "pending",
      info: weekendHoldingAllowed
        ? "Weekend Holding add-on is active on this account"
        : weekendHoldingViolations.length > 0
          ? `${weekendHoldingViolations.length} position${weekendHoldingViolations.length === 1 ? "" : "s"} crossed the Friday market close`
          : "Not allowed by default; all positions must close before the weekend closure (paid add-on required)",
    },
    {
      id: "overnight-holding",
      label: "Overnight Holding",
      status: "passed",
      info: "Allowed on every account; positions may stay open through the 00:00 UTC rollover",
    },
    {
      id: "trade-layering",
      label: "Trade Layering (5-minute separation)",
      status: !layeringApplies
        ? "passed"
        : layeringBreached
          ? "failed"
          : statisticsTrades.length > 0
            ? "passed"
            : "pending",
      info: !newRulesEnforced
        ? "Not applied to legacy-rule accounts"
        : !layeringApplies
        ? "Applies only to Instant Funded and Funded accounts"
        : layeringBreached
          ? `${layeringViolations.length} trade${layeringViolations.length === 1 ? "" : "s"} opened inside the 5-minute window; the account has failed. ${formatTradeLayeringViolations(layeringViolations)}`
          : statisticsTrades.length > 0
            ? "No trade opened less than 5 minutes after the previous trade"
            : "Awaiting trade-opening history",
    },
    {
      id: "concurrent-layering",
      label: `Concurrent Layers (Instant, max ${MAX_CONCURRENT_LAYERS})`,
      status: !concurrentLayeringApplies
        ? "passed"
        : concurrentLayerBreached
          ? "failed"
          : statisticsTrades.length > 0
            ? "passed"
            : "pending",
      info: !newRulesEnforced
        ? "Not applied to legacy-rule accounts"
        : !instantFunded
        ? "Applies only to Instant Funded accounts"
        : concurrentLayerBreached
          ? `${maxConcurrentLayers} same-instrument, same-direction positions were held open at once; the account has failed. ${formatConcurrentLayeringTrades(concurrentLayering.violatingTrades)}`
          : statisticsTrades.length > 0
            ? `Highest concurrent same-instrument, same-direction exposure: ${maxConcurrentLayers} position${maxConcurrentLayers === 1 ? "" : "s"}`
            : "Awaiting trade-opening history",
    },
    {
      id: "single-trade-loss",
      label: `Single Trade Loss Limit (${SINGLE_TRADE_LOSS_LIMIT_PERCENT}%)`,
      status: !newRulesEnforced
        ? "passed"
        : !instantFunded
          ? "passed"
          : !accountSizeKnown
            ? "pending"
            : singleTradeLossBreached
              ? "failed"
              : statisticsTrades.length > 0
                ? "passed"
                : "pending",
      info: !newRulesEnforced
        ? "Not applied to legacy-rule accounts"
        : !instantFunded
          ? "Applies only to Instant accounts"
          : !accountSizeKnown
            ? "Awaiting account balance and size data from the statistics feed"
            : singleTradeLossBreached
              ? `${singleTradeLossViolations.length} trade${singleTradeLossViolations.length === 1 ? "" : "s"} lost more than ${money(singleTradeLossLimit)} (${SINGLE_TRADE_LOSS_LIMIT_PERCENT}% of initial balance) on a single position; the account has failed. ${formatSingleTradeLossViolations(singleTradeLossViolations)}`
            : statisticsTrades.length > 0
              ? `No single trade's realized or floating loss exceeded ${money(singleTradeLossLimit)} (${SINGLE_TRADE_LOSS_LIMIT_PERCENT}% of initial balance)`
              : "Awaiting trade-opening history",
    },
    {
      id: "profit-consistency",
      label: `Profit Consistency (${LEGACY_PROFIT_CONSISTENCY_PERCENT}%)`,
      status: !consistencyApplies
        ? "passed"
        : consistencyBreached
          ? "failed"
          : consistency && consistency.totalProfit > 0
            ? "passed"
            : "pending",
      info: !legacyRules
        ? "Applies only to legacy-rule accounts"
        : !consistencyApplies
          ? "Applies only to Funded and Instant accounts"
          : !consistency || consistency.totalProfit <= 0 || !consistency.bestDay
            ? "Awaiting net profit to measure"
            : consistencyBreached
              ? `Best day ${money(consistency.bestDay.profit)} (${consistency.bestDay.date}) is ${consistency.ratioPercent}% of ${money(consistency.totalProfit)} total profit; above ${LEGACY_PROFIT_CONSISTENCY_PERCENT}%, so the account has failed`
              : `Best day ${money(consistency.bestDay.profit)} is ${consistency.ratioPercent}% of ${money(consistency.totalProfit)} total profit`,
    },
    {
      id: "daily-drawdown",
      label: `Daily Drawdown Compliance (${drawdownLimits.dailyDrawdownPercent}%)`,
      status: dailyBreached ? "failed" : !drawdownMeasurable ? "pending" : "passed",
      info: !drawdownMeasurable
        ? accountSizeKnown && accountValueKnown && !hasTradingActivity
          ? "No trades yet; drawdown is measured once trading starts"
          : "Awaiting account balance and size data from the statistics feed"
        : `${money(currentDailyLoss)} of ${money(dailyLossLimit)} used (${money(drawdownSnapshot.closedDailyLoss)} closed + ${money(drawdownSnapshot.floatingLoss)} floating loss)`,
    },
    {
      id: "overall-drawdown",
      label: `Overall Drawdown Compliance (${drawdownLimits.overallDrawdownPercent}% static, balance/equity-based)`,
      status: overallBreached ? "failed" : !drawdownMeasurable ? "pending" : "passed",
      info: !drawdownMeasurable
        ? accountSizeKnown && accountValueKnown && !hasTradingActivity
          ? "No trades yet; drawdown is measured once trading starts"
          : "Awaiting account balance and size data from the statistics feed"
        : `${money(currentMaxDrawdown)} of ${money(maxDrawdown)} used; lower of Balance/Equity monitored`,
    },
  ];

  const ruleAlerts: AccountRuleAlert[] = [];
  if (tickScalpingBreached) {
    ruleAlerts.push({
      id: "tick-scalping-breach",
      title: "Tick Scalping Breach",
      message: `Account ${account.id} closed ${TICK_SCALPING_TRADE_LIMIT} or more trades that were each held for less than ${TICK_SCALPING_MAX_HOLD_SECONDS} seconds inside a single one-hour window. This pattern (tick scalping / latency scalping) is a prohibited practice and is an immediate hard breach, so the account has failed.`,
      type: "error",
    });
  }
  if (inactivityBreach) {
    ruleAlerts.push({
      id: "inactivity-breach",
      title: "Inactivity Breach",
      message: `Account ${account.id} went ${inactivityBreach.daysSinceLastTrade} days without executing a trade (last activity ${inactivityBreach.lastActivityAt.slice(0, 10)}). At least one trade must be executed every ${INACTIVITY_LIMIT_DAYS} consecutive days, so the account has been closed for breach.`,
      type: "error",
    });
  }
  if (minimumHoldingBreached) {
    ruleAlerts.push({
      id: "minimum-holding-time-breach",
      title: "Minimum Holding Time Breach",
      message: `Account ${account.id} closed ${minimumHoldingViolationIds.length === 1 ? "a trade" : `${minimumHoldingViolationIds.length} trades`} less than 180 seconds (3 minutes) after opening. Every trade must stay open for at least 3 minutes, and there is no warning or free pass: a single violation is a hard breach, so the account has failed.`,
      type: "error",
    });
  }
  if (weekendHoldingViolations.length > 0) {
    ruleAlerts.push({
      id: "weekend-holding-review",
      title: "Weekend Holding Review",
      message: `Account ${account.id} still had ${weekendHoldingViolations.length} position${weekendHoldingViolations.length === 1 ? "" : "s"} open when the market closed for the weekend on Friday. Positions are required to be closed before the weekend, so holding through it puts this account under compliance review and payouts may be delayed or rejected.`,
      type: "warning",
    });
  }
  // One notification per violating trade (ids are deduped by saveRuleNotificationOnce).
  for (const ticket of newsViolationTickets) {
    const tradeViolations = newsViolations.filter((violation) => violation.ticket === ticket);
    const profit = Math.max(0, tradeViolations[0]?.profit || 0);
    ruleAlerts.push({
      id: `news-trading-${ticket}`,
      title: "News Trading Rule",
      message: `Account ${account.id}: ${tradeViolations.map(formatNewsViolation).join("; ")}. Trades may not be opened or closed within ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes before or after high-impact news on an affected instrument. This is a soft breach — the account stays active${profit > 0 ? `, but this trade's ${money(profit)} profit is removed from withdrawable profit` : ""}.`,
      type: "warning",
    });
  }
  if (consistencyBreached && consistency?.bestDay) {
    ruleAlerts.push({
      id: "profit-consistency-breach",
      title: "Profit Consistency Breach",
      message: `Account ${account.id} made ${money(consistency.bestDay.profit)} on ${consistency.bestDay.date}, which is ${consistency.ratioPercent}% of its ${money(consistency.totalProfit)} total profit. Under your rules no single trading day may exceed ${LEGACY_PROFIT_CONSISTENCY_PERCENT}% of total profit (Largest Single Day's Profit / Total Account Profit x 100). Exceeding it is a breach of the Profit Consistency Rule, so the account has failed.`,
      type: "error",
    });
  }
  if (layeringBreached) {
    ruleAlerts.push({
      id: "trade-layering-breach",
      title: "Trade Layering Breach",
      message: `Account ${account.id} opened ${layeringViolations.length} trade${layeringViolations.length === 1 ? "" : "s"} inside the 5-minute window from the previous trade's opening time — any instrument, any direction (a pattern known as trade layering, often used to bypass risk limits). Opening a second trade in that window is a violation of the rulebook, so the account has failed and is terminated. Violating trades: ${formatTradeLayeringViolations(layeringViolations)}`,
      type: "error",
    });
  }
  if (concurrentLayerBreached) {
    ruleAlerts.push({
      id: "concurrent-layering-breach",
      title: "Concurrent Layering Breach",
      message: `Account ${account.id} held ${maxConcurrentLayers} same-instrument, same-direction positions open at the same time. Instant Funded accounts are capped at 2 concurrent layers; opening a 3rd fails the account even if each entry was more than 5 minutes apart. Positions: ${formatConcurrentLayeringTrades(concurrentLayering.violatingTrades)}`,
      type: "error",
    });
  }
  if (singleTradeLossBreached) {
    ruleAlerts.push({
      id: "single-trade-loss-breach",
      title: "Single Trade Loss Limit Breach",
      message: `Account ${account.id} had a single trade lose more than ${SINGLE_TRADE_LOSS_LIMIT_PERCENT}% of its Initial Account Balance (${money(singleTradeLossLimit)}). This cap applies to both realized loss on a closed trade and floating loss on a trade still open, so touching it fails the account immediately even if the position later recovers. Trades: ${formatSingleTradeLossViolations(singleTradeLossViolations)}`,
      type: "error",
    });
  }
  if (earlyTargetBreach) {
    ruleAlerts.push({
      id: "minimum-profitable-days-breach",
      title: "Minimum Profitable Trading Days Breach",
      message: `Account ${account.id} hit its profit target before completing the required minimum number of profitable trading days — only ${currentTradingDays} of the required ${minTradingDays} profitable days had been reached when the target was hit. The rulebook requires the profit target to be reached only after the minimum profitable days are completed; reaching it early, even with a profitable account, counts as a breach and the account has failed as a result.`,
      type: "error",
    });
  }
  if (dailyBreached) {
    ruleAlerts.push({
      id: "daily-drawdown-breach",
      title: "Daily Drawdown Breach",
      message: `Account ${account.id} lost ${money(currentDailyLoss)} in a single day, which exceeds the ${money(dailyLossLimit)} maximum daily loss allowed under the rulebook. Any day where losses exceed this cap results in an automatic failure, regardless of the account's overall performance.`,
      type: "error",
    });
  }

  if (overallBreached) {
    ruleAlerts.push({
      id: "overall-drawdown-breach",
      title: "Overall Drawdown Breach",
      message: `Account ${account.id}'s balance/equity has dropped by ${money(currentMaxDrawdown)} from its starting balance, breaching the ${money(maxDrawdown)} maximum overall drawdown allowed under the rulebook. Once total losses exceed this ceiling at any point, the account fails.`,
      type: "error",
    });
  }

  const recordedBreachReason = getStoredBreachReason(account.statisticsPayload);

  // A minimum-holding failure is the one hard breach that can legitimately stop being
  // true, because it is derived entirely from stored trade ids and the pre-v2 detector
  // recorded ids for trades that never broke the rule. Drawdown failures deliberately
  // stay permanent: their inputs reset each day, so re-deriving them would silently
  // un-fail real breaches the morning after they happened.
  const staleMinimumHoldingFailure =
    account.status === "Failed" &&
    !hardBreach &&
    recordedBreachReason?.id === "minimum-holding-time-breach" &&
    !minimumHoldingBreached;

  // Single Trade Loss, Tick Scalping, and the 5-minute Trade Layering / concurrent-
  // layer cap are also safe to re-derive and clear, same as minimum-holding above: all
  // are rules added in the 2026-09 update and gated by newRulesEnforced, so once an
  // admin pins the order to "legacy" — even after the account already failed under one
  // of them — that rule no longer applies at all and the earlier failure is stale, not
  // a real breach that should be carried forever.
  const staleLegacyPinnedFailure =
    account.status === "Failed" &&
    !hardBreach &&
    legacyRules &&
    (recordedBreachReason?.id === "single-trade-loss-breach" ||
      recordedBreachReason?.id === "tick-scalping-breach" ||
      recordedBreachReason?.id === "trade-layering-breach" ||
      recordedBreachReason?.id === "concurrent-layering-breach");

  // A drawdown failure recorded on an account with no trading activity at all came
  // from a bad first snapshot (see hasTradingActivity), not a real loss, so it is
  // cleared instead of carried forever like a genuine drawdown breach.
  const staleNoTradeDrawdownFailure =
    account.status === "Failed" &&
    !hardBreach &&
    !hasTradingActivity &&
    (recordedBreachReason?.id === "overall-drawdown-breach" ||
      recordedBreachReason?.id === "daily-drawdown-breach");

  // Overnight holding is allowed now, so an account failed on that rule earlier is
  // restored instead of carrying a breach that no longer exists.
  const staleOvernightFailure =
    account.status === "Failed" &&
    !hardBreach &&
    recordedBreachReason?.id === "overnight-holding-breach";

  const staleFailure =
    staleMinimumHoldingFailure || staleLegacyPinnedFailure || staleNoTradeDrawdownFailure || staleOvernightFailure;

  // A Failed account must always say which rule it failed on. When no rule currently
  // evaluates as a hard breach — corrected statistics, or a manual admin override —
  // fall back to the reason recorded at the moment the account was failed rather than
  // the generic "hard account rule" copy.
  if (
    account.status === "Failed" &&
    !staleFailure &&
    !ruleAlerts.some((alert) => alert.type === "error") &&
    recordedBreachReason
  ) {
    ruleAlerts.push({
      id: recordedBreachReason.id,
      title: recordedBreachReason.title,
      message: recordedBreachReason.message,
      type: "error",
    });
  }

  const recommendedStatus = hardBreach
    ? "Failed"
    : staleFailure
    ? getStageAccountStatus(account.phase)
    : account.status === "Active" && target > 0 && targetReached && minDaysReached
    ? "Passed"
    : undefined;

  return {
    accountType: rule.displayName,
    size,
    target,
    dailyLossLimit,
    maxDrawdown,
    currentDailyLoss,
    currentMaxDrawdown,
    minTradingDays,
    currentTradingDays,
    legacyRules,
    newsViolations,
    newsProfitToDeduct: newsDeduction,
    ruleChecks,
    ruleAlerts,
    recommendedStatus,
  };
}

function notificationId(accountId: string, alertId: string) {
  return `rule-${accountId}-${alertId}`;
}

async function saveRuleNotificationOnce(account: DBTradingAccount, alert: AccountRuleAlert, existing: DBNotification[]) {
  const id = notificationId(account.id, alert.id);
  if (existing.some((notification) => notification.id === id)) return;

  const notification: DBNotification = {
    id,
    userId: account.userId,
    title: alert.title,
    message: alert.message,
    type: alert.type,
    // Only the final pass/fail outcome is emailed; every rule alert stays in-app.
    channel: alert.id === "challenge-passed" || alert.id === "challenge-failed" ? "email" : "in_app",
    status: "sent",
    read: false,
    sentAt: new Date().toISOString(),
  };

  await db.saveNotification(notification);
  existing.push(notification);
}

function findRecordedBreachNotification(accountId: string, notifications: DBNotification[]) {
  const prefix = `rule-${accountId}-`;
  const match = notifications
    .filter(
      (notification) =>
        notification.id.startsWith(prefix) &&
        notification.type === "error" &&
        // The "challenge-failed" wrapper carries the same generic copy this recovery
        // exists to replace, so it is never a usable reason.
        notification.id !== `${prefix}challenge-failed`,
    )
    .sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)))[0];
  if (!match) return null;
  return {
    id: match.id.slice(prefix.length) || "recorded-breach-reason",
    title: match.title,
    message: match.message,
  };
}

/**
 * One calendar read for a batch of accounts, spanning every trade they hold.
 * Returns null when the calendar is unavailable (see AccountRuleContext).
 */
export async function loadNewsEventsForAccounts(accounts: DBTradingAccount[]): Promise<NewsEvent[] | null> {
  let earliest = Infinity;
  for (const account of accounts) {
    for (const trade of extractNewsTrades(account.statisticsPayload)) {
      earliest = Math.min(earliest, trade.openTime.getTime());
    }
    for (const violation of getStoredNewsViolations(account.statisticsPayload)) {
      earliest = Math.min(earliest, new Date(violation.eventTime).getTime());
    }
  }
  if (!Number.isFinite(earliest)) return [];
  const margin = (NEWS_RESTRICTED_MINUTES_EACH_SIDE + 1) * 60_000;
  return getRestrictedEvents(new Date(earliest - margin), new Date(Date.now() + margin));
}

export async function applyAccountRuleCompliance(accounts: DBTradingAccount[]) {
  const [orders, plans, existingNotifications] = await Promise.all([
    db.getOrders(),
    db.getPlans(),
    db.getNotifications(),
  ]);
  const newsEvents = await loadNewsEventsForAccounts(accounts);

  const updatedAccounts: Array<DBTradingAccount & ReturnType<typeof evaluateAccountRules>> = [];

  for (const account of accounts) {
    const order = orders.find((item) => item.id === account.orderId);
    const plan = plans.find((item) => item.id === order?.planId);
    const nextAccount: DBTradingAccount = { ...account };
    const accountRule = getChallengeRule(plan?.name || order?.planId || account.phase);
    const holdingApplies = accountRule.key === "instant_funding" || account.status === "Funded" || account.phase === "Funded (Live)";
    const allHoldingIds = holdingApplies ? getAllMinimumHoldingViolationIds(nextAccount.statisticsPayload) : [];
    if (holdingApplies && storedMinimumHoldingViolationsChanged(nextAccount.statisticsPayload, allHoldingIds)) {
      nextAccount.statisticsPayload = withStoredMinimumHoldingViolations(nextAccount.statisticsPayload, allHoldingIds);
      await db.saveAccount(nextAccount);
    }

    // Accounts failed before reasons started being recorded have no stored reason, but
    // the rule notification raised at the time survives and is the only record of why.
    // Recover it before evaluating so a failure that no longer holds can clear in this
    // same pass rather than needing a second request.
    if (nextAccount.status === "Failed" && !getStoredBreachReason(nextAccount.statisticsPayload)) {
      const recoveredReason = findRecordedBreachNotification(nextAccount.id, existingNotifications);
      if (recoveredReason) {
        nextAccount.statisticsPayload = withStoredBreachReason(nextAccount.statisticsPayload, recoveredReason);
        await db.saveAccount(nextAccount);
      }
    }

    const evaluation = evaluateAccountRules(nextAccount, { order, plan, newsEvents });

    // Persist news violations so they survive the trade rolling out of the feed's
    // recent-trades window (payouts are checked weeks later).
    if (newsEvents !== null && storedNewsViolationsChanged(nextAccount.statisticsPayload, evaluation.newsViolations)) {
      nextAccount.statisticsPayload = withStoredNewsViolations(nextAccount.statisticsPayload, evaluation.newsViolations);
      await db.saveAccount(nextAccount);
    }

    for (const alert of evaluation.ruleAlerts) {
      await saveRuleNotificationOnce(nextAccount, alert, existingNotifications);
    }

    if (evaluation.recommendedStatus && nextAccount.status !== evaluation.recommendedStatus) {
      const oldStatus = nextAccount.status;
      nextAccount.status = evaluation.recommendedStatus;
      // Pin the rule that failed the account before saving, so the banner can still
      // name it later even if the underlying statistics stop reporting the breach.
      const failingAlert = evaluation.ruleAlerts.find((alert) => alert.type === "error");
      const breachCleared = oldStatus === "Failed" && nextAccount.status !== "Failed" && nextAccount.status !== "Passed";
      if (evaluation.recommendedStatus === "Failed" && failingAlert) {
        nextAccount.statisticsPayload = withStoredBreachReason(nextAccount.statisticsPayload, {
          id: failingAlert.id,
          title: failingAlert.title,
          message: failingAlert.message,
        });
      } else if (oldStatus === "Failed") {
        // Leaving Failed: drop the recorded reason so an unrelated future failure
        // cannot inherit it.
        nextAccount.statisticsPayload = withStoredBreachReason(nextAccount.statisticsPayload, null);
      }
      await db.saveAccount(nextAccount);

      if (order) {
        // A restored account rejoins its stage's order ledger, which uses its own
        // vocabulary ("Live Active"/"Step2 Active") rather than the account status.
        order.status = breachCleared ? getOrderStatusForPhase(nextAccount.phase) : evaluation.recommendedStatus;
        order.updatedAt = new Date().toISOString();
        await db.saveOrder(order);
      }

      await db.saveAuditLog({
        id: `log-${Math.random().toString(36).substring(2, 11)}`,
        userId: nextAccount.userId,
        userName: "Rule Engine",
        targetId: nextAccount.id,
        targetType: "account",
        action: "rule_engine_status_update",
        description: `Rule engine changed Account ${nextAccount.id} from "${oldStatus}" to "${nextAccount.status}".`,
        createdAt: new Date().toISOString(),
      });

      await saveRuleNotificationOnce(
        nextAccount,
        breachCleared
          ? {
              id: "challenge-breach-cleared",
              title: "Account Breach Cleared",
              message: `Account ${nextAccount.id} has been restored to ${nextAccount.status}. A re-check of its full trade history found no rule violation, so the earlier breach has been reversed and trading can continue.`,
              type: "success",
            }
          : {
              id: nextAccount.status === "Passed" ? "challenge-passed" : "challenge-failed",
              title: nextAccount.status === "Passed" ? "Challenge Objectives Passed" : "Challenge Account Failed",
              message:
                nextAccount.status === "Passed"
                  ? `Account ${nextAccount.id} reached the profit target and minimum trading-day rules. Your next stage is ready for review.`
                  : `Account ${nextAccount.id} failed because a hard-breach rule was detected in account statistics.`,
              type: nextAccount.status === "Passed" ? "success" : "error",
            },
        existingNotifications
      );
    }

    updatedAccounts.push({ ...nextAccount, ...evaluation });
  }

  return updatedAccounts;
}
