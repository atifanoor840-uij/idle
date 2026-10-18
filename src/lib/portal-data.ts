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

export const MODEL_LABEL: Record<PlanModel, string> = { "Two Step": "2-Step", "One Step": "1-Step", Instant: "Instant" };

/** "pp-two-step-100k" / planName "Two Step $100K" → model + size */
export function planInfo(order?: Pick<Order, "planId" | "planName">) {
  const text = `${order?.planName || ""} ${order?.planId || ""}`.toLowerCase();
  const model: PlanModel = text.includes("instant") ? "Instant" : /one[\s-]?step/.test(text) ? "One Step" : "Two Step";
  const m = text.match(/(\d+(?:\.\d+)?)\s*k\b/) || text.match(/\$(\d[\d,]*)/);
  const size = m ? Number(m[1].replace(/,/g, "")) * (/k\b/.test(m[0]) ? 1000 : 1) : 0;
  return { model, size };
}

export type UiAccount = Account & {
  raw: TradingAccount;
  order?: Order;
  model: PlanModel;
  pendingDelivery: boolean;
};

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
  const size = planSize || Math.round(Number(a.balance) || 0);
  const balance = Number(a.balance) || size;
  const equity = Number(a.equity) || balance;

  const rule = getChallengeRule(model, resolveRuleVersion(order));
  const targetPct = getPhaseTargetPercent(rule, a.phase, a.status);
  const dd = getDrawdownLimits(rule, a.phase, a.status, resolveRuleVersion(order));

  const objectives: Objective[] = [];
  if (targetPct > 0) {
    objectives.push({ label: "Profit target", current: Math.max(0, balance - size), target: (size * targetPct) / 100, kind: "target", unit: "$" });
  }
  objectives.push(
    { label: "Daily loss", current: Math.max(0, -(Number(a.todayPl) || 0)), target: (size * dd.dailyDrawdownPercent) / 100, kind: "limit", unit: "$" },
    { label: "Max loss", current: Math.max(0, size - Math.min(balance, equity)), target: (size * dd.overallDrawdownPercent) / 100, kind: "limit", unit: "$" },
  );

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
  };
}

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
