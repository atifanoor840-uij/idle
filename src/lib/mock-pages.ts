// Mock data for the portal's inner pages. Typed for a 1:1 swap with real API calls.
import { accounts, type Account, type EconEvent, type Platform } from "./mock";

export const dateFmt = (iso: string) =>
  new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/* deterministic PRNG so server + client render the same mock numbers */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const seedOf = (str: string) => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7);
const r2 = (n: number) => Math.round(n * 100) / 100;

/* ── Challenges ─────────────────────────────── */
export type Program = "1-Step" | "2-Step" | "Instant";
export const programs: { key: Program; blurb: string }[] = [
  { key: "1-Step", blurb: "One evaluation phase. Hit 10% and get funded." },
  { key: "2-Step", blurb: "Two phases with lower targets and our best price." },
  { key: "Instant", blurb: "Skip the evaluation and trade funded from day one." },
];
export const accountSizes = [5000, 10000, 25000, 50000, 100000, 200000];
export const pricing: Record<Program, number[]> = {
  "1-Step": [59, 99, 199, 299, 499, 949],
  "2-Step": [49, 89, 179, 269, 449, 849],
  Instant: [99, 179, 349, 549, 949, 1799],
};
export const ruleNames = ["Profit target", "Daily loss limit", "Max loss limit", "Min trading days", "Time limit", "Profit split", "Leverage"];
export const programRules: Record<Program, { phase: string; values: string[] }[]> = {
  "1-Step": [
    { phase: "Evaluation", values: ["10%", "4%", "6% (trailing)", "3 days", "Unlimited", "—", "1:100"] },
    { phase: "Funded", values: ["—", "4%", "6% (trailing)", "—", "Unlimited", "Up to 90%", "1:100"] },
  ],
  "2-Step": [
    { phase: "Phase 1", values: ["8%", "5%", "10%", "5 days", "Unlimited", "—", "1:100"] },
    { phase: "Phase 2", values: ["5%", "5%", "10%", "5 days", "Unlimited", "—", "1:100"] },
    { phase: "Funded", values: ["—", "5%", "10%", "—", "Unlimited", "Up to 90%", "1:100"] },
  ],
  Instant: [{ phase: "Funded", values: ["—", "3%", "5% (trailing)", "—", "Unlimited", "Up to 80%", "1:50"] }],
};
export const coupons: Record<string, number> = { GREEN20: 0.2, WELCOME10: 0.1 };
export const platforms: Platform[] = ["MT5", "cTrader", "Match-Trader"];

/* ── Transactions (My Accounts → history) ───── */
export interface Transaction {
  id: string;
  date: string;
  type: "Purchase" | "Payout" | "Refund";
  description: string;
  amount: number;
  status: "Completed" | "Pending" | "Refunded";
}
export const transactions: Transaction[] = [
  { id: "TX-50291", date: "2026-10-09", type: "Payout", description: "Payout · #7001975", amount: 2180, status: "Completed" },
  { id: "TX-50188", date: "2026-10-02", type: "Purchase", description: "2-Step Challenge · $100K", amount: -449, status: "Completed" },
  { id: "TX-49920", date: "2026-09-21", type: "Payout", description: "Payout · #7001975", amount: 1740.4, status: "Completed" },
  { id: "TX-49512", date: "2026-09-04", type: "Purchase", description: "2-Step Challenge · $10K", amount: -89, status: "Completed" },
  { id: "TX-49101", date: "2026-08-18", type: "Purchase", description: "2-Step Challenge · $25K", amount: -179, status: "Completed" },
  { id: "TX-48877", date: "2026-08-02", type: "Refund", description: "Fee refund · first payout", amount: 299, status: "Refunded" },
  { id: "TX-48410", date: "2026-07-11", type: "Purchase", description: "1-Step Challenge · $50K", amount: -299, status: "Completed" },
];

/* ── Trades ─────────────────────────────────── */
export interface Trade {
  id: string;
  login: string;
  symbol: string;
  side: "Buy" | "Sell";
  lots: number;
  openTime: string;
  closeTime?: string;
  openPrice: number;
  closePrice?: number;
  pnl: number;
  dp: number;
}
const SYMS: [string, number, number][] = [
  ["EURUSD", 1.084, 5],
  ["GBPUSD", 1.271, 5],
  ["XAUUSD", 2398, 2],
  ["NAS100", 18200, 1],
  ["USDJPY", 151.6, 3],
  ["US30", 39050, 1],
];
const iso = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
function makeTrades(login: string, count: number): Trade[] {
  const r = rng(seedOf(login));
  const out: Trade[] = [];
  for (let i = 0; i < count; i++) {
    const [symbol, base, dp] = SYMS[Math.floor(r() * SYMS.length)];
    const side = r() > 0.45 ? "Buy" : "Sell";
    const lots = r2(0.2 + r() * 2.8);
    const day = Date.UTC(2026, 8, 14 + Math.floor((i * 29) / count));
    const open = new Date(day + (7 + Math.floor(r() * 10)) * 3600e3 + Math.floor(r() * 59) * 60e3);
    const close = new Date(open.getTime() + (20 + Math.floor(r() * 400)) * 60e3);
    const openPrice = base * (1 + (r() - 0.5) * 0.01);
    const move = (r() - 0.42) * base * 0.004;
    const closePrice = openPrice + (side === "Buy" ? move : -move);
    const f = 10 ** dp;
    out.push({
      id: `${login}-${i}`,
      login,
      symbol,
      side,
      lots,
      openTime: iso(open),
      closeTime: iso(close),
      openPrice: Math.round(openPrice * f) / f,
      closePrice: Math.round(closePrice * f) / f,
      pnl: r2((move / base) * lots * 100000),
      dp,
    });
  }
  return out.reverse();
}
export const closedTrades: Trade[] = accounts.flatMap((a) => makeTrades(a.login, a.status === "Breached" ? 14 : 22));
export const openPositions: Trade[] = [
  { id: "op1", login: "7004182", symbol: "XAUUSD", side: "Buy", lots: 1.2, openTime: "2026-10-14 08:12", openPrice: 2398.4, pnl: 811.2, dp: 2 },
  { id: "op2", login: "7004182", symbol: "EURUSD", side: "Sell", lots: 2.0, openTime: "2026-10-14 09:40", openPrice: 1.08571, pnl: -239.5, dp: 5 },
  { id: "op3", login: "7001975", symbol: "NAS100", side: "Buy", lots: 0.5, openTime: "2026-10-13 15:02", openPrice: 18190.1, pnl: -221.6, dp: 1 },
];

/* ── Account details ────────────────────────── */
export interface DayPnl {
  date: string; // YYYY-MM-DD
  pnl: number;
  trades: number;
}
export function accountHistory(a: Account) {
  const raw = closedTrades.filter((t) => t.login === a.login);
  const rawTotal = raw.reduce((s, t) => s + t.pnl, 0) || 1;
  const k = (a.balance - a.size) / rawTotal; // scale so the curve ends at the real balance
  const trades = raw.map((t) => ({ ...t, pnl: r2(t.pnl * k) }));

  const byDay = new Map<string, DayPnl>();
  for (const t of trades) {
    const d = t.closeTime!.slice(0, 10);
    const cur = byDay.get(d) ?? { date: d, pnl: 0, trades: 0 };
    cur.pnl = r2(cur.pnl + t.pnl);
    cur.trades++;
    byDay.set(d, cur);
  }
  const days = [...byDay.values()].sort((x, y) => x.date.localeCompare(y.date));
  let bal = a.size;
  const curve = [{ date: "Start", balance: a.size }];
  for (const d of days) {
    bal = r2(bal + d.pnl);
    curve.push({ date: d.date.slice(5), balance: bal });
  }

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const sum = (xs: Trade[]) => xs.reduce((s, t) => s + t.pnl, 0);
  const stats = {
    trades: trades.length,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWin: wins.length ? sum(wins) / wins.length : 0,
    avgLoss: losses.length ? sum(losses) / losses.length : 0,
    profitFactor: sum(losses) !== 0 ? Math.abs(sum(wins) / sum(losses)) : 0,
    lots: trades.reduce((s, t) => s + t.lots, 0),
    best: Math.max(0, ...trades.map((t) => t.pnl)),
    worst: Math.min(0, ...trades.map((t) => t.pnl)),
  };
  return { days, curve, trades, stats };
}

/* ── Payouts ────────────────────────────────── */
export const kycStatus = "Pending" as "Not started" | "Pending" | "Approved";
export const payoutEligibility = { nextDate: "2026-10-21", split: 90, withdrawable: 2169.0, login: "7001975" };
export interface PayoutMethod {
  id: string;
  name: string;
  time: string;
  fee: string;
  min: string;
  needsKyc: boolean;
}
export const payoutMethods: PayoutMethod[] = [
  { id: "usdt", name: "Crypto · USDT (TRC20)", time: "Instant", fee: "Free", min: "$50", needsKyc: false },
  { id: "usdc", name: "Crypto · USDC (ERC20)", time: "Within 1 hour", fee: "Network fee", min: "$50", needsKyc: false },
  { id: "bank", name: "Bank Transfer", time: "1–3 business days", fee: "Free", min: "$100", needsKyc: true },
  { id: "rise", name: "Rise", time: "Within 24 hours", fee: "Free", min: "$50", needsKyc: true },
];
export interface PayoutRow {
  id: string;
  date: string;
  login: string;
  method: string;
  amount: number;
  status: "Paid" | "Pending" | "Rejected";
}
export const payoutHistory: PayoutRow[] = [
  { id: "PO-3021", date: "2026-10-09", login: "7001975", method: "USDT (TRC20)", amount: 2180, status: "Paid" },
  { id: "PO-2874", date: "2026-09-21", login: "7001975", method: "USDT (TRC20)", amount: 1740.4, status: "Paid" },
  { id: "PO-2610", date: "2026-09-05", login: "7001975", method: "Bank Transfer", amount: 900, status: "Rejected" },
  { id: "PO-2433", date: "2026-08-22", login: "7001975", method: "USDT (TRC20)", amount: 5000, status: "Paid" },
];

/* ── Billing ────────────────────────────────── */
export interface Order {
  id: string;
  date: string;
  product: string;
  amount: number;
  method: string;
  status: "Paid" | "Pending" | "Refunded";
}
export const orders: Order[] = [
  { id: "INV-10234", date: "2026-10-02", product: "2-Step Challenge · $100K", amount: 449, method: "Visa •••• 4242", status: "Paid" },
  { id: "INV-10111", date: "2026-09-04", product: "2-Step Challenge · $10K", amount: 89, method: "USDT", status: "Paid" },
  { id: "INV-09987", date: "2026-08-18", product: "2-Step Challenge · $25K", amount: 179, method: "Visa •••• 4242", status: "Paid" },
  { id: "INV-09870", date: "2026-08-14", product: "Reset · $25K", amount: 99, method: "USDT", status: "Pending" },
  { id: "INV-09544", date: "2026-07-11", product: "1-Step Challenge · $50K", amount: 299, method: "Mastercard •••• 8812", status: "Refunded" },
];

/* ── Certificates ───────────────────────────── */
export interface Certificate {
  id: string;
  type: "Funded Trader" | "Payout" | "Phase Passed";
  title: string;
  amount: number;
  date: string;
  login: string;
}
export const certificates: Certificate[] = [
  { id: "c1", type: "Payout", title: "Payout Certificate", amount: 2180, date: "2026-10-09", login: "7001975" },
  { id: "c2", type: "Payout", title: "Payout Certificate", amount: 1740.4, date: "2026-09-21", login: "7001975" },
  { id: "c3", type: "Phase Passed", title: "Phase 1 Passed", amount: 10000, date: "2026-09-30", login: "7000342" },
  { id: "c4", type: "Funded Trader", title: "Funded Trader", amount: 50000, date: "2026-08-01", login: "7001975" },
];

/* ── Economic calendar (full week) ──────────── */
export const calendarWeek: (EconEvent & { day: string })[] = [
  { day: "Mon", time: "01:30", currency: "AUD", event: "Retail Sales m/m", impact: 2, actual: "0.4%", forecast: "0.3%", previous: "0.5%" },
  { day: "Mon", time: "10:00", currency: "EUR", event: "Industrial Production m/m", impact: 1, actual: "-0.2%", forecast: "0.1%", previous: "0.3%" },
  { day: "Mon", time: "15:00", currency: "USD", event: "ISM Services PMI", impact: 3, actual: "52.1", forecast: "51.6", previous: "51.4" },
  { day: "Tue", time: "08:30", currency: "GBP", event: "CPI y/y", impact: 3, actual: "2.3%", forecast: "2.4%", previous: "2.6%" },
  { day: "Tue", time: "10:00", currency: "EUR", event: "ZEW Economic Sentiment", impact: 2, actual: "13.1", forecast: "10.4", previous: "9.8" },
  { day: "Tue", time: "13:30", currency: "USD", event: "Core Retail Sales m/m", impact: 3, forecast: "0.3%", previous: "0.1%" },
  { day: "Tue", time: "23:50", currency: "JPY", event: "Trade Balance", impact: 2, forecast: "-0.31T", previous: "-0.46T" },
  { day: "Wed", time: "13:30", currency: "USD", event: "CPI m/m", impact: 3, forecast: "0.2%", previous: "0.3%" },
  { day: "Wed", time: "15:30", currency: "USD", event: "Crude Oil Inventories", impact: 2, forecast: "-1.2M", previous: "2.4M" },
  { day: "Wed", time: "19:00", currency: "USD", event: "FOMC Meeting Minutes", impact: 3, forecast: "—", previous: "—" },
  { day: "Thu", time: "01:30", currency: "AUD", event: "Employment Change", impact: 3, forecast: "22.4K", previous: "38.5K" },
  { day: "Thu", time: "13:15", currency: "EUR", event: "Main Refinancing Rate", impact: 3, forecast: "4.25%", previous: "4.25%" },
  { day: "Thu", time: "13:30", currency: "USD", event: "Unemployment Claims", impact: 2, forecast: "221K", previous: "218K" },
  { day: "Fri", time: "07:00", currency: "GBP", event: "GDP m/m", impact: 2, forecast: "0.1%", previous: "0.0%" },
  { day: "Fri", time: "13:30", currency: "USD", event: "Non-Farm Employment Change", impact: 3, forecast: "185K", previous: "175K" },
  { day: "Fri", time: "13:30", currency: "CAD", event: "Employment Change", impact: 2, forecast: "18.0K", previous: "22.1K" },
];

/* ── Downloads ──────────────────────────────── */
export const downloads: { name: Platform; desc: string; os: string[] }[] = [
  { name: "MT5", desc: "The industry-standard terminal with Expert Advisors, custom indicators and one-click trading.", os: ["Windows", "macOS", "Android", "iOS", "Web"] },
  { name: "cTrader", desc: "Depth of market, advanced order types and a clean, modern interface.", os: ["Windows", "Android", "iOS", "Web"] },
  { name: "MT4", desc: "The classic MetaTrader 4 terminal, with the EAs and indicators you already use.", os: ["Windows", "MAC", "Android", "iOS"] },
];

/* ── Affiliate ──────────────────────────────── */
export const affiliate = {
  link: "https://idle4ex.com/r/ALEX24",
  clicks: 1284,
  signups: 96,
  sales: 37,
  commission: 1912.6,
  balance: 486.2,
  minPayout: 100,
  tiers: [
    { name: "Bronze", rate: 10, minSales: 0 },
    { name: "Silver", rate: 12.5, minSales: 25 },
    { name: "Gold", rate: 15, minSales: 100 },
  ],
};
export const referrals: { user: string; date: string; product: string; amount: number; commission: number; status: "Paid" | "Pending" }[] = [
  { user: "m•••••@gmail.com", date: "2026-10-12", product: "2-Step · $50K", amount: 269, commission: 33.63, status: "Pending" },
  { user: "k•••@outlook.com", date: "2026-10-10", product: "1-Step · $100K", amount: 499, commission: 62.38, status: "Pending" },
  { user: "j••••@proton.me", date: "2026-10-03", product: "2-Step · $10K", amount: 89, commission: 11.13, status: "Paid" },
  { user: "s••••••@gmail.com", date: "2026-09-27", product: "Instant · $25K", amount: 349, commission: 43.63, status: "Paid" },
  { user: "a•••@yahoo.com", date: "2026-09-19", product: "2-Step · $200K", amount: 849, commission: 106.13, status: "Paid" },
];

/* ── Leaderboard ────────────────────────────── */
export interface Leader {
  rank: number;
  name: string;
  country: string;
  size: number;
  profit: number;
  gain: number;
}
export const leaderboard: Leader[] = [
  { rank: 1, name: "Daniel K.", country: "DE", size: 200000, profit: 38420.5, gain: 19.21 },
  { rank: 2, name: "Priya S.", country: "IN", size: 100000, profit: 17640.0, gain: 17.64 },
  { rank: 3, name: "Marco R.", country: "IT", size: 200000, profit: 31210.8, gain: 15.61 },
  { rank: 4, name: "Hamza A.", country: "PK", size: 50000, profit: 7420.2, gain: 14.84 },
  { rank: 5, name: "Lucía F.", country: "ES", size: 100000, profit: 13980.0, gain: 13.98 },
  { rank: 6, name: "Tom W.", country: "GB", size: 25000, profit: 3300.4, gain: 13.2 },
  { rank: 7, name: "Kenji M.", country: "JP", size: 100000, profit: 12110.0, gain: 12.11 },
  { rank: 8, name: "Amara O.", country: "NG", size: 50000, profit: 5905.6, gain: 11.81 },
  { rank: 9, name: "Leo B.", country: "FR", size: 200000, profit: 22800.0, gain: 11.4 },
  { rank: 10, name: "Sara L.", country: "AE", size: 10000, profit: 1102.9, gain: 11.03 },
  { rank: 11, name: "Ivan P.", country: "PL", size: 50000, profit: 5320.0, gain: 10.64 },
  { rank: 12, name: "Chen Y.", country: "SG", size: 100000, profit: 10050.0, gain: 10.05 },
];
export const leaderboardAllTime: Leader[] = leaderboard
  .map((l, i) => ({ ...l, profit: r2(l.profit * (3.2 - i * 0.12)), gain: r2(l.gain * (3.1 - i * 0.1)) }))
  .sort((a, b) => b.gain - a.gain)
  .map((l, i) => ({ ...l, rank: i + 1 }));

/* ── Competitions ───────────────────────────── */
export interface Competition {
  id: string;
  name: string;
  status: "Live" | "Upcoming" | "Ended";
  start: string;
  end: string;
  prizePool: number;
  participants: number;
  account: string;
  prizes: string[];
  joined: boolean;
}
export const competitions: Competition[] = [
  {
    id: "oct",
    name: "October Trading Cup",
    status: "Live",
    start: "2026-10-01",
    end: "2026-10-31",
    prizePool: 50000,
    participants: 2841,
    account: "$100K demo",
    prizes: ["1st: $200K funded account", "2nd: $100K funded account", "3rd: $50K funded account", "4th–10th: free $25K challenge"],
    joined: true,
  },
  {
    id: "nov",
    name: "November Gold Rush",
    status: "Upcoming",
    start: "2026-11-03",
    end: "2026-11-28",
    prizePool: 30000,
    participants: 612,
    account: "$50K demo · XAUUSD only",
    prizes: ["1st: $100K funded account", "2nd: $50K funded account", "3rd: $25K funded account"],
    joined: false,
  },
  {
    id: "sep",
    name: "September Sprint",
    status: "Ended",
    start: "2026-09-01",
    end: "2026-09-30",
    prizePool: 40000,
    participants: 3302,
    account: "$100K demo",
    prizes: ["Winner: Daniel K. (+24.8%)"],
    joined: true,
  },
];
export const competitionStandings = { yourRank: 214, yourGain: 3.42, top: leaderboard.slice(0, 5) };

/* ── Settings ───────────────────────────────── */
export const sessions = [
  { device: "Chrome · Windows 11", location: "Lahore, PK", lastActive: "Active now", current: true },
  { device: "Safari · iPhone 15", location: "Lahore, PK", lastActive: "2 hours ago", current: false },
  { device: "Edge · Windows 10", location: "Dubai, AE", lastActive: "Oct 2, 2026", current: false },
];
