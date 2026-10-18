export const WITHDRAWAL_CAP_PERCENT = 6;
export const TRADER_PROFIT_SPLIT_PERCENT = 80;
export const PAYOUT_PERIOD_DAYS = 14;

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function calculateWithdrawalCap(initialBalance: number) {
  return Number((finiteNonNegative(initialBalance) * (WITHDRAWAL_CAP_PERCENT / 100)).toFixed(2));
}

export function calculatePayoutEligibility(input: {
  initialBalance: number;
  currentBalance: number;
  requestedAmount?: number;
  alreadyRequestedInPeriod?: number;
  profitSplitPercent?: number;
  /** Profit that stays on the account but may not be withdrawn (News Trading Rule). */
  nonWithdrawableProfit?: number;
}) {
  const initialBalance = finiteNonNegative(input.initialBalance);
  const grossProfit = Math.max(0, finiteNonNegative(input.currentBalance) - initialBalance);
  const nonWithdrawableProfit = Number(Math.min(grossProfit, finiteNonNegative(input.nonWithdrawableProfit)).toFixed(2));
  const availableProfit = Number(Math.max(0, grossProfit - nonWithdrawableProfit).toFixed(2));
  const withdrawalCap = calculateWithdrawalCap(initialBalance);
  const alreadyRequestedInPeriod = finiteNonNegative(input.alreadyRequestedInPeriod);
  const remainingPeriodCap = Number(Math.max(0, withdrawalCap - alreadyRequestedInPeriod).toFixed(2));
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
