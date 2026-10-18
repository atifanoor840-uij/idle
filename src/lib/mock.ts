// Mock data for the trader portal. Every export is typed so it can be
// swapped 1:1 for real API calls (e.g. the prop-firm-backend endpoints).

export type Platform = "MT5" | "MT4" | "cTrader" | "Match-Trader";
export type AccountStatus = "Active" | "Passed" | "Breached" | "Pending";
export type Phase = "Phase 1" | "Phase 2" | "Funded";

export interface User {
  name: string;
  initials: string;
  profileCompletion: number; // 0-100
}

export interface Objective {
  label: string;
  current: number;
  target: number;
  kind: "target" | "limit"; // target = fill up to reach; limit = must stay below
  unit: "$" | "days";
}

export interface Account {
  id: string;
  login: string;
  size: number;
  program: string;
  phase: Phase;
  status: AccountStatus;
  platform: Platform;
  balance: number;
  equity: number;
  objectives: Objective[];
}

export interface Offer {
  tag: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
  art: "chart" | "payout" | "trophy";
}

export interface StatItem {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "flat";
}

export interface Quote {
  symbol: string;
  name: string;
  bid: number;
  ask: number;
  dp: number;
  change: number; // percent
}

export interface EconEvent {
  time: string;
  currency: string;
  event: string;
  impact: 1 | 2 | 3;
  actual?: string;
  forecast: string;
  previous: string;
}

export const user: User = { name: "Alex Morgan", initials: "AM", profileCompletion: 60 };

export const offers: Offer[] = [
  {
    tag: "Get evaluated",
    title: "Trade up to $200K\nin simulated capital",
    sub: "Pick a challenge, pass the simulated evaluation and keep up to 90% of your simulated gains.",
    cta: "Start a challenge",
    href: "/challenges",
    art: "chart",
  },
  {
    tag: "Payouts",
    title: "Request payouts\nfrom your dashboard",
    sub: "Funded traders can request a withdrawal every 14 days once KYC is approved.",
    cta: "See payouts",
    href: "/payouts",
    art: "payout",
  },
  {
    tag: "Affiliate",
    title: "Refer traders,\nearn commission",
    sub: "Share your referral link and earn on every challenge your referrals buy.",
    cta: "Get your link",
    href: "/affiliate",
    art: "trophy",
  },
];

export const accounts: Account[] = [
  {
    id: "a1",
    login: "7004182",
    size: 100000,
    program: "2-Step",
    phase: "Phase 1",
    status: "Active",
    platform: "MT5",
    balance: 106240.5,
    equity: 106812.2,
    objectives: [
      { label: "Profit target", current: 6240, target: 8000, kind: "target", unit: "$" },
      { label: "Daily loss", current: 1120, target: 5000, kind: "limit", unit: "$" },
      { label: "Max loss", current: 2300, target: 10000, kind: "limit", unit: "$" },
      { label: "Trading days", current: 4, target: 5, kind: "target", unit: "days" },
    ],
  },
  {
    id: "a2",
    login: "7001975",
    size: 50000,
    program: "1-Step",
    phase: "Funded",
    status: "Active",
    platform: "cTrader",
    balance: 52410.0,
    equity: 52188.4,
    objectives: [
      { label: "Daily loss", current: 640, target: 2000, kind: "limit", unit: "$" },
      { label: "Max loss", current: 3150, target: 4500, kind: "limit", unit: "$" },
    ],
  },
  {
    id: "a3",
    login: "7000811",
    size: 25000,
    program: "2-Step",
    phase: "Phase 2",
    status: "Breached",
    platform: "MT5",
    balance: 22480.0,
    equity: 22480.0,
    objectives: [
      { label: "Profit target", current: 410, target: 1250, kind: "target", unit: "$" },
      { label: "Max loss", current: 2520, target: 2500, kind: "limit", unit: "$" },
    ],
  },
  {
    id: "a4",
    login: "7000342",
    size: 10000,
    program: "2-Step",
    phase: "Phase 1",
    status: "Passed",
    platform: "Match-Trader",
    balance: 10862.3,
    equity: 10862.3,
    objectives: [
      { label: "Profit target", current: 862.3, target: 800, kind: "target", unit: "$" },
      { label: "Max loss", current: 140, target: 1000, kind: "limit", unit: "$" },
      { label: "Trading days", current: 7, target: 5, kind: "target", unit: "days" },
    ],
  },
];

export const stats: StatItem[] = [
  { label: "Total funded", value: "$150,000", delta: "+$50,000 this month", trend: "up" },
  { label: "Total payouts", value: "$8,920.40", delta: "+$2,180.00 last payout", trend: "up" },
  { label: "Active challenges", value: "1", delta: "1 breached this month", trend: "down" },
  { label: "Win rate", value: "58.4%", delta: "+3.1% vs last 30 days", trend: "up" },
];

export const market: { group: string; rows: Quote[] }[] = [
  {
    group: "Forex",
    rows: [
      { symbol: "EURUSD", name: "Euro / US Dollar", bid: 1.08452, ask: 1.08453, dp: 5, change: 0.12 },
      { symbol: "GBPUSD", name: "British Pound / US Dollar", bid: 1.27118, ask: 1.27121, dp: 5, change: -0.07 },
      { symbol: "USDJPY", name: "US Dollar / Japanese Yen", bid: 151.842, ask: 151.846, dp: 3, change: -0.15 },
      { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", bid: 0.66214, ask: 0.66217, dp: 5, change: 0.21 },
    ],
  },
  {
    group: "Indices",
    rows: [
      { symbol: "NAS100", name: "Nasdaq 100", bid: 18245.3, ask: 18246.1, dp: 1, change: 0.31 },
      { symbol: "US30", name: "Dow Jones 30", bid: 39120.5, ask: 39122.0, dp: 1, change: -0.04 },
      { symbol: "GER40", name: "Germany 40", bid: 18011.2, ask: 18012.4, dp: 1, change: 0.18 },
    ],
  },
  {
    group: "Metals",
    rows: [
      { symbol: "XAUUSD", name: "Gold / US Dollar", bid: 2405.12, ask: 2405.24, dp: 2, change: 0.48 },
      { symbol: "XAGUSD", name: "Silver / US Dollar", bid: 28.412, ask: 28.431, dp: 3, change: -0.62 },
    ],
  },
  {
    group: "Crypto",
    rows: [
      { symbol: "BTCUSD", name: "Bitcoin / US Dollar", bid: 64210.5, ask: 64228.0, dp: 1, change: 1.84 },
      { symbol: "ETHUSD", name: "Ethereum / US Dollar", bid: 3122.4, ask: 3124.1, dp: 1, change: -0.93 },
    ],
  },
];

export const calendar: { today: EconEvent[]; week: EconEvent[] } = {
  today: [
    { time: "08:30", currency: "GBP", event: "CPI y/y", impact: 3, actual: "2.3%", forecast: "2.4%", previous: "2.6%" },
    { time: "10:00", currency: "EUR", event: "ZEW Economic Sentiment", impact: 2, actual: "13.1", forecast: "10.4", previous: "9.8" },
    { time: "13:30", currency: "USD", event: "Core Retail Sales m/m", impact: 3, forecast: "0.3%", previous: "0.1%" },
    { time: "15:00", currency: "USD", event: "Business Inventories m/m", impact: 1, forecast: "0.4%", previous: "0.5%" },
    { time: "23:50", currency: "JPY", event: "Trade Balance", impact: 2, forecast: "-0.31T", previous: "-0.46T" },
  ],
  week: [
    { time: "Wed 13:30", currency: "USD", event: "CPI m/m", impact: 3, forecast: "0.2%", previous: "0.3%" },
    { time: "Wed 19:00", currency: "USD", event: "FOMC Meeting Minutes", impact: 3, forecast: "—", previous: "—" },
    { time: "Thu 01:30", currency: "AUD", event: "Employment Change", impact: 3, forecast: "22.4K", previous: "38.5K" },
    { time: "Thu 13:15", currency: "EUR", event: "Main Refinancing Rate", impact: 3, forecast: "4.25%", previous: "4.25%" },
    { time: "Fri 13:30", currency: "USD", event: "Non-Farm Employment Change", impact: 3, forecast: "185K", previous: "175K" },
  ],
};

export const money = (n: number, dp = 2) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: dp, maximumFractionDigits: dp });
