import { statisticsUtcDay } from "./statisticsTime";

type PerformanceRow = Record<string, any>;

export type PerformancePoint = {
  name: string;
  date: string;
  dailyProfit: number;
  cumulativeProfit: number;
  balance: number;
  equity: number;
  drawdown: number;
};

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstFinite(...values: unknown[]) {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export function getStatisticsTrades(payload: any): any[] {
  const rows =
    payload?.statistics?.advanced_statistics?.charts?.recent_trades_duration;
  return Array.isArray(rows) ? rows : [];
}

export function getTodayClosedLoss(
  payload: any,
  fallbackTodayClosedPl = 0,
  now = new Date(),
) {
  const utcDate = now.toISOString().slice(0, 10);
  const closedTrades = getStatisticsTrades(payload).filter(
    (trade) => statisticsUtcDay(trade?.close_time ?? trade?.closed_at ?? trade?.closeTime) === utcDate,
  );

  if (closedTrades.length === 0) {
    return Math.max(0, -Number(fallbackTodayClosedPl || 0));
  }

  // The day's NET closed result, not the sum of its losing trades. Summing losses in
  // isolation reports a trader who lost $5,000 and made $6,000 today as $5,000 down
  // and can hard-breach a day that actually finished in profit. It also disagreed with
  // the fallback above, which has always used the net figure.
  const netClosedPl = closedTrades.reduce((sum, trade) => {
    return sum + (firstFinite(trade?.net_profit, trade?.profit, trade?.pnl) ?? 0);
  }, 0);
  return roundMoney(Math.max(0, -netClosedPl));
}

export function buildPerformanceSeries(input: {
  payload: any;
  initialBalance: number;
  currentBalance: number;
  currentEquity: number;
  currentTotalProfit?: number;
}): PerformancePoint[] {
  const initialBalance = Number(input.initialBalance) || 0;
  const currentBalance = Number(input.currentBalance) || initialBalance;
  const currentEquity = Number(input.currentEquity) || currentBalance;
  const rows = input.payload?.statistics?.equity_curve?.daily_performance;

  if (!Array.isArray(rows) || rows.length === 0) return [];

  const sortedRows = [...rows].sort((left, right) =>
    String(left?.date ?? "").localeCompare(String(right?.date ?? "")),
  );
  let previousCumulativeProfit = 0;
  let peakValue = initialBalance;

  const points = sortedRows.map((row: PerformanceRow, index) => {
    const date = String(row?.date ?? `Day ${index + 1}`);
    const suppliedCumulativeProfit = firstFinite(
      row?.cumulative_profit,
      row?.cumulative_pnl,
    );
    const suppliedDailyProfit = firstFinite(
      row?.daily_profit,
      row?.net_profit,
      row?.profit,
      row?.pnl,
      row?.net_pnl,
    );
    const dailyProfit =
      suppliedDailyProfit ??
      (suppliedCumulativeProfit !== undefined
        ? suppliedCumulativeProfit - previousCumulativeProfit
        : 0);
    const cumulativeProfit =
      suppliedCumulativeProfit ?? previousCumulativeProfit + dailyProfit;
    const balance =
      firstFinite(row?.cumulative_balance, row?.balance) ??
      initialBalance + cumulativeProfit;
    const equity =
      firstFinite(row?.cumulative_equity, row?.equity) ?? balance;
    const monitoredValue = Math.min(balance, equity);
    peakValue = Math.max(peakValue, monitoredValue);
    const suppliedDrawdown = firstFinite(
      row?.drawdown,
      row?.drawdown_amount,
      row?.max_drawdown,
    );
    const drawdown =
      suppliedDrawdown !== undefined
        ? -Math.abs(suppliedDrawdown)
        : Math.min(0, monitoredValue - peakValue);

    previousCumulativeProfit = cumulativeProfit;

    return {
      name: date,
      date,
      dailyProfit: roundMoney(dailyProfit),
      cumulativeProfit: roundMoney(cumulativeProfit),
      balance: roundMoney(balance),
      equity: roundMoney(equity),
      drawdown: roundMoney(drawdown),
    };
  });

  const last = points[points.length - 1];
  const liveCumulativeProfit =
    firstFinite(input.currentTotalProfit) ?? currentBalance - initialBalance;
  const liveMonitoredValue = Math.min(currentBalance, currentEquity);
  peakValue = Math.max(peakValue, liveMonitoredValue);
  const livePoint: PerformancePoint = {
    name: "Current",
    date: "Current",
    dailyProfit: 0,
    cumulativeProfit: roundMoney(liveCumulativeProfit),
    balance: roundMoney(currentBalance),
    equity: roundMoney(currentEquity),
    drawdown: roundMoney(Math.min(0, liveMonitoredValue - peakValue)),
  };

  if (
    last.balance !== livePoint.balance ||
    last.equity !== livePoint.equity ||
    last.cumulativeProfit !== livePoint.cumulativeProfit
  ) {
    points.push(livePoint);
  }

  return points;
}
