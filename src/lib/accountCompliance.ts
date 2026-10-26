import { DBChallengePlan, DBNotification, DBOrder, DBPayout, DBTradingAccount, db } from "@/lib/db";
import { calculateDrawdownSnapshot, exceedsDrawdownLimit } from "@/lib/drawdown";
import {
  getChallengeRule,
  getDrawdownLimits,
  getMinimumTradingDays,
  getPhaseTargetPercent,
  getScalingProgress,
  isFundedAccount,
  isFundedStage,
  newsRuleApplies,
  perTradeRiskRuleApplies,
  resolveRuleVersion,
  scalingPlanApplies,
  tradeLayeringApplies,
  FLEX_CONSISTENCY_PERCENT,
  FLEX_FLOATING_LOSS_CAP_PERCENT,
  FLEX_FLOATING_LOSS_HARD_BREACH_COUNT,
  FLEX_REDUCED_PROFIT_SPLIT_PERCENT,
  INACTIVITY_LIMIT_DAYS,
  LEGACY_PROFIT_CONSISTENCY_PERCENT,
  LEVERAGE_LIMIT,
  SINGLE_TRADE_LOSS_LIMIT_PERCENT,
  NEWS_RESTRICTED_MINUTES_EACH_SIDE,
  TICK_SCALPING_MAX_HOLD_SECONDS,
  TICK_SCALPING_TRADE_LIMIT,
  type ChallengeRuleKey,
} from "@/lib/rulebook";
import { getOrderStatusForPhase, getStageAccountStatus } from "@/lib/challengeStages";
import {
  detectStatisticsTradeLayering,
  formatConcurrentLayeringTrades,
  formatTradeLayeringViolations,
  getMaxConcurrentLayers,
  getStatisticsTrades,
  MAX_CONCURRENT_LAYERS,
  TRADE_LAYERING_WINDOW_MS,
} from "@/lib/tradeLayering";
import {
  calculateProfitableTradingDays,
  calculateTradingDays,
  formatSingleTradeLossViolations,
  getAllMinimumHoldingViolationIds,
  getLastTradeActivity,
  getOpenStatisticsTrades,
  getOvernightHoldingViolations,
  getPeakClosedBalance,
  getSingleTradeLossViolations,
  storedMinimumHoldingViolationsChanged,
  getStoredBreachReason,
  withStoredBreachReason,
  getWeekendHoldingViolations,
  getTickScalpingViolations,
  getInactivityBreach,
  getProfitConsistency,
  MINIMUM_HOLDING_RELAXATIONS,
  PROFITABLE_DAY_THRESHOLD_PERCENT,
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
  /** hard = breaking it closes the account; soft = profit removed / payout held; info = never a breach. */
  severity?: "hard" | "soft" | "info";
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
  /** This account's payouts; paid ones start a new trading cycle. */
  payouts?: Pick<DBPayout, "status" | "createdAt" | "approvedAt">[];
};

type AccountRuleEvaluation = {
  accountType: string;
  ruleKey: ChallengeRuleKey;
  fundedAccount: boolean;
  size: number;
  target: number;
  dailyLossLimit: number;
  maxDrawdown: number;
  currentDailyLoss: number;
  currentMaxDrawdown: number;
  /** Balance/equity may never fall below this (static, or the Flex trailing floor). */
  lossFloor: number;
  drawdownModel: "static" | "trailing";
  /** Flex: highest closed balance the trailing floor is measured from. */
  peakClosedBalance: number;
  minTradingDays: number;
  /** Winning Days in the current cycle (each >= 0.5% of the initial balance). */
  currentTradingDays: number;
  winningDayThreshold: number;
  /** Start of the current trading cycle (last paid payout), or null for the first cycle. */
  cycleStart: string | null;
  paidPayoutCount: number;
  scaling: ReturnType<typeof getScalingProgress> | null;
  lastTradeAt: string | null;
  inactivityDaysLeft: number | null;
  /** Flex funded: profit split cut to 50% after the first 1% floating-loss-cap hit. */
  flexReducedSplit: boolean;
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

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
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

/** Paid payouts start a new trading cycle; returns the latest cycle start. */
export function resolveCycleStart(payouts: AccountRuleContext["payouts"] = []) {
  const paid = payouts
    .filter((payout) => payout.status === "paid")
    .map((payout) => payout.approvedAt || payout.createdAt)
    .filter(Boolean)
    .sort();
  return paid.length ? paid[paid.length - 1] : null;
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
  const isFlex = rule.key === "flex";
  const fundedStage = isFundedStage(account.phase, account.status);
  const instantFunded = rule.key === "instant_funding";
  const fundedAccount = isFundedAccount(rule, account.phase, account.status);
  const targetPercent = getPhaseTargetPercent(rule, account.phase, account.status);
  const resolvedSize = resolveInitialBalance(account, context, targetPercent);
  // A size that resolved from nothing is a guess. It still drives the displayed limits
  // so the dashboard has numbers to show, but measuring a real balance against a
  // fabricated $100k size reads as a near-total loss and would fail the account
  // outright, so it must never decide a breach.
  const accountSizeKnown = resolvedSize > 0;
  const size = accountSizeKnown ? resolvedSize : PLACEHOLDER_ACCOUNT_SIZE;
  const balance = asNumber(account.balance, size);
  const drawdownLimits = getDrawdownLimits(rule, account.phase, account.status, ruleVersion);
  const target = size * (targetPercent / 100);
  const dailyLossLimit = size * (drawdownLimits.dailyDrawdownPercent / 100);
  const maxLossAmount = size * (drawdownLimits.overallDrawdownPercent / 100);
  const todayPl = asNumber(account.todayPl, 0);
  const todayClosedLoss = getTodayClosedLoss(account.statisticsPayload, todayPl);
  const drawdownSnapshot = calculateDrawdownSnapshot({
    initialBalance: size,
    balance,
    equity: asNumber(account.equity, account.balance),
    todayClosedPl: -todayClosedLoss,
  });
  const currentDailyLoss = drawdownSnapshot.currentDailyLoss;
  // Maximum Loss: static 6% floor from the initial balance on 1-Step / 2-Step /
  // Instant; on Flex an 8% floor below the highest CLOSED balance that locks at the
  // starting balance once the account is 8% in profit.
  const trailing = rule.drawdownModel === "trailing";
  const peakClosedBalance = trailing ? getPeakClosedBalance(account.statisticsPayload, size, balance) : size;
  const lossFloor = trailing ? Math.min(size, peakClosedBalance - maxLossAmount) : size - maxLossAmount;
  const drawdownReference = trailing ? peakClosedBalance : size;
  const maxDrawdown = drawdownReference - lossFloor;
  const currentMaxDrawdown = Math.max(0, drawdownReference - drawdownSnapshot.monitoredAccountValue);
  const openTrades = getOpenStatisticsTrades(account.statisticsPayload);
  const statisticsTrades = getStatisticsTrades(account.statisticsPayload);

  // Winning Days: challenges need 3 (per phase); Instant and every Funded stage need
  // 5 before each payout, counted again from the start of each new trading cycle.
  const paidPayoutCount = (context.payouts || []).filter((payout) => payout.status === "paid").length;
  const cycleStart = fundedAccount && newRulesEnforced ? resolveCycleStart(context.payouts) : null;
  const minTradingDays = getMinimumTradingDays(rule, account.phase, account.status);
  const profitableDays = calculateProfitableTradingDays(account.statisticsPayload, size, cycleStart);
  const currentTradingDays = profitableDays.count;
  const tradingDays = calculateTradingDays(account.statisticsPayload);
  const minDaysReached = minTradingDays === 0 || currentTradingDays >= minTradingDays;
  // Balance and equity both at zero means the statistics feed has not populated this
  // account yet, not that the trader lost everything — a blown account still reports a
  // balance. Without this guard the drawdown maths reads it as a full loss and hard
  // breaches an account that has not placed a trade.
  const accountValueKnown = asNumber(account.balance, 0) > 0 || asNumber(account.equity, 0) > 0;
  // The profit target is verified on the CLOSED balance with every position and
  // pending order closed (Help Center: 1-Step — Profit Target conditions).
  const closedProfit = accountValueKnown ? balance - size : asNumber(account.totalPl, 0);
  const targetProfitReached = target === 0 || closedProfit >= target;
  const targetReached = targetProfitReached && (target === 0 || openTrades.length === 0);
  // An account that has never traded cannot have lost money. The first sync after
  // delivery can carry a half-populated snapshot (one of balance/equity still 0, the
  // other falling back to the stored size), which reads as a 100% loss and used to
  // hard-breach brand-new accounts before a single trade was placed.
  const hasTradingActivity =
    statisticsTrades.length > 0 ||
    openTrades.length > 0 ||
    tradingDays.count > 0 ||
    asNumber(account.totalPl, 0) !== 0 ||
    asNumber(account.todayPl, 0) !== 0;
  const drawdownMeasurable = accountSizeKnown && accountValueKnown && hasTradingActivity;
  const dailyBreached = drawdownMeasurable && exceedsDrawdownLimit(currentDailyLoss, dailyLossLimit);
  const overallBreached = drawdownMeasurable && exceedsDrawdownLimit(currentMaxDrawdown, maxDrawdown);

  // News Trading Rule: Instant + every Funded stage (Flex funded included), current
  // rulebook only. A violation is a soft breach — never part of hardBreach — whose
  // trade profit is removed from withdrawable profit (see payouts route).
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

  // Trade layering (1-Step / 2-Step / Flex Funded and Instant): a new trade may open
  // only 10 minutes after the previous trade's opening time — any instrument, any
  // direction, and closing the first trade does not reset the window. Hard breach.
  // Not applied during the challenge, the Flex evaluation or to legacy-pinned orders.
  const layeringMinutes = TRADE_LAYERING_WINDOW_MS / 60000;
  const layeringApplies = newRulesEnforced && tradeLayeringApplies(rule, account.phase, account.status);
  const layeringViolations = layeringApplies
    ? detectStatisticsTradeLayering(account.statisticsPayload)
    : [];
  const layeringBreached = layeringApplies && layeringViolations.length > 0;
  // Instant's additional cap: at most 2 concurrent layers. Opening a 3rd at any time
  // fails the account, even if each entry was 10 minutes or more apart.
  const concurrentLayeringApplies = newRulesEnforced && instantFunded;
  const concurrentLayering = concurrentLayeringApplies
    ? getMaxConcurrentLayers(statisticsTrades, openTrades)
    : { maxOverlap: 0, violatingTrades: [] };
  const maxConcurrentLayers = concurrentLayering.maxOverlap;
  const concurrentLayerBreached = concurrentLayeringApplies && maxConcurrentLayers > MAX_CONCURRENT_LAYERS;

  // 1% Per-Trade Risk Rule (1-Step Funded, 2-Step Funded, Instant): the floating loss
  // on a single position may never exceed 1% of the Initial Account Balance. Hard.
  // Guarded by accountSizeKnown so a placeholder size can never decide it.
  const perTradeRiskApplies = newRulesEnforced && perTradeRiskRuleApplies(rule, account.phase, account.status);
  const singleTradeLossLimit = size * (SINGLE_TRADE_LOSS_LIMIT_PERCENT / 100);
  const singleTradeLossViolations =
    perTradeRiskApplies && accountSizeKnown
      ? getSingleTradeLossViolations(account.statisticsPayload, size, SINGLE_TRADE_LOSS_LIMIT_PERCENT)
      : [];
  const singleTradeLossBreached = singleTradeLossViolations.length > 0;

  // Flex funded 1% floating loss cap: first hit = soft breach (split cut to 50%),
  // second hit can close the account.
  const flexCapApplies = newRulesEnforced && isFlex && fundedStage;
  const flexCapViolations =
    flexCapApplies && accountSizeKnown
      ? getSingleTradeLossViolations(account.statisticsPayload, size, FLEX_FLOATING_LOSS_CAP_PERCENT)
      : [];
  const flexCapHits = new Set(flexCapViolations.map((violation) => violation.tradeId)).size;
  const flexCapBreached = flexCapHits >= FLEX_FLOATING_LOSS_HARD_BREACH_COUNT;
  const flexReducedSplit = flexCapHits > 0;
  const flexCapLimit = size * (FLEX_FLOATING_LOSS_CAP_PERCENT / 100);

  // Minimum holding time (3 minutes): every trade on every account and stage. A hard
  // breach on 1-Step, 2-Step and Instant; on Flex it is flagged and reviewed at
  // withdrawal. Legacy-pinned orders keep the old Funded/Instant-only scope.
  const minimumHoldingApplies = newRulesEnforced || instantFunded || fundedStage;
  const minimumHoldingViolationIds = minimumHoldingApplies
    ? getAllMinimumHoldingViolationIds(account.statisticsPayload)
    : [];
  const minimumHoldingViolated = minimumHoldingViolationIds.length > MINIMUM_HOLDING_RELAXATIONS;
  const minimumHoldingBreached = minimumHoldingViolated && !isFlex;

  // Weekend holding (Friday 23:00 to Sunday 23:00 UTC): prohibited on 1-Step, 2-Step
  // and Instant unless the add-on was bought; Flex allows it. Soft breach. Legacy
  // rules: allowed on the funded stage of Step 1 / Step 2.
  const weekendHoldingAllowed = legacyRules
    ? (fundedStage && rule.fundedWeekendHolding) || Boolean(account.weekendHoldingAddon)
    : rule.fundedWeekendHolding || Boolean(account.weekendHoldingAddon);
  const weekendHoldingViolations = weekendHoldingAllowed
    ? []
    : getWeekendHoldingViolations(account.statisticsPayload);

  // Overnight holding: every trade on 1-Step, 2-Step and Instant must close before
  // the 00:00 UTC reset. Soft breach: the withdrawal is rejected, and repeated cases
  // are escalated by the risk team. Flex allows it; legacy orders allowed it; an
  // Overnight Holding add-on bought before the update is honoured.
  const overnightHoldingAllowed =
    legacyRules || rule.overnightHolding || Boolean(account.overnightHoldingAddon);
  const overnightHoldingViolations = overnightHoldingAllowed
    ? []
    : getOvernightHoldingViolations(account.statisticsPayload, {
        weekendHoldingAddon: Boolean(account.weekendHoldingAddon),
      });

  // Tick scalping and inactivity apply to every account (current rulebook only).
  const tickScalpingViolations = newRulesEnforced
    ? getTickScalpingViolations(account.statisticsPayload)
    : [];
  const tickScalpingBreached = tickScalpingViolations.length > 0;
  const deliveredAnchor =
    account.deliveryStatus === "delivered" ? account.deliveredAt || account.createdAt : null;
  const inactivityBreach =
    newRulesEnforced && account.status !== "Failed" && account.status !== "Passed"
      ? getInactivityBreach(account.statisticsPayload, new Date(), deliveredAnchor)
      : null;
  const inactivityBreached = Boolean(inactivityBreach);
  const lastTrade = getLastTradeActivity(account.statisticsPayload);
  const inactivityReference = lastTrade || (deliveredAnchor ? new Date(deliveredAnchor) : null);
  const inactivityDaysLeft =
    newRulesEnforced && inactivityReference && !Number.isNaN(inactivityReference.getTime())
      ? Math.max(
          0,
          INACTIVITY_LIMIT_DAYS - Math.floor((Date.now() - inactivityReference.getTime()) / (24 * 60 * 60 * 1000)),
        )
      : null;

  // Profit consistency. Current rules: none on 1-Step, 2-Step and Instant; Flex
  // funded may not have one day above 20% of total profit at payout time — not a
  // breach, the payout is only delayed. Legacy rules: 30% on funded/Instant, hard.
  const legacyConsistencyApplies = legacyRules && (fundedStage || instantFunded);
  const flexConsistencyApplies = newRulesEnforced && isFlex && fundedStage;
  const consistency =
    legacyConsistencyApplies || flexConsistencyApplies
      ? getProfitConsistency(account.statisticsPayload, cycleStart)
      : null;
  const consistencyLimit = flexConsistencyApplies ? FLEX_CONSISTENCY_PERCENT : LEGACY_PROFIT_CONSISTENCY_PERCENT;
  const consistencyExceeded = Boolean(consistency) && consistency!.ratioPercent > consistencyLimit;
  const consistencyBreached = legacyConsistencyApplies && consistencyExceeded;

  const hardBreach =
    dailyBreached ||
    overallBreached ||
    minimumHoldingBreached ||
    tickScalpingBreached ||
    inactivityBreached ||
    layeringBreached ||
    concurrentLayerBreached ||
    singleTradeLossBreached ||
    flexCapBreached ||
    consistencyBreached;

  const winningThreshold = profitableDays.threshold;
  const awaitingTrades = statisticsTrades.length === 0;

  const ruleChecks: AccountRuleCheck[] = [
    {
      id: "profit-target",
      label: target > 0 ? `Profit Target (${targetPercent}%)` : "Profit Target",
      severity: "info",
      status: targetReached ? "passed" : "pending",
      info:
        target === 0
          ? fundedAccount
            ? "No profit target on a funded account"
            : "No profit target"
          : targetReached
            ? `${money(closedProfit)} of ${money(target)} reached on the closed balance`
            : targetProfitReached
              ? `${money(target)} reached; close every open position so the target can be verified on the closed balance`
              : `${money(Math.max(0, closedProfit))} of ${money(target)} on the closed balance`,
    },
    {
      id: "minimum-profitable-trading-days",
      label:
        minTradingDays > 0
          ? `${isFlex && fundedStage ? "Profitable" : "Winning"} Days (${minTradingDays}${fundedAccount ? " before payout" : ""})`
          : "Minimum Days",
      severity: "info",
      status: minDaysReached ? "passed" : "pending",
      info:
        minTradingDays === 0
          ? isFlex
            ? "No minimum days and no time limit in the Flex evaluation"
            : "No minimum days"
          : `${Math.min(currentTradingDays, minTradingDays)}/${minTradingDays} days reached at least ${money(winningThreshold)} (${PROFITABLE_DAY_THRESHOLD_PERCENT}% of initial balance)${cycleStart ? " this cycle" : ""}${
              !minDaysReached && target > 0 && targetProfitReached ? "; the target is hit, the account passes once the days are complete" : ""
            }`,
    },
    {
      id: "daily-drawdown",
      label: `Maximum Daily Drawdown (${drawdownLimits.dailyDrawdownPercent}%)`,
      severity: "hard",
      status: dailyBreached ? "failed" : !drawdownMeasurable ? "pending" : "passed",
      info: !drawdownMeasurable
        ? accountSizeKnown && accountValueKnown && !hasTradingActivity
          ? "No trades yet; drawdown is measured once trading starts"
          : "Awaiting account balance and size data from the statistics feed"
        : `${money(currentDailyLoss)} of ${money(dailyLossLimit)} used today (${money(drawdownSnapshot.closedDailyLoss)} closed + ${money(drawdownSnapshot.floatingLoss)} floating). Resets 00:00 UTC`,
    },
    {
      id: "overall-drawdown",
      label: trailing
        ? `Maximum Loss (${drawdownLimits.overallDrawdownPercent}% trailing)`
        : `Maximum Loss (${drawdownLimits.overallDrawdownPercent}% static)`,
      severity: "hard",
      status: overallBreached ? "failed" : !drawdownMeasurable ? "pending" : "passed",
      info: !drawdownMeasurable
        ? accountSizeKnown && accountValueKnown && !hasTradingActivity
          ? "No trades yet; drawdown is measured once trading starts"
          : "Awaiting account balance and size data from the statistics feed"
        : trailing
          ? `Balance and equity must stay above ${money(lossFloor)}${lossFloor >= size ? " (locked at the starting balance)" : ` (${drawdownLimits.overallDrawdownPercent}% below the highest closed balance ${money(peakClosedBalance)})`}`
          : `Balance and equity must stay above ${money(lossFloor)}; ${money(currentMaxDrawdown)} of ${money(maxDrawdown)} used`,
    },
    {
      id: "minimum-holding-time",
      label: "Minimum Holding Time (3 minutes)",
      severity: isFlex ? "soft" : "hard",
      status: !minimumHoldingApplies
        ? "passed"
        : minimumHoldingViolated
          ? isFlex
            ? "warning"
            : "failed"
          : awaitingTrades
            ? "pending"
            : "passed",
      info: !minimumHoldingApplies
        ? "Legacy rules: applies only to Instant and Funded accounts"
        : minimumHoldingViolated
          ? isFlex
            ? `${plural(minimumHoldingViolationIds.length, "trade")} closed in under 3 minutes; flagged for review at withdrawal and can cause a payout to be rejected`
            : `${plural(minimumHoldingViolationIds.length, "trade")} closed in under 3 minutes; the account has failed`
          : awaitingTrades
            ? "Awaiting closed-trade history"
            : "Every closed trade was held for at least 3 minutes",
    },
    ...(perTradeRiskApplies
      ? [
          {
            id: "single-trade-loss",
            label: `1% Per-Trade Risk Rule`,
            severity: "hard" as const,
            status: (!accountSizeKnown
              ? "pending"
              : singleTradeLossBreached
                ? "failed"
                : awaitingTrades && openTrades.length === 0
                  ? "pending"
                  : "passed") as AccountRuleCheck["status"],
            info: !accountSizeKnown
              ? "Awaiting account balance and size data from the statistics feed"
              : singleTradeLossBreached
                ? `${plural(singleTradeLossViolations.length, "position")} lost more than ${money(singleTradeLossLimit)} (1% of initial balance); the account has failed. ${formatSingleTradeLossViolations(singleTradeLossViolations)}`
                : `No single position's floating loss exceeded ${money(singleTradeLossLimit)} (1% of initial balance)`,
          },
        ]
      : []),
    ...(flexCapApplies
      ? [
          {
            id: "flex-floating-loss-cap",
            label: "1% Floating Loss Cap",
            severity: "soft" as const,
            status: (flexCapBreached ? "failed" : flexCapHits > 0 ? "warning" : awaitingTrades ? "pending" : "passed") as AccountRuleCheck["status"],
            info: flexCapBreached
              ? `The ${money(flexCapLimit)} floating loss cap was hit ${flexCapHits} times; the account is closed`
              : flexCapHits > 0
                ? `The ${money(flexCapLimit)} floating loss cap was hit once; the profit split is reduced to ${FLEX_REDUCED_PROFIT_SPLIT_PERCENT}%. A second hit can close the account`
                : `Positions are closed automatically at ${money(flexCapLimit)} floating loss (1% of the account)`,
          },
        ]
      : []),
    {
      id: "trade-layering",
      label: `Trade Layering (${layeringMinutes} minutes between opens)`,
      severity: "hard",
      status: !layeringApplies ? "passed" : layeringBreached ? "failed" : awaitingTrades ? "pending" : "passed",
      info: !newRulesEnforced
        ? "Not applied to legacy-rule accounts"
        : !layeringApplies
          ? "Does not apply during the challenge or the Flex evaluation"
          : layeringBreached
            ? `${plural(layeringViolations.length, "trade")} opened less than ${layeringMinutes} minutes after the previous trade opened; the account has failed. ${formatTradeLayeringViolations(layeringViolations)}`
            : awaitingTrades
              ? "Awaiting trade-opening history"
              : `Every trade opened at least ${layeringMinutes} minutes after the previous one`,
    },
    ...(concurrentLayeringApplies
      ? [
          {
            id: "concurrent-layering",
            label: `Concurrent Layers (max ${MAX_CONCURRENT_LAYERS})`,
            severity: "hard" as const,
            status: (concurrentLayerBreached ? "failed" : awaitingTrades && openTrades.length === 0 ? "pending" : "passed") as AccountRuleCheck["status"],
            info: concurrentLayerBreached
              ? `${maxConcurrentLayers} positions were open at the same time; Instant accounts allow ${MAX_CONCURRENT_LAYERS}, so the account has failed. ${formatConcurrentLayeringTrades(concurrentLayering.violatingTrades)}`
              : `Highest number of positions open at once: ${maxConcurrentLayers}`,
          },
        ]
      : []),
    {
      id: "news-trading",
      label: `News Trading (${NEWS_RESTRICTED_MINUTES_EACH_SIDE * 2}-minute window)`,
      severity: "soft",
      status: !newsRestrictionApplies
        ? "passed"
        : newsViolations.length > 0
          ? "warning"
          : newsEvents === null || awaitingTrades
            ? "pending"
            : "passed",
      info: !newRulesEnforced
        ? "Legacy rules: news trading is allowed on every account type"
        : !newsRestrictionApplies
          ? isFlex
            ? "Unrestricted during the Flex evaluation"
            : "Unrestricted during the challenge"
          : newsViolations.length > 0
            ? `${plural(newsViolationTickets.length, "trade")} opened or closed within ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes of high-impact news (soft breach). ${money(newsDeduction)} profit is not withdrawable. ${newsViolations.slice(0, 3).map(formatNewsViolation).join("; ")}${newsViolations.length > 3 ? ` (+${newsViolations.length - 3} more)` : ""}`
            : newsEvents === null
              ? "News calendar unavailable; trades will be checked on the next sync"
              : `No trade opened or closed from ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes before to ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes after high-impact news on an affected instrument`,
    },
    {
      id: "overnight-holding",
      label: "Overnight Holding",
      severity: "soft",
      status: overnightHoldingAllowed
        ? "passed"
        : overnightHoldingViolations.length > 0
          ? "warning"
          : awaitingTrades && openTrades.length === 0
            ? "pending"
            : "passed",
      info: overnightHoldingAllowed
        ? isFlex
          ? "Allowed on Flex accounts"
          : account.overnightHoldingAddon && !legacyRules
            ? "Overnight Holding add-on is active on this account"
            : "Allowed under the legacy rulebook"
        : overnightHoldingViolations.length > 0
          ? `${plural(overnightHoldingViolations.length, "position")} stayed open through the 00:00 UTC reset; withdrawals are rejected and repeated cases close the account`
          : "Every trade must be closed before the 00:00 UTC reset",
    },
    {
      id: "weekend-holding",
      label: "Weekend Holding",
      severity: "soft",
      status: weekendHoldingAllowed
        ? "passed"
        : weekendHoldingViolations.length > 0
          ? "warning"
          : awaitingTrades && openTrades.length === 0
            ? "pending"
            : "passed",
      info: weekendHoldingAllowed
        ? isFlex
          ? "Allowed on Flex accounts"
          : "Weekend Holding add-on is active on this account"
        : weekendHoldingViolations.length > 0
          ? `${plural(weekendHoldingViolations.length, "position")} held during the weekend closure; the trade can be removed or its profit adjusted`
          : "All positions must be closed from Friday 23:00 to Sunday 23:00 UTC (paid add-on required)",
    },
    {
      id: "tick-scalping",
      label: `Tick Scalping`,
      severity: "hard",
      status: !newRulesEnforced ? "passed" : tickScalpingBreached ? "failed" : awaitingTrades ? "pending" : "passed",
      info: !newRulesEnforced
        ? "Not applied to legacy-rule accounts"
        : tickScalpingBreached
          ? `${TICK_SCALPING_TRADE_LIMIT}+ trades held under ${TICK_SCALPING_MAX_HOLD_SECONDS} seconds closed within one hour; the account has failed`
          : `Never ${TICK_SCALPING_TRADE_LIMIT} or more trades held under ${TICK_SCALPING_MAX_HOLD_SECONDS} seconds within one hour`,
    },
    {
      id: "inactivity",
      label: `Inactivity (${INACTIVITY_LIMIT_DAYS} days)`,
      severity: "hard",
      status: !newRulesEnforced ? "passed" : inactivityBreached ? "failed" : inactivityDaysLeft === null ? "pending" : inactivityDaysLeft <= 5 ? "warning" : "passed",
      info: !newRulesEnforced
        ? "Not applied to legacy-rule accounts"
        : inactivityBreach
          ? `No trade executed for ${inactivityBreach.daysSinceLastTrade} days (since ${inactivityBreach.lastActivityAt.slice(0, 10)}); the account is closed`
          : inactivityDaysLeft === null
            ? `Execute at least one trade every ${INACTIVITY_LIMIT_DAYS} days`
            : `${plural(inactivityDaysLeft, "day")} left to execute a trade${lastTrade ? ` (last trade ${lastTrade.toISOString().slice(0, 10)})` : ""}`,
    },
    ...(consistency
      ? [
          {
            id: "profit-consistency",
            label: `Profit Consistency (${consistencyLimit}%)`,
            severity: (flexConsistencyApplies ? "info" : "hard") as AccountRuleCheck["severity"],
            status: (consistencyExceeded
              ? flexConsistencyApplies
                ? "warning"
                : "failed"
              : consistency.totalProfit > 0
                ? "passed"
                : "pending") as AccountRuleCheck["status"],
            info:
              consistency.totalProfit <= 0 || !consistency.bestDay
                ? "Awaiting net profit to measure"
                : consistencyExceeded
                  ? flexConsistencyApplies
                    ? `Best day ${money(consistency.bestDay.profit)} is ${consistency.ratioPercent}% of ${money(consistency.totalProfit)} total profit; the payout is delayed until no day is above ${consistencyLimit}% (not a breach)`
                    : `Best day ${money(consistency.bestDay.profit)} (${consistency.bestDay.date}) is ${consistency.ratioPercent}% of ${money(consistency.totalProfit)} total profit; above ${consistencyLimit}%, so the account has failed`
                  : `Best day ${money(consistency.bestDay.profit)} is ${consistency.ratioPercent}% of ${money(consistency.totalProfit)} total profit`,
          },
        ]
      : []),
    {
      id: "leverage",
      label: `Leverage (1:${LEVERAGE_LIMIT})`,
      severity: "info",
      status: "passed",
      info: `Capped at 1:${LEVERAGE_LIMIT} on every asset class`,
    },
  ];

  const ruleAlerts: AccountRuleAlert[] = [];
  if (tickScalpingBreached) {
    ruleAlerts.push({
      id: "tick-scalping-breach",
      title: "Tick Scalping Breach",
      message: `Account ${account.id} closed ${TICK_SCALPING_TRADE_LIMIT} or more trades that were each held for less than ${TICK_SCALPING_MAX_HOLD_SECONDS} seconds inside a single one-hour window. Tick scalping is a prohibited trading practice and an immediate hard breach, so the account has failed.`,
      type: "error",
    });
  }
  if (inactivityBreach) {
    ruleAlerts.push({
      id: "inactivity-breach",
      title: "Inactivity Breach",
      message: `Account ${account.id} went ${inactivityBreach.daysSinceLastTrade} days without an executed trade (since ${inactivityBreach.lastActivityAt.slice(0, 10)}). At least one trade must be executed every ${INACTIVITY_LIMIT_DAYS} consecutive days, so the account is marked inactive and closed.${fundedAccount ? " A payout approved before the account became inactive remains valid; any payout not yet approved is lost." : ""}`,
      type: "error",
    });
  }
  if (minimumHoldingBreached) {
    ruleAlerts.push({
      id: "minimum-holding-time-breach",
      title: "Minimum Holding Time Breach",
      message: `Account ${account.id} closed ${minimumHoldingViolationIds.length === 1 ? "a trade" : `${minimumHoldingViolationIds.length} trades`} less than 3 minutes after opening. Every trade must stay open for at least 3 minutes, whether it closes manually, by Stop-Loss or by Take-Profit. This is a hard breach, so the account has failed.`,
      type: "error",
    });
  } else if (minimumHoldingViolated && isFlex) {
    ruleAlerts.push({
      id: "minimum-holding-time-review",
      title: "Minimum Holding Time Review",
      message: `Account ${account.id} closed ${minimumHoldingViolationIds.length === 1 ? "a trade" : `${minimumHoldingViolationIds.length} trades`} in under 3 minutes. On Flex these trades are flagged and reviewed at withdrawal and can cause a payout to be rejected.`,
      type: "warning",
    });
  }
  if (overnightHoldingViolations.length > 0) {
    ruleAlerts.push({
      id: "overnight-holding-review",
      title: "Overnight Holding",
      message: `Account ${account.id} kept ${plural(overnightHoldingViolations.length, "position")} open through the 00:00 UTC daily reset. Every trade must open and close within the same UTC day. This is a soft breach: the account stays active, but a withdrawal is rejected while it stands, and repeated cases lead to account termination.`,
      type: "warning",
    });
  }
  if (weekendHoldingViolations.length > 0) {
    ruleAlerts.push({
      id: "weekend-holding-review",
      title: "Weekend Holding",
      message: `Account ${account.id} held ${plural(weekendHoldingViolations.length, "position")} during the weekend closure (Friday 23:00 to Sunday 23:00 UTC) without the Weekend Holding add-on. This is a soft breach: the trade may be removed or its profit adjusted, and repeated cases lead to account termination.`,
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
      message: `Account ${account.id}: ${tradeViolations.map(formatNewsViolation).join("; ")}. Trades may not be opened or closed on an affected instrument from ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes before to ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes after high-impact news. This is a soft breach — the account stays active${profit > 0 ? `, but this trade's ${money(profit)} profit is removed from withdrawable profit` : ""}.`,
      type: "warning",
    });
  }
  if (consistencyBreached && consistency?.bestDay) {
    ruleAlerts.push({
      id: "profit-consistency-breach",
      title: "Profit Consistency Breach",
      message: `Account ${account.id} made ${money(consistency.bestDay.profit)} on ${consistency.bestDay.date}, which is ${consistency.ratioPercent}% of its ${money(consistency.totalProfit)} total profit. Under your rules no single trading day may exceed ${LEGACY_PROFIT_CONSISTENCY_PERCENT}% of total profit. Exceeding it is a breach of the Profit Consistency Rule, so the account has failed.`,
      type: "error",
    });
  }
  if (layeringBreached) {
    ruleAlerts.push({
      id: "trade-layering-breach",
      title: "Trade Layering Breach",
      message: `Account ${account.id} opened ${plural(layeringViolations.length, "trade")} less than ${layeringMinutes} minutes after the previous trade's opening time (any instrument, any direction; closing a trade does not reset the window). This is a hard breach, so the account has failed. Violating trades: ${formatTradeLayeringViolations(layeringViolations)}`,
      type: "error",
    });
  }
  if (concurrentLayerBreached) {
    ruleAlerts.push({
      id: "concurrent-layering-breach",
      title: "Concurrent Layering Breach",
      message: `Account ${account.id} held ${maxConcurrentLayers} positions open at the same time. Instant accounts are capped at ${MAX_CONCURRENT_LAYERS} concurrent layers; opening a 3rd fails the account even if each entry was ${layeringMinutes} minutes or more apart. Positions: ${formatConcurrentLayeringTrades(concurrentLayering.violatingTrades)}`,
      type: "error",
    });
  }
  if (singleTradeLossBreached) {
    ruleAlerts.push({
      id: "single-trade-loss-breach",
      title: "1% Per-Trade Risk Rule Breach",
      message: `Account ${account.id} had a single position lose more than 1% of its Initial Account Balance (${money(singleTradeLossLimit)}). The limit is measured on the floating loss at every moment the trade is open, so touching it is a hard breach even if the trade later recovers. Trades: ${formatSingleTradeLossViolations(singleTradeLossViolations)}`,
      type: "error",
    });
  }
  if (flexCapBreached) {
    ruleAlerts.push({
      id: "flex-floating-loss-cap-breach",
      title: "Floating Loss Cap Breach",
      message: `Account ${account.id} hit the ${money(flexCapLimit)} (1%) floating loss cap ${flexCapHits} times. The first hit reduced the profit split to ${FLEX_REDUCED_PROFIT_SPLIT_PERCENT}%; a second hit closes the account. Trades: ${formatSingleTradeLossViolations(flexCapViolations)}`,
      type: "error",
    });
  } else if (flexReducedSplit) {
    ruleAlerts.push({
      id: "flex-floating-loss-cap-soft",
      title: "Floating Loss Cap Hit",
      message: `Account ${account.id} hit the ${money(flexCapLimit)} (1%) floating loss cap and the position was closed. The account continues, but the profit split is reduced to ${FLEX_REDUCED_PROFIT_SPLIT_PERCENT}%. A second hit can close the account.`,
      type: "warning",
    });
  }
  if (dailyBreached) {
    ruleAlerts.push({
      id: "daily-drawdown-breach",
      title: "Maximum Daily Drawdown Breach",
      message: `Account ${account.id} lost ${money(currentDailyLoss)} in one trading day (closed trades plus floating losses), above the ${money(dailyLossLimit)} Maximum Daily Drawdown (${drawdownLimits.dailyDrawdownPercent}% of the initial balance). This is a hard breach: the account is permanently closed, even if it later recovers.`,
      type: "error",
    });
  }

  if (overallBreached) {
    ruleAlerts.push({
      id: "overall-drawdown-breach",
      title: "Maximum Loss Breach",
      message: `Account ${account.id}'s balance or equity fell below ${money(lossFloor)}, breaching the ${drawdownLimits.overallDrawdownPercent}% ${trailing ? "trailing " : ""}Maximum Loss. This is a hard breach: the account is permanently closed, regardless of any later recovery.`,
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

  // Single Trade Loss, Tick Scalping, and Trade Layering / concurrent-layer cap are
  // also safe to re-derive and clear: all are rules added in the 2026-09 update and
  // gated by newRulesEnforced, so once an admin pins the order to "legacy" — even
  // after the account already failed under one of them — that rule no longer applies.
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

  // Rules that are no longer hard breaches: overnight holding is a soft breach, and
  // hitting the target before the minimum days only delays the pass. Accounts failed
  // on either earlier are restored.
  const staleRetiredRuleFailure =
    account.status === "Failed" &&
    !hardBreach &&
    (recordedBreachReason?.id === "overnight-holding-breach" ||
      (newRulesEnforced && recordedBreachReason?.id === "minimum-profitable-days-breach"));

  const staleFailure =
    staleMinimumHoldingFailure || staleLegacyPinnedFailure || staleNoTradeDrawdownFailure || staleRetiredRuleFailure;

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
    ruleKey: rule.key,
    fundedAccount,
    size,
    target,
    dailyLossLimit,
    maxDrawdown,
    currentDailyLoss,
    currentMaxDrawdown,
    lossFloor,
    drawdownModel: rule.drawdownModel,
    peakClosedBalance,
    minTradingDays,
    currentTradingDays,
    winningDayThreshold: winningThreshold,
    cycleStart,
    paidPayoutCount,
    scaling: fundedAccount && newRulesEnforced && scalingPlanApplies(rule) ? getScalingProgress(size, paidPayoutCount) : null,
    lastTradeAt: lastTrade ? lastTrade.toISOString() : null,
    inactivityDaysLeft,
    flexReducedSplit,
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
  const [orders, plans, existingNotifications, payouts] = await Promise.all([
    db.getOrders(),
    db.getPlans(),
    db.getNotifications(),
    db.getPayouts(),
  ]);
  const newsEvents = await loadNewsEventsForAccounts(accounts);

  const updatedAccounts: Array<DBTradingAccount & ReturnType<typeof evaluateAccountRules>> = [];

  for (const account of accounts) {
    const order = orders.find((item) => item.id === account.orderId);
    const plan = plans.find((item) => item.id === order?.planId);
    const accountPayouts = payouts.filter((payout) => payout.accountId === account.id);
    const nextAccount: DBTradingAccount = { ...account };
    // Minimum holding applies to every account under the current rulebook, and to
    // Instant / Funded accounts under the legacy one.
    const accountRule = getChallengeRule(plan?.name || order?.planId || account.phase);
    const holdingApplies =
      resolveRuleVersion(order) === "current" ||
      accountRule.key === "instant_funding" ||
      isFundedStage(account.phase, account.status);
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

    const evaluation = evaluateAccountRules(nextAccount, { order, plan, newsEvents, payouts: accountPayouts });

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
                  ? `Account ${nextAccount.id} reached the profit target and the minimum Winning Days. Your next stage is ready for review.`
                  : `Account ${nextAccount.id} failed because a hard-breach rule was detected in account statistics. You can appeal within 7 days of this notice.`,
              type: nextAccount.status === "Passed" ? "success" : "error",
            },
        existingNotifications
      );
    }

    updatedAccounts.push({ ...nextAccount, ...evaluation });
  }

  return updatedAccounts;
}
