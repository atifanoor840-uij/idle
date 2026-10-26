// Withdrawal rules (Help Center: Withdrawals). The cap and minimum apply to 1-Step
// Funded, 2-Step Funded and Instant; Flex has no cap and a flat $100 minimum.
export const WITHDRAWAL_CAP_PERCENT = 6;
export const MIN_WITHDRAWAL_PERCENT = 1;
export const FLEX_MIN_WITHDRAWAL_USD = 100;
export const TRADER_PROFIT_SPLIT_PERCENT = 70;
export const PAYOUT_PERIOD_DAYS = 14;
/** Days that must pass after the funded account is received before the first request. */
export const MIN_DAYS_BEFORE_FIRST_PAYOUT = 14;

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function calculateWithdrawalCap(initialBalance: number) {
  return Number((finiteNonNegative(initialBalance) * (WITHDRAWAL_CAP_PERCENT / 100)).toFixed(2));
}

/** Smallest realized profit that can be withdrawn: 1% of the initial balance, or $100 on Flex. */
export function calculateMinimumWithdrawal(initialBalance: number, flex = false) {
  if (flex) return FLEX_MIN_WITHDRAWAL_USD;
  return Number((finiteNonNegative(initialBalance) * (MIN_WITHDRAWAL_PERCENT / 100)).toFixed(2));
}

export function calculatePayoutEligibility(input: {
  initialBalance: number;
  currentBalance: number;
  requestedAmount?: number;
  alreadyRequestedInPeriod?: number;
  profitSplitPercent?: number;
  /** Profit that stays on the account but may not be withdrawn (News Trading Rule). */
  nonWithdrawableProfit?: number;
  /** Flex accounts have no per-period withdrawal cap. */
  uncapped?: boolean;
}) {
  const initialBalance = finiteNonNegative(input.initialBalance);
  const grossProfit = Math.max(0, finiteNonNegative(input.currentBalance) - initialBalance);
  const nonWithdrawableProfit = Number(Math.min(grossProfit, finiteNonNegative(input.nonWithdrawableProfit)).toFixed(2));
  const availableProfit = Number(Math.max(0, grossProfit - nonWithdrawableProfit).toFixed(2));
  const withdrawalCap = input.uncapped ? availableProfit : calculateWithdrawalCap(initialBalance);
  const alreadyRequestedInPeriod = finiteNonNegative(input.alreadyRequestedInPeriod);
  const remainingPeriodCap = input.uncapped
    ? availableProfit
    : Number(Math.max(0, withdrawalCap - alreadyRequestedInPeriod).toFixed(2));
  const maximumWithdrawal = Number(Math.min(availableProfit, remainingPeriodCap).toFixed(2));
  const requestedAmount = finiteNonNegative(input.requestedAmount ?? maximumWithdrawal);
  const adjustedAmount = Number(Math.min(requestedAmount, maximumWithdrawal).toFixed(2));
  const profitSplitPercent = input.profitSplitPercent ?? TRADER_PROFIT_SPLIT_PERCENT;
  const traderShare = Number((adjustedAmount * (profitSplitPercent / 100)).toFixed(2));
  const firmShare = Number((adjustedAmount - traderShare).toFixed(2));

  return {
    grossProfit: Number(grossProfit.toFixed(2)),
    nonWithdrawableProfit,
    availableProfit,
    withdrawalCap,
    alreadyRequestedInPeriod,
    remainingPeriodCap,
    maximumWithdrawal,
    requestedAmount,
    adjustedAmount,
    traderShare,
    firmShare,
    excessProfitRemaining: Number(Math.max(0, availableProfit - adjustedAmount).toFixed(2)),
    wasAdjusted: adjustedAmount < requestedAmount,
  };
}

export function getPayoutPeriodStart(accountCreatedAt: string, now = new Date()) {
  const anchor = new Date(accountCreatedAt);
  const anchorMs = Number.isNaN(anchor.getTime()) ? 0 : anchor.getTime();
  const nowMs = now.getTime();
  const periodMs = PAYOUT_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const elapsed = Math.max(0, nowMs - anchorMs);
  return new Date(anchorMs + Math.floor(elapsed / periodMs) * periodMs);
}

/** When the funded account first becomes eligible for a withdrawal request. */
export function getFirstPayoutEligibleAt(fundedAt: string) {
  const start = new Date(fundedAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + MIN_DAYS_BEFORE_FIRST_PAYOUT * 24 * 60 * 60 * 1000);
}
