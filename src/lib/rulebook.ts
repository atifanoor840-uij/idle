export type ChallengeRuleKey = "two_step_standard" | "one_step_pro" | "instant_funding";

export type ChallengeRuleDefinition = {
  key: ChallengeRuleKey;
  buyLabel: string;
  displayName: string;
  aliases: string[];
  phase1TargetPercent: number;
  phase2TargetPercent: number;
  dailyDrawdownPercent: number;
  overallDrawdownPercent: number;
  drawdownModel: "static";
  minTradingDaysEvaluation: number;
  minTradingDaysFundedFirstPayout: number;
  fundedWeekendHolding: boolean;
  profitSplitPercent: number;
  features: string[];
};

// Funded Stage and Instant use the same tighter limits: 3% daily / 5% overall
// static from the initial balance (Help Center: Daily Drawdown, Maximum Drawdown).
export const FUNDED_DRAWDOWN_LIMITS = {
  dailyDrawdownPercent: 3,
  overallDrawdownPercent: 5,
} as const;

// Orders bought before the 2026-09 rulebook update can be pinned to "legacy" by an
// admin. Their accounts (graphs, overview, breach engine) are then evaluated
// against the numbers below instead of the current ones, and the rules added in
// that update (tick scalping, inactivity, the 5-qualifying-day payout gate, the
// news restricted window) are not applied to them.
export type RuleVersion = "current" | "legacy";

export const LEGACY_FUNDED_DRAWDOWN_LIMITS = {
  dailyDrawdownPercent: 4,
  overallDrawdownPercent: 10,
} as const;

export const CHALLENGE_RULES: Record<ChallengeRuleKey, ChallengeRuleDefinition> = {
  two_step_standard: {
    key: "two_step_standard",
    buyLabel: "Two Step",
    displayName: "Two Step",
    aliases: ["TWO STEP PLUS", "2-STEP PLUS", "2STEP PLUS", "TWO STEP", "2-STEP", "2STEP", "TWO-STEP", "STEP TWO", "STANDARD"],
    phase1TargetPercent: 8,
    phase2TargetPercent: 5,
    dailyDrawdownPercent: 4,
    overallDrawdownPercent: 10,
    drawdownModel: "static",
    minTradingDaysEvaluation: 3,
    minTradingDaysFundedFirstPayout: 3,
    fundedWeekendHolding: false,
    profitSplitPercent: 80,
    features: [
      "Phase 1 target: 8% / Phase 2 target: 5%",
      "Minimum profitable trading days: 3 days per phase at 0.5% each",
      "Evaluation drawdown: 4% daily / 10% overall static; Funded stage: 3% daily / 5% overall",
      "Performance stage has no additional assessment target",
      "Weekend holding not allowed by default (optional paid add-on)",
      "80% trader performance fee split on the first withdrawal",
    ],
  },
  one_step_pro: {
    key: "one_step_pro",
    buyLabel: "One Step",
    displayName: "One Step",
    aliases: ["ONE STEP", "1-STEP", "1STEP", "ONE-STEP", "STEP ONE", "PRO"],
    phase1TargetPercent: 10,
    phase2TargetPercent: 0,
    dailyDrawdownPercent: 4,
    overallDrawdownPercent: 10,
    drawdownModel: "static",
    minTradingDaysEvaluation: 3,
    minTradingDaysFundedFirstPayout: 3,
    fundedWeekendHolding: false,
    profitSplitPercent: 80,
    features: [
      "Single phase target: 10%",
      "Minimum profitable trading days: 3 days at 0.5% each",
      "Evaluation drawdown: 4% daily / 10% overall static; Funded stage: 3% daily / 5% overall",
      "Performance stage has no additional assessment target",
      "Weekend holding not allowed by default (optional paid add-on)",
      "80% trader performance fee split on the first withdrawal",
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
    overallDrawdownPercent: 5,
    drawdownModel: "static",
    minTradingDaysEvaluation: 0,
    minTradingDaysFundedFirstPayout: 3,
    fundedWeekendHolding: false,
    profitSplitPercent: 80,
    features: [
      "No evaluation profit target",
      "Direct entry to the simulated performance stage",
      "Daily drawdown: 3% / Overall drawdown: 5% static",
      "5 qualifying days before payout: 3 profitable + 2 trading days",
      "Weekend holding not allowed by default (optional paid add-on)",
      "80% trader performance fee split on the first withdrawal",
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
    features: [
      "No evaluation profit target",
      "Direct entry to the simulated performance stage",
      "Daily drawdown: 3% / Overall drawdown: 6% static",
      "30% profit consistency (best day at most 30% of total profit, hard breach)",
      "80% trader performance fee split",
    ],
  },
};

export function getChallengeRuleSet(version: RuleVersion = "current") {
  return version === "legacy" ? LEGACY_CHALLENGE_RULES : CHALLENGE_RULES;
}

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

export function getPhaseTargetPercent(rule: ChallengeRuleDefinition, phase?: string, status?: string) {
  if (status === "Funded" || phase === "Funded (Live)") return 0;
  if (phase === "Phase 2 (Verification)") return rule.phase2TargetPercent;
  return rule.phase1TargetPercent;
}

export function getDrawdownLimits(
  rule: ChallengeRuleDefinition,
  phase?: string,
  status?: string,
  version: RuleVersion = "current",
) {
  const isFundedStage = status === "Funded" || phase === "Funded (Live)";

  if (isFundedStage && rule.key !== "instant_funding") {
    return version === "legacy" ? LEGACY_FUNDED_DRAWDOWN_LIMITS : FUNDED_DRAWDOWN_LIMITS;
  }

  return {
    dailyDrawdownPercent: rule.dailyDrawdownPercent,
    overallDrawdownPercent: rule.overallDrawdownPercent,
  };
}

export function getMinimumTradingDays(rule: ChallengeRuleDefinition, phase?: string, status?: string) {
  if (status === "Funded" || phase === "Funded (Live)") return rule.minTradingDaysFundedFirstPayout;
  return rule.minTradingDaysEvaluation;
}

// Maximum leverage is 1:100 across every asset class, for all account types and
// stages (Help Center: What leverage does range4ex offer?).
export const LEVERAGE_LIMIT = 100;

// Instant and every Funded stage need 5 qualifying days before the first
// withdrawal: 3 must be Profitable Days (>= 0.5% of the initial balance) and the
// other 2 can be plain Trading Days (a position opened and closed that day).
// Step 1 / Step 2 challenge accounts only need the 3 Profitable Days.
export const FUNDED_MIN_PROFITABLE_DAYS = 3;
export const FUNDED_MIN_PLAIN_TRADING_DAYS = 2;
export const FUNDED_MIN_QUALIFYING_DAYS = FUNDED_MIN_PROFITABLE_DAYS + FUNDED_MIN_PLAIN_TRADING_DAYS;

export function requiresQualifyingTradingDays(
  rule: ChallengeRuleDefinition,
  phase?: string,
  status?: string,
  version: RuleVersion = "current",
) {
  if (version === "legacy") return false;
  return rule.key === "instant_funding" || status === "Funded" || phase === "Funded (Live)";
}

export function resolveRuleVersion(order?: { legacyRules?: boolean } | null): RuleVersion {
  return order?.legacyRules ? "legacy" : "current";
}

// Progressive performance-fee split: 80% on the first withdrawal, 85% on the
// second, 90% on the third and every one after (Help Center: How is profit split
// between me and range4ex?). It only steps up while every earlier withdrawal was
// completed without a rule violation.
export const PROFIT_SPLIT_BY_WITHDRAWAL = [80, 85, 90] as const;

export function getProfitSplitPercent(priorSuccessfulWithdrawals: number) {
  const index = Number.isFinite(priorSuccessfulWithdrawals)
    ? Math.max(0, Math.floor(priorSuccessfulWithdrawals))
    : 0;
  return PROFIT_SPLIT_BY_WITHDRAWAL[Math.min(index, PROFIT_SPLIT_BY_WITHDRAWAL.length - 1)];
}

// Single Trade Loss Limit (Instant accounts only): no individual trade may lose
// more than this percent of the Initial Account Balance, counting both realized
// loss on a closed trade and floating (unrealized) loss while it is still open.
// Breaching it — even briefly while the trade is open, before it is closed at a
// smaller loss or in profit — is an immediate hard breach, independent of the
// daily/overall drawdown caps.
export const SINGLE_TRADE_LOSS_LIMIT_PERCENT = 1;
// ---------------------------------------------------------------------------
// News Trading Rule (current rulebook only — legacy orders have no news window).
//
// A high-impact ("red folder") economic-calendar event for one of the covered
// currencies opens a restricted window from NEWS_RESTRICTED_MINUTES_EACH_SIDE
// before to the same number of minutes after the release, both ends inclusive.
// Opening or closing (manual, TP or SL) a trade on an instrument exposed to that
// currency inside the window is a SOFT breach: the account is not failed, but
// the trade's positive profit is removed from withdrawable profit. Every number
// the rule uses lives here.
// ---------------------------------------------------------------------------
export const NEWS_RESTRICTED_MINUTES_EACH_SIDE = 3;

/** Calendar currencies whose high-impact events are restricted. */
export const NEWS_COVERED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"] as const;

/** Which account types the window applies to. Evaluation phases trade freely. */
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
  const fundedStage = status === "Funded" || phase === "Funded (Live)";
  if (rule.key === "instant_funding") return NEWS_RULE_ACCOUNT_SCOPE.instant;
  if (fundedStage) return NEWS_RULE_ACCOUNT_SCOPE.fundedStage;
  return NEWS_RULE_ACCOUNT_SCOPE.evaluation;
}

// Tick scalping: closing 3 or more trades that were each held for less than 10
// seconds inside any rolling 1-hour window is an immediate hard breach.
export const TICK_SCALPING_MAX_HOLD_SECONDS = 10;
export const TICK_SCALPING_WINDOW_SECONDS = 60 * 60;
export const TICK_SCALPING_TRADE_LIMIT = 3;

// Inactivity: at least one trade must be executed every 30 consecutive days,
// counted from the first executed trade, or the account is closed for breach.
export const INACTIVITY_LIMIT_DAYS = 30;

// Legacy rulebook only: on funded (and Instant) accounts the most profitable
// single trading day may be at most this percent of the total net profit.
// Exactly 30% passes; going above it is a hard breach that fails the account.
export const LEGACY_PROFIT_CONSISTENCY_PERCENT = 30;

// Weekend Holding is prohibited by default on every account type and stage. It is
// only unlocked by buying the Weekend Holding add-on at checkout, which adds this
// percentage to the challenge fee.
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
