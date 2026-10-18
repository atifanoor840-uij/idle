// Public-facing rule text for the marketing site, derived from the SAME constants
// the backend enforces (rulebook.ts, payoutRules.ts, accountTradingRules.ts,
// tradeLayering.ts). Change a number there and the website follows — never
// hard-code rule numbers in marketing copy.
import {
  CHALLENGE_RULES,
  FUNDED_DRAWDOWN_LIMITS,
  FUNDED_MIN_PLAIN_TRADING_DAYS,
  FUNDED_MIN_PROFITABLE_DAYS,
  FUNDED_MIN_QUALIFYING_DAYS,
  INACTIVITY_LIMIT_DAYS,
  LEVERAGE_LIMIT,
  NEWS_COVERED_CURRENCIES,
  NEWS_RESTRICTED_MINUTES_EACH_SIDE,
  PROFIT_SPLIT_BY_WITHDRAWAL,
  SINGLE_TRADE_LOSS_LIMIT_PERCENT,
  TICK_SCALPING_MAX_HOLD_SECONDS,
  TICK_SCALPING_TRADE_LIMIT,
  TICK_SCALPING_WINDOW_SECONDS,
  WEEKEND_HOLDING_ADDON_PERCENT,
  type ChallengeRuleKey,
} from "./rulebook";
import { PAYOUT_PERIOD_DAYS, WITHDRAWAL_CAP_PERCENT } from "./payoutRules";
import { MINIMUM_HOLDING_SECONDS, MINIMUM_PROFITABLE_DAYS, PROFITABLE_DAY_THRESHOLD_PERCENT } from "./accountTradingRules";
import { MAX_CONCURRENT_LAYERS, TRADE_LAYERING_WINDOW_MS } from "./tradeLayering";

/** Enforced in POST /api/payouts. */
export const MIN_PAYOUT_USD = 100;

const pct = (n: number) => `${n}%`;
const SPLIT = PROFIT_SPLIT_BY_WITHDRAWAL;
const SPLIT_TEXT = `${SPLIT[0]}% → ${SPLIT[SPLIT.length - 1]}%`;
const LAYER_MIN = TRADE_LAYERING_WINDOW_MS / 60000;
const HOLD_MIN = MINIMUM_HOLDING_SECONDS / 60;
const F = FUNDED_DRAWDOWN_LIMITS;
const two = CHALLENGE_RULES.two_step_standard;
const one = CHALLENGE_RULES.one_step_pro;
const inst = CHALLENGE_RULES.instant_funding;

export type PublicModel = {
  id: "2-step" | "1-step" | "instant";
  key: ChallengeRuleKey;
  dbModel: "Two Step" | "One Step" | "Instant";
  name: string;
  tag: string;
  blurb: string;
  rules: { k: string; v: string }[];
};

const common = [
  { k: "Time limit", v: `None (trade at least once every ${INACTIVITY_LIMIT_DAYS} days)` },
  { k: "Leverage", v: `Up to 1:${LEVERAGE_LIMIT}` },
  { k: "Weekend holding", v: `Optional add-on (+${WEEKEND_HOLDING_ADDON_PERCENT}%)` },
  { k: "Profit split", v: SPLIT_TEXT },
];

export const PUBLIC_MODELS: PublicModel[] = [
  {
    id: "2-step",
    key: two.key,
    dbModel: "Two Step",
    name: "2-Step",
    tag: "Lowest fee",
    blurb: "Two evaluation phases with the widest drawdown. Best value for disciplined traders.",
    rules: [
      { k: "Phase 1 profit target", v: pct(two.phase1TargetPercent) },
      { k: "Phase 2 profit target", v: pct(two.phase2TargetPercent) },
      { k: "Max daily loss", v: `${pct(two.dailyDrawdownPercent)} · funded ${pct(F.dailyDrawdownPercent)}` },
      { k: "Max overall loss", v: `${pct(two.overallDrawdownPercent)} · funded ${pct(F.overallDrawdownPercent)} (static)` },
      { k: "Profitable days", v: `${two.minTradingDaysEvaluation} per phase (≥${PROFITABLE_DAY_THRESHOLD_PERCENT}% each)` },
      ...common,
    ],
  },
  {
    id: "1-step",
    key: one.key,
    dbModel: "One Step",
    name: "1-Step",
    tag: "Fastest",
    blurb: "One target, then you are funded. A single phase for traders who want speed.",
    rules: [
      { k: "Profit target", v: pct(one.phase1TargetPercent) },
      { k: "Max daily loss", v: `${pct(one.dailyDrawdownPercent)} · funded ${pct(F.dailyDrawdownPercent)}` },
      { k: "Max overall loss", v: `${pct(one.overallDrawdownPercent)} · funded ${pct(F.overallDrawdownPercent)} (static)` },
      { k: "Profitable days", v: `${one.minTradingDaysEvaluation} (≥${PROFITABLE_DAY_THRESHOLD_PERCENT}% each)` },
      ...common,
    ],
  },
  {
    id: "instant",
    key: inst.key,
    dbModel: "Instant",
    name: "Instant Funding",
    tag: "No evaluation",
    blurb: "Skip the challenge and trade a funded account from day one, with tighter limits.",
    rules: [
      { k: "Profit target", v: "None" },
      { k: "Max daily loss", v: pct(inst.dailyDrawdownPercent) },
      { k: "Max overall loss", v: `${pct(inst.overallDrawdownPercent)} (static)` },
      { k: "Max loss per trade", v: pct(SINGLE_TRADE_LOSS_LIMIT_PERCENT) },
      { k: "Days before first payout", v: `${FUNDED_MIN_QUALIFYING_DAYS} (${FUNDED_MIN_PROFITABLE_DAYS} profitable + ${FUNDED_MIN_PLAIN_TRADING_DAYS} trading)` },
      ...common,
    ],
  },
];

/** Row order for the side-by-side comparison table. */
export const RULE_ORDER = [
  "Profit target",
  "Phase 1 profit target",
  "Phase 2 profit target",
  "Max daily loss",
  "Max overall loss",
  "Max loss per trade",
  "Profitable days",
  "Days before first payout",
  "Time limit",
  "Leverage",
  "Weekend holding",
  "Profit split",
];

/** Hard rules: breaking one closes the account (unless marked soft). */
export const CORE_RULES = [
  {
    title: "Daily loss limit",
    value: `${inst.dailyDrawdownPercent}–${two.dailyDrawdownPercent}%`,
    text: `Equity may not fall more than the daily limit below the day's starting balance. Evaluations allow ${two.dailyDrawdownPercent}%, funded and Instant accounts ${F.dailyDrawdownPercent}%. Floating losses count.`,
  },
  {
    title: "Overall loss limit",
    value: `${F.overallDrawdownPercent}–${two.overallDrawdownPercent}%`,
    text: `A static floor measured from the starting balance: ${two.overallDrawdownPercent}% in evaluations, ${F.overallDrawdownPercent}% on funded and Instant accounts. It never trails your profits.`,
  },
  {
    title: "Profitable days",
    value: `${MINIMUM_PROFITABLE_DAYS} days`,
    text: `Each evaluation phase, and every payout, needs ${MINIMUM_PROFITABLE_DAYS} days that each closed at least ${PROFITABLE_DAY_THRESHOLD_PERCENT}% of the starting balance in profit. Funded and Instant accounts need ${FUNDED_MIN_QUALIFYING_DAYS} qualifying days in total.`,
  },
  {
    title: "Minimum holding time",
    value: `${HOLD_MIN} min`,
    text: `On funded and Instant accounts every trade must stay open at least ${HOLD_MIN} minutes. Closing one sooner breaches the account.`,
  },
  {
    title: "Trade spacing",
    value: `${LAYER_MIN} min`,
    text: `On funded and Instant accounts a new trade may not be opened within ${LAYER_MIN} minutes of the previous trade's opening. Instant accounts may also hold at most ${MAX_CONCURRENT_LAYERS} positions in the same instrument and direction at once.`,
  },
  {
    title: "Tick scalping",
    value: `${TICK_SCALPING_MAX_HOLD_SECONDS} sec`,
    text: `Closing ${TICK_SCALPING_TRADE_LIMIT} or more trades held under ${TICK_SCALPING_MAX_HOLD_SECONDS} seconds within any ${TICK_SCALPING_WINDOW_SECONDS / 3600}-hour window breaches the account.`,
  },
  {
    title: "Inactivity",
    value: `${INACTIVITY_LIMIT_DAYS} days`,
    text: `Execute at least one trade every ${INACTIVITY_LIMIT_DAYS} days, counted from your first trade, or the account is closed.`,
  },
  {
    title: "Single trade loss (Instant)",
    value: pct(SINGLE_TRADE_LOSS_LIMIT_PERCENT),
    text: `On Instant accounts no single trade may lose more than ${SINGLE_TRADE_LOSS_LIMIT_PERCENT}% of the starting balance — including while it is still open.`,
  },
  {
    title: "News trading",
    value: `±${NEWS_RESTRICTED_MINUTES_EACH_SIDE} min`,
    text: `On funded and Instant accounts, profit from trades opened or closed within ${NEWS_RESTRICTED_MINUTES_EACH_SIDE} minutes of high-impact news (${NEWS_COVERED_CURRENCIES.join(", ")}) is not withdrawable. The account stays open. Evaluations trade news freely.`,
  },
  {
    title: "Weekend holding",
    value: `+${WEEKEND_HOLDING_ADDON_PERCENT}%`,
    text: `Positions may not be held from Saturday 00:00 to Monday 00:00 UTC unless you buy the weekend add-on (+${WEEKEND_HOLDING_ADDON_PERCENT}% on the fee). Holding overnight on weekdays is always allowed.`,
  },
];

export const ALLOWED = [
  "Holding positions overnight on weekdays",
  "Trading news during evaluation phases",
  `Weekend holding with the +${WEEKEND_HOLDING_ADDON_PERCENT}% add-on`,
  "Expert advisors (EAs) that respect the rules above",
  `Any strategy that keeps trades open ${HOLD_MIN}+ minutes on funded accounts`,
];

export const PROHIBITED = [
  `Tick scalping (${TICK_SCALPING_TRADE_LIMIT}+ trades under ${TICK_SCALPING_MAX_HOLD_SECONDS}s in an hour)`,
  `Opening trades less than ${LAYER_MIN} minutes apart on funded and Instant accounts`,
  "Holding positions over the weekend without the add-on",
  "Latency, tick or price-feed arbitrage",
  "Account management or trading on someone else's behalf",
];

/** Payout policy, straight from payoutRules / rulebook / the payouts route. */
export const PAYOUT_STEPS = [
  { title: "Get funded", text: "Pass your evaluation, or start on an Instant account, and receive your funded login." },
  { title: "Verify once", text: "Complete identity verification (KYC). It is required before your first payout." },
  { title: "Hit your days", text: `Reach ${MINIMUM_PROFITABLE_DAYS} profitable days (≥${PROFITABLE_DAY_THRESHOLD_PERCENT}% each)${FUNDED_MIN_QUALIFYING_DAYS > MINIMUM_PROFITABLE_DAYS ? ` and ${FUNDED_MIN_QUALIFYING_DAYS} qualifying days in total` : ""}.` },
  { title: "Request", text: `Request from your dashboard. Each ${PAYOUT_PERIOD_DAYS}-day period you can withdraw up to ${WITHDRAWAL_CAP_PERCENT}% of the account size.` },
];

export const PAYOUT_TERMS = [
  { k: "Payout period", v: `Every ${PAYOUT_PERIOD_DAYS} days, from your account's start date` },
  { k: "Withdrawal cap", v: `${WITHDRAWAL_CAP_PERCENT}% of the account size per period` },
  { k: "Minimum request", v: `$${MIN_PAYOUT_USD}` },
  { k: "Profit split", v: SPLIT.map((s, i) => `${s}%${i === 0 ? " first" : i === SPLIT.length - 1 ? ` from payout ${i + 1}` : ` second`}`).join(" · ") },
  { k: "Requirements", v: `KYC approved, ${MINIMUM_PROFITABLE_DAYS} profitable days, no rule breaches` },
  { k: "News profit", v: "Profit from restricted-news trades is excluded" },
  { k: "Methods", v: "USDT (TRC20) or bank transfer" },
];

export const SPLIT_SUMMARY = { first: SPLIT[0], max: SPLIT[SPLIT.length - 1], steps: SPLIT.length };
export { LEVERAGE_LIMIT, PAYOUT_PERIOD_DAYS, WEEKEND_HOLDING_ADDON_PERCENT, WITHDRAWAL_CAP_PERCENT };
