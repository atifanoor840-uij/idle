export type DrawdownSnapshotInput = {
  initialBalance: number;
  balance: number;
  equity: number;
  todayClosedPl: number;
};

function finiteNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

export function exceedsDrawdownLimit(currentLoss: number, limit: number) {
  return currentLoss > limit;
}

export function calculateDrawdownSnapshot(input: DrawdownSnapshotInput) {
  const initialBalance = Math.max(0, finiteNumber(input.initialBalance, 0));
  const balance = finiteNumber(input.balance, initialBalance);
  const equity = finiteNumber(input.equity, balance);
  const todayClosedPl = finiteNumber(input.todayClosedPl, 0);
  const closedDailyLoss = Math.max(0, -todayClosedPl);
  const floatingLoss = Math.max(0, balance - equity);
  const monitoredAccountValue = Math.min(balance, equity);

  return {
    closedDailyLoss,
    floatingLoss,
    currentDailyLoss: closedDailyLoss + floatingLoss,
    currentOverallLoss: Math.max(0, initialBalance - monitoredAccountValue),
    monitoredAccountValue,
  };
}