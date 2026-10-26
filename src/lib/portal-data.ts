"use client";
// Client data layer for the trader portal: a tiny fetch hook plus the adapter
// that turns API trading accounts into the UI's Account shape.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, goToSignin, type Order, type PlanModel, type TradingAccount } from "./propApi";
import type { Account, AccountStatus, Objective, Phase } from "./mock";
import { getChallengeRule, getDrawdownLimits, getPhaseTargetPercent, resolveRuleVersion } from "./rulebook";

export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = [], onUnauthorized: () => void = goToSignin) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fnRef.current());
      setError("");
    } catch (e) {
      // 401 = signed out; 403 here means the session is not allowed in this area.
      if (e instanceof ApiError && (e.status === 401 || (e.status === 403 && onUnauthorized !== goToSignin))) return onUnauthorized();
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), deps);
  return { data, error, loading, reload: load };
}

export const MODEL_LABEL: Record<PlanModel, string> = { "Two Step": "2-Step", "One Step": "1-Step", Instant: "Instant", Flex: "Flex" };

/** "pp-two-step-100k" / planName "Two Step $100K" → model + size */
export function planInfo(order?: Pick<Order, "planId" | "planName">) {
  const text = `${order?.planName || ""} ${order?.planId || ""}`.toLowerCase();
  const model: PlanModel = text.includes("instant")
    ? "Instant"
    : text.includes("flex")
      ? "Flex"
      : /one[\s-]?step/.test(text)
        ? "One Step"
        : "Two Step";
  const m = text.match(/(\d+(?:\.\d+)?)\s*k\b/) || text.match(/\$(\d[\d,]*)/);
  const size = m ? Number(m[1].replace(/,/g, "")) * (/k\b/.test(m[0]) ? 1000 : 1) : 0;
  return { model, size };
}

export type RuleCheck = {
  id: string;
  label: string;
  status: "passed" | "pending" | "warning" | "failed";
  info: string;
  severity?: "hard" | "soft" | "info";
};
export type RuleAlert = { id: string; title: string; message: string; type: "warning" | "error" | "success" | "info" };

/** Rule-engine output the API merges onto each account (see accountCompliance.ts). */
export type AccountRules = {
  checks: RuleCheck[];
  alerts: RuleAlert[];
  fundedAccount: boolean;
  minDays: number;
  winningDays: number;
  winningDayThreshold: number;
  cycleStart: string | null;
  lastTradeAt: string | null;
  inactivityDaysLeft: number | null;
  lossFloor: number;
  trailing: boolean;
  newsProfitToDeduct: number;
  flexReducedSplit: boolean;
  paidPayoutCount: number;
  scaling: { steps: number; payoutsTowardNext: number; scaledSize: number; nextScaledSize: number } | null;
  legacy: boolean;
};

export type UiAccount = Account & {
  raw: TradingAccount;
  order?: Order;
  model: PlanModel;
  pendingDelivery: boolean;
  rules: AccountRules;
};

const fin = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function readRules(a: TradingAccount, fallbackFloor: number): AccountRules {
  return {
    checks: Array.isArray(a.ruleChecks) ? (a.ruleChecks as RuleCheck[]) : [],
    alerts: Array.isArray(a.ruleAlerts) ? (a.ruleAlerts as RuleAlert[]) : [],
    fundedAccount: Boolean(a.fundedAccount),
    minDays: fin(a.minTradingDays) ?? 0,
    winningDays: fin(a.currentTradingDays) ?? 0,
    winningDayThreshold: fin(a.winningDayThreshold) ?? 0,
    cycleStart: typeof a.cycleStart === "string" ? a.cycleStart : null,
    lastTradeAt: typeof a.lastTradeAt === "string" ? a.lastTradeAt : null,
    inactivityDaysLeft: fin(a.inactivityDaysLeft) ?? null,
    lossFloor: fin(a.lossFloor) ?? fallbackFloor,
    trailing: a.drawdownModel === "trailing",
    newsProfitToDeduct: fin(a.newsProfitToDeduct) ?? 0,
    flexReducedSplit: Boolean(a.flexReducedSplit),
    paidPayoutCount: fin(a.paidPayoutCount) ?? 0,
    scaling: (a.scaling as AccountRules["scaling"]) ?? null,
    legacy: Boolean(a.legacyRules),
  };
}

function uiPhase(a: TradingAccount): Phase {
  const p = String(a.phase || "");
  if (a.status === "Funded" || /funded/i.test(p)) return "Funded";
  if (/phase\s*2/i.test(p)) return "Phase 2";
  return "Phase 1";
}

function uiStatus(a: TradingAccount): AccountStatus {
  if (a.deliveryStatus === "pending") return "Pending";
  if (a.status === "Failed") return "Breached";
  if (a.status === "Passed") return "Passed";
  return "Active";
}

export function toUiAccount(a: TradingAccount, orders: Order[]): UiAccount {
  const order = orders.find((o) => o.id === a.orderId);
  const { model, size: planSize } = planInfo(order);
  const size = planSize || fin(a.size) || Math.round(Number(a.balance) || 0);
  const balance = Number(a.balance) || size;
  const equity = Number(a.equity) || balance;

  const rule = getChallengeRule(model, resolveRuleVersion(order));
  const targetPct = getPhaseTargetPercent(rule, a.phase, a.status);
  const dd = getDrawdownLimits(rule, a.phase, a.status, resolveRuleVersion(order));

  // Prefer the rule engine's numbers (closed + floating daily loss, the Flex trailing
  // floor); fall back to the plan constants when the API has not evaluated the account.
  const target = fin(a.target) ?? (size * targetPct) / 100;
  const dailyLimit = fin(a.dailyLossLimit) ?? (size * dd.dailyDrawdownPercent) / 100;
  const maxLimit = fin(a.maxDrawdown) ?? (size * dd.overallDrawdownPercent) / 100;
  const objectives: Objective[] = [];
  if (targetPct > 0 && target > 0) {
    objectives.push({ label: `Profit target (${targetPct}%)`, current: Math.max(0, balance - size), target, kind: "target", unit: "$" });
  }
  objectives.push(
    {
      label: `Max daily drawdown (${dd.dailyDrawdownPercent}%)`,
      current: fin(a.currentDailyLoss) ?? Math.max(0, -(Number(a.todayPl) || 0)),
      target: dailyLimit,
      kind: "limit",
      unit: "$",
    },
    {
      label: `Max loss (${dd.overallDrawdownPercent}%${rule.drawdownModel === "trailing" ? " trailing" : ""})`,
      current: fin(a.currentMaxDrawdown) ?? Math.max(0, size - Math.min(balance, equity)),
      target: maxLimit,
      kind: "limit",
      unit: "$",
    },
  );
  const rules = readRules(a, size - maxLimit);

  const pendingDelivery = a.deliveryStatus === "pending";
  return {
    id: a.id,
    login: pendingDelivery ? "Pending" : a.login,
    size,
    program: MODEL_LABEL[model],
    phase: uiPhase(a),
    status: uiStatus(a),
    platform: a.platform as Account["platform"],
    balance,
    equity,
    objectives,
    raw: a,
    order,
    model,
    pendingDelivery,
    rules,
  };
}

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
