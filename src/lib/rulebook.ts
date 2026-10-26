// Every number the Idle4ex rule engine, dashboard and payout route enforce lives in
// this file (Idle4ex Help Center). Change a rule here and the breach engine
// (accountCompliance.ts), the payout route, the trader dashboard and the public
// rules page all follow.
export type ChallengeRuleKey = "two_step_standard" | "one_step_pro" | "instant_funding" | "flex";

export type ChallengeRuleDefinition = {
  key: ChallengeRuleKey;
  buyLabel: string;
  displayName: string;
  aliases: string[];
  phase1TargetPercent: number;
  phase2TargetPercent: number;
  dailyDrawdownPercent: number;
  overallDrawdownPercent: number;
  /** static = floor fixed at the initial balance; trailing = Flex 8% floor that follows the highest closed balance. */
  drawdownModel: "static" | "trailing";
  minTradingDaysEvaluation: number;
  minTradingDaysFundedFirstPayout: number;
  fundedWeekendHolding: boolean;
  /** Positions may stay open through the 00:00 UTC reset. */
  overnightHolding: boolean;
  profitSplitPercent: number;
  features: string[];
};

// Funded Stage of 1-Step / 2-Step: 4% daily / 6% static, same as the challenge
// (Help Center: Challenge versus Funded rules). Instant and Flex use their own set.
export const FUNDED_DRAWDOWN_LIMITS = {
  dailyDrawdownPercent: 4,
  overallDrawdownPercent: 6,
} as const;

// Orders bought before the 2026-09 rulebook update can be pinned to "legacy" by an
// admin. Their accounts (graphs, overview, breach engine) are then evaluated
// against the numbers below instead of the current ones, and the rules added in
// that update (tick scalping, inactivity, the funded Winning Day payout gate, the
// news restricted window, layering, overnight ban) are not applied to them.
export type RuleVersion = "current" | "legacy";

export const LEGACY_FUNDED_DRAWDOWN_LIMITS = {
  dailyDrawdownPercent: 4,
  overallDrawdownPercent: 10,
} as const;

export const CHALLENGE_RULES: Record<ChallengeRuleKey, ChallengeRuleDefinition> = {
  two_step_standard: {
    key: "two_step_standard",
    buyLabel: "Two Step",
    displayName: "2-Step",
    aliases: ["TWO STEP PLUS", "2-STEP PLUS", "2STEP PLUS", "TWO STEP", "2-STEP", "2STEP", "TWO-STEP", "STEP TWO", "STANDARD"],
    phase1TargetPercent: 6,
    phase2TargetPercent: 5,
    dailyDrawdownPercent: 4,
    overallDrawdownPercent: 6,
    drawdownModel: "static",
    minTradingDaysEvaluation: 3,
    minTradingDaysFundedFirstPayout: 5,
    fundedWeekendHolding: false,
    overnightHolding: false,
    profitSplitPercent: 70,
    features: [
      "Phase 1 target: 6% / Phase 2 target: 5%",
      "3 Winning Days per phase (0.5% each); 5 Winning Days before each funded payout",
      "Maximum Daily Drawdown 4% / Maximum Loss 6% static, challenge and funded",
      "Overnight holding not allowed; weekend holding with the paid add-on",
      "Profit split from 70% up to 100%; account fee returned with the first payout",
    ],
  },
  one_step_pro: {
    key: "one_step_pro",
    buyLabel: "One Step",
    displayName: "1-Step",
    aliases: ["ONE STEP", "1-STEP", "1STEP", "ONE-STEP", "STEP ONE", "PRO"],
    phase1TargetPercent: 9,
    phase2TargetPercent: 0,
    dailyDrawdownPercent: 4,
    overallDrawdownPercent: 6,
    drawdownModel: "static",
    minTradingDaysEvaluation: 3,
    minTradingDaysFundedFirstPayout: 5,
    fundedWeekendHolding: false,
    overnightHolding: false,
    profitSplitPercent: 70,
    features: [
      "Single phase target: 9%",
      "3 Winning Days (0.5% each); 5 Winning Days before each funded payout",
      "Maximum Daily Drawdown 4% / Maximum Loss 6% static, challenge and funded",
      "Overnight holding not allowed; weekend holding with the paid add-on",
      "Profit split from 70% up to 100%; account fee returned with the first payout",
    ],
  },
  instant_funding: {
    key: "instant_funding",
    buyLabel: "Instant",
    displayName: "Instant",
    aliases: ["DIRECT SKILLS PROGRAM", "DIRECT SKILLS", "INSTANT FUNDING", "INSTANT"],
    phase1TargetPercent: 0,
    phase2TargetPercent: 0,
    dailyDrawdownPercent: 3,
    overallDrawdownPercent: 6,
    drawdownModel: "static",
    minTradingDaysEvaluation: 0,
    minTradingDaysFundedFirstPayout: 5,
    fundedWeekendHolding: false,
    overnightHolding: false,
    profitSplitPercent: 70,
    features: [
      "No profit target, funded from day one",
      "5 Winning Days (0.5% each) before each payout",
      "Maximum Daily Drawdown 3% / Maximum Loss 6% static",
      "10 minutes between trade opens, maximum 2 concurrent layers",
      "Overnight holding not allowed; weekend holding with the paid add-on",
      "Profit split from 70% up to 100%; account fee not returned",
    ],
  },
  flex: {
    key: "flex",
    buyLabel: "Flex",
    displayName: "Flex",
    aliases: ["FLEX"],
    phase1TargetPercent: 4,
    phase2TargetPercent: 0,
    dailyDrawdownPercent: 4,
    overallDrawdownPercent: 8,
    drawdownModel: "trailing",
    minTradingDaysEvaluation: 0,
    minTradingDaysFundedFirstPayout: 5,
    fundedWeekendHolding: true,
    overnightHolding: true,
    profitSplitPercent: 85,
    features: [
      "One phase, 4% target, no minimum days and no time limit",
      "Maximum Daily Drawdown 4% / Maximum Loss 8% trailing, locks at the starting balance",
      "Overnight and weekend holding allowed",
      "Funded: 1% floating loss cap, 20% consistency, 10 minutes between trade opens",
      "85% profit split (90% with add-on), no withdrawal cap",
    ],
  },
};

// Pre-2026-09 rulebook. Only accounts whose order an admin has pinned to "legacy"
// are evaluated against this set; everything else uses CHALLENGE_RULES above.
export const LEGACY_CHALLENGE_RULES: Record<ChallengeRuleKey, ChallengeRuleDefinition> = {
  two_step_standard: {
    ...CHALLENGE_RULES.two_step_standard,
    phase1TargetPercent: 10,
    phase2TargetPercent: 5,
    dailyDrawdownPercent: 5,
    overallDrawdownPercent: 10,
    minTradingDaysEvaluation: 3,
    minTradingDaysFundedFirstPayout: 3,
    fundedWeekendHolding: true,
    overnightHolding: true,
    profitSplitPercent: 80,
    features: [
      "Phase 1 target: 10% / Phase 2 target: 5%",
      "Minimum profitable trading days: 3 days per phase at 0.5% each",
      "Daily drawdown: 5% / Overall drawdown: 10% static (4% / 10% funded stage)",
      "Weekend holding allowed on the funded stage",
      "Funded stage: 30% profit consistency (best day at most 30% of total profit, hard breach)",
      "80% trader performance fee split",
    ],
  },
  one_step_pro: {
    ...CHALLENGE_RULES.one_step_pro,
    phase1TargetPercent: 10,
    phase2TargetPercent: 0,
    dailyDrawdownPercent: 4,
    overallDrawdownPercent: 10,
    minTradingDaysEvaluation: 3,
    minTradingDaysFundedFirstPayout: 3,
    fundedWeekendHolding: true,
    overnightHolding: true,
    profitSplitPercent: 80,
    features: [
      "Single phase target: 10%",
      "Minimum profitable trading days: 3 days at 0.5% each",
      "Daily drawdown: 4% / Overall drawdown: 10% static (4% / 10% funded stage)",
      "Weekend holding allowed on the funded stage",
      "Funded stage: 30% profit consistency (best day at most 30% of total profit, hard breach)",
      "80% trader performance fee split",
    ],
  },
  instant_funding: {
    ...CHALLENGE_RULES.instant_funding,
    phase1TargetPercent: 0,
    phase2TargetPercent: 0,
    dailyDrawdownPercent: 3,
    overallDrawdownPercent: 6,
    minTradingDaysEvaluation: 0,
    minTradingDaysFundedFirstPayout: 3,
    fundedWeekendHolding: false,
    overnightHolding: true,
    profitSplitPercent: 80,
    features: [
      "No evaluation profit target",
      "Direct entry to the simulated performance stage",
      "Daily drawdown: 3% / Overall drawdown: 6% static",
      "30% profit consistency (best day at most 30% of total profit, hard breach)",
      "80% trader performance fee split",
    ],
  },
  // Flex did not exist before the update; a legacy pin leaves it unchanged.
  flex: CHALLENGE_RULES.flex,
};

export function getChallengeRuleSet(version: RuleVersion = "current") {
  return version === "legacy" ? LEGACY_CHALLENGE_RULES : CHALLENGE_RULES;
}

// Flex is sold through its own $9 + activation-fee flow, not the standard
// checkout, so it is not offered in the Buy Challenge list.
export const BUY_CHALLENGE_TYPES = [
  CHALLENGE_RULES.one_step_pro.buyLabel,
  CHALLENGE_RULES.two_step_standard.buyLabel,
  CHALLENGE_RULES.instant_funding.buyLabel,
];

export function normalizeChallengeRuleKey(value?: string): ChallengeRuleKey {
  const normalized = (value || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ");
  const rules = Object.values(CHALLENGE_RULES).sort(
    (a, b) => Math.max(...b.aliases.map((alias) => alias.length)) - Math.max(...a.aliases.map((alias) => alias.length))
  );
  const matched = rules.find((rule) => rule.aliases.some((alias) => normalized.includes(alias)));
  return matched?.key || "two_step_standard";
}

export function getChallengeRule(value?: string, version: RuleVersion = "current") {
  return getChallengeRuleSet(version)[normalizeChallengeRuleKey(value)];
}

export function getChallengeRuleByBuyLabel(label?: string) {
  return getChallengeRule(label);
}

export function isFundedStage(phase?: string, status?: string) {
  return status === "Funded" || phase === "Funded (Live)";
}

/** Instant is funded from day one; every other model is funded only after passing. */
export function isFundedAccount(rule: Pick<ChallengeRuleDefinition, "key">, phase?: string, status?: string) {
  return rule.key === "instant_funding" || isFundedStage(phase, status);
}

export function getPhaseTargetPercent(rule: ChallengeRuleDefinition, phase?: string, status?: string) {
  if (isFundedStage(phase, status)) return 0;
  if (phase === "Phase 2 (Verification)") return rule.phase2TargetPercent;
  return rule.phase1TargetPercent;
}

export function getDrawdownLimits(
  rule: ChallengeRuleDefinition,
  phase?: string,
  status?: string,
  version: RuleVersion = "current",
) {
  if (isFundedStage(phase, status) && (rule.key === "one_step_pro" || rule.key === "two_step_standard")) {
    return version === "legacy" ? LEGACY_FUNDED_DRAWDOWN_LIMITS : FUNDED_DRAWDOWN_LIMITS;
  }

  return {
    dailyDrawdownPercent: rule.dailyDrawdownPercent,
    overallDrawdownPercent: rule.overallDrawdownPercent,
  };
}

export function getMinimumTradingDays(rule: ChallengeRuleDefinition, phase?: string, status?: string) {
  if (isFundedAccount(rule, phase, status)) return rule.minTradingDaysFundedFirstPayout;
  return rule.minTradingDaysEvaluation;
}

// Maximum leverage is 1:100 across every asset class, for all account types and
// stages (Help Center: What leverage does Idle4ex offer?).
export const LEVERAGE_LIMIT = 100;

// A Winning Day is one UTC day (00:00-23:59) whose profit reaches at least 0.5% of
// the Initial Account Balance. Challenges need 3 (per phase); Instant and every
// Funded stage need 5 before each payout, counted again in each new trading cycle.
export const FUNDED_MIN_WINNING_DAYS = 5;

export function resolveRuleVersion(order?: { legacyRules?: boolean } | null): RuleVersion {
  return order?.legacyRules ? "legacy" : "current";
}

// Progressive profit split on 1-Step Funded, 2-Step Funded and Instant: 70% on the
// first withdrawal, 80% on the second, 90% on the third and up to 100% from the
// fourth (Help Center: How is profit split between me and Idle4ex?). It only steps
// up while every earlier withdrawal was completed without a rule violation.
export const PROFIT_SPLIT_BY_WITHDRAWAL = [70, 80, 90, 100] as const;

// Flex uses a fixed split: 85%, 90% with the 90% Profit Split add-on, and 50% after
// the first time the 1% floating loss cap is hit.
export const FLEX_PROFIT_SPLIT_PERCENT = 85;
export const FLEX_PROFIT_SPLIT_ADDON_PERCENT = 90;
export const FLEX_REDUCED_PROFIT_SPLIT_PERCENT = 50;

export function getProfitSplitPercent(priorSuccessfulWithdrawals: number) {
  const index = Number.isFinite(priorSuccessfulWithdrawals)
    ? Math.max(0, Math.floor(priorSuccessfulWithdrawals))
    : 0;
  return PROFIT_SPLIT_BY_WITHDRAWAL[Math.min(index, PROFIT_SPLIT_BY_WITHDRAWAL.length - 1)];
}

// 1% Per-Trade Risk Rule (1-Step Funded, 2-Step Funded and Instant): the floating
// loss on any single open position must never exceed this percent of the Initial
// Account Balance. Touching it — even briefly before the trade recovers — is a hard
// breach. Flex funded accounts have their own 1% floating loss cap instead.
export const SINGLE_TRADE_LOSS_LIMIT_PERCENT = 1;

export function perTradeRiskRuleApplies(rule: Pick<ChallengeRuleDefinition, "key">, phase?: string, status?: string) {
  if (rule.key === "instant_funding") return true;
  return isFundedStage(phase, status) && (rule.key === "one_step_pro" || rule.key === "two_step_standard");
}

// Flex funded 1% floating loss cap: positions are closed automatically at 1% of the
// account. The first hit is a soft breach that cuts the split to 50%; a second hit
// can close the account.
export const FLEX_FLOATING_LOSS_CAP_PERCENT = 1;
export const FLEX_FLOATING_LOSS_HARD_BREACH_COUNT = 2;

// Flex funded consistency: no single day may be more than 20% of total profit when a
// payout is requested. Not a breach — it only delays the payout.
export const FLEX_CONSISTENCY_PERCENT = 20;

// Flex: after passing, the activation fee must be paid within 48 hours.
export const FLEX_ACTIVATION_WINDOW_HOURS = 48;

// ---------------------------------------------------------------------------
// News Trading Rule (current rulebook only — legacy orders have no news window).
//
// A high-impact economic-calendar event for one of the covered currencies opens a
// restricted window from NEWS_RESTRICTED_MINUTES_EACH_SIDE before to the same
// number of minutes after the release (10 minutes in total), both ends inclusive.
// Opening or closing (manual, pending, TP or SL) a trade on an instrument exposed
// to that currency inside the window is a SOFT breach: the account is not failed,
// but the trade's positive profit is removed from withdrawable profit.
// ---------------------------------------------------------------------------
export const NEWS_RESTRICTED_MINUTES_EACH_SIDE = 5;

/** Calendar currencies whose high-impact events are restricted. */
export const NEWS_COVERED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"] as const;

/** Which account types the window applies to. Challenges and the Flex evaluation trade freely. */
export const NEWS_RULE_ACCOUNT_SCOPE = {
  instant: true,
  fundedStage: true,
  evaluation: false,
} as const;

/** Impact level on the calendar feed that counts as restricted news. */
export const NEWS_RESTRICTED_IMPACT = "High";

export function newsRuleApplies(
  rule: Pick<ChallengeRuleDefinition, "key">,
  phase?: string,
  status?: string,
  version: RuleVersion = "current",
) {
  if (version === "legacy") return false;
  if (rule.key === "instant_funding") return NEWS_RULE_ACCOUNT_SCOPE.instant;
  if (isFundedStage(phase, status)) return NEWS_RULE_ACCOUNT_SCOPE.fundedStage;
  return NEWS_RULE_ACCOUNT_SCOPE.evaluation;
}

// Trade layering (1-Step Funded, 2-Step Funded, Flex Funded, Instant): a new trade
// may open only 10 minutes after the previous trade's opening time. Hard breach.
export function tradeLayeringApplies(rule: Pick<ChallengeRuleDefinition, "key">, phase?: string, status?: string) {
  return isFundedAccount(rule, phase, status);
}

// Tick scalping: closing 3 or more trades that were each held for less than 10
// seconds inside any rolling 1-hour window is an immediate hard breach.
export const TICK_SCALPING_MAX_HOLD_SECONDS = 10;
export const TICK_SCALPING_WINDOW_SECONDS = 60 * 60;
export const TICK_SCALPING_TRADE_LIMIT = 3;

// Inactivity: at least one trade must be executed every 30 consecutive calendar
// days, counted from the last executed trade (UTC), or the account is closed.
export const INACTIVITY_LIMIT_DAYS = 30;

// Legacy rulebook only: on funded (and Instant) accounts the most profitable
// single trading day may be at most this percent of the total net profit.
// Exactly 30% passes; going above it is a hard breach that fails the account.
export const LEGACY_PROFIT_CONSISTENCY_PERCENT = 30;

// Scaling Plan (1-Step Funded, 2-Step Funded, Instant): after every 4 payouts with
// no rule violation the balance grows by 25% of the ORIGINAL account size.
export const SCALING_PAYOUTS_PER_STEP = 4;
export const SCALING_INCREASE_PERCENT = 25;

export function scalingPlanApplies(rule: Pick<ChallengeRuleDefinition, "key">) {
  return rule.key !== "flex";
}

export function getScalingProgress(originalSize: number, cleanPayouts: number) {
  const payouts = Math.max(0, Math.floor(Number(cleanPayouts) || 0));
  const steps = Math.floor(payouts / SCALING_PAYOUTS_PER_STEP);
  return {
    steps,
    payoutsTowardNext: payouts % SCALING_PAYOUTS_PER_STEP,
    scaledSize: originalSize * (1 + (steps * SCALING_INCREASE_PERCENT) / 100),
    nextScaledSize: originalSize * (1 + ((steps + 1) * SCALING_INCREASE_PERCENT) / 100),
  };
}

// A breach decision can be appealed within 7 days of the notification.
export const BREACH_APPEAL_WINDOW_DAYS = 7;

// Weekend Holding is prohibited by default on 1-Step, 2-Step and Instant. It is
// only unlocked by buying the Weekend Holding add-on at checkout, which adds this
// percentage to the challenge fee. Flex allows weekend holding without it.
export const WEEKEND_HOLDING_ADDON_PERCENT = 20;
export const OVERNIGHT_HOLDING_ADDON_PERCENT = 10;

export function applyAddons(
  basePrice: number,
  addons: { weekendHolding?: boolean; overnightHolding?: boolean } = {}
) {
  let multiplier = 1;
  if (addons.weekendHolding) multiplier += WEEKEND_HOLDING_ADDON_PERCENT / 100;
  if (addons.overnightHolding) multiplier += OVERNIGHT_HOLDING_ADDON_PERCENT / 100;
  return Number((basePrice * multiplier).toFixed(2));
}

export function applyWeekendHoldingAddon(basePrice: number, selected: boolean) {
  return applyAddons(basePrice, { weekendHolding: selected });
}
