// Admin-only API calls used by the CRM (/admin). Same /api routes as the trader
// portal; the server returns everyone's data (plus userName/userEmail) for admins.
import { ApiError, type Order, type Payout, type PricingPlan, type TradingAccount, type User } from "./propApi";

export type AdminOrder = Order & { userName?: string; userEmail?: string };
export type AdminAccount = TradingAccount & { userName?: string; userEmail?: string };
export type AdminPayout = Payout & { userName?: string; userEmail?: string; approvedBy?: string; approvedAt?: string };
export type AdminKyc = {
  userId: string; documentType: string; frontUrl: string; backUrl: string; selfieUrl: string; addressUrl: string;
  status: "pending" | "approved" | "rejected" | "needs_review"; rejectReason?: string; updatedAt: string;
  userName?: string; userEmail?: string;
};
export type AdminCoupon = { code: string; discountPercent: number; status: string; expiresAt?: string; isExpired?: boolean; createdAt?: string };
export type InventoryItem = {
  id: string; platform: "MT4" | "MT5" | "cTrader"; size: number; login: string; password: string; server: string;
  externalStatisticsId?: string; graphLink?: string; status: "available" | "delivered"; orderId?: string; createdAt?: string;
};
export type AuditLog = { id: string; userId: string; userName: string; targetId: string; targetType: string; action: string; description: string; createdAt: string };

/** Redirect to the admin sign-in when the session is gone or not an admin. */
export function goToAdminSignin() {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  window.location.href = `/auth/admin?next=${encodeURIComponent(next)}`;
}

async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    credentials: "include",
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  return data as T;
}
const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, json: unknown) => request<T>(p, { method: "POST", json });
const put = <T>(p: string, json: unknown) => request<T>(p, { method: "PUT", json });
const del = <T>(p: string) => request<T>(p, { method: "DELETE" });
const q = (k: string, v: string) => `?${k}=${encodeURIComponent(v)}`;
/** Newest first by createdAt; rows without a date sink to the bottom. */
const newest = <T extends { createdAt?: string }>(rows: T[]) =>
  [...rows].sort((a, b) => (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0));

export const crm = {
  signin: (email: string, password: string) => post<{ user: User }>("/api/auth/crm/signin", { email, password }),
  users: {
    list: () => get<{ users: User[] }>("/api/users").then((r) => ({ users: newest(r.users) })),
    update: (b: { userId: string; name?: string; email?: string; phone?: string; country?: string; role?: User["role"]; status?: User["status"]; newPassword?: string }) =>
      put<{ user: User }>("/api/users", b),
    impersonate: (userId: string) => post<{ user: User }>("/api/auth/crm/impersonate", { userId }),
  },
  orders: {
    list: () => get<{ orders: AdminOrder[] }>("/api/orders").then((r) => ({ orders: newest(r.orders) })),
    setStatus: (orderId: string, status: string) => put<{ order: AdminOrder }>("/api/orders", { orderId, status }),
    setLegacyRules: (orderId: string, legacyRules: boolean) => put<{ order: AdminOrder }>("/api/orders", { orderId, legacyRules }),
    remove: (id: string) => del<{ removedAccounts: number }>(`/api/orders${q("id", id)}`),
    paymentProof: (orderId: string) => get<{ url: string; walletId: string; txid: string }>(`/api/orders/manual-payment${q("orderId", orderId)}`),
  },
  accounts: {
    list: () => get<{ accounts: AdminAccount[] }>("/api/accounts").then((r) => ({ accounts: newest(r.accounts) })),
    save: (b: {
      id: string; platform: string; login: string; passwordMaster: string; server: string; passwordInvestor?: string;
      graphLink?: string; externalStatisticsId?: string; inventoryItemId?: string; status?: TradingAccount["status"];
      balance?: number; equity?: number; todayPl?: number; totalPl?: number; profitTarget?: number; phase?: string;
      orderId?: string; userId?: string;
    }) => put<{ account: AdminAccount }>("/api/accounts", b),
    remove: (id: string) => del(`/api/accounts${q("id", id)}`),
    refreshStats: (accountId: string) => post<{ account: AdminAccount; error?: string }>("/api/accounts/refresh-stats", { accountId }),
  },
  payouts: {
    list: () => get<{ payouts: AdminPayout[] }>("/api/payouts").then((r) => ({ payouts: newest(r.payouts) })),
    review: (payoutId: string, status: Payout["status"], notes?: string) => put<{ payout: AdminPayout }>("/api/payouts", { payoutId, status, notes }),
  },
  kyc: {
    list: () => get<{ kyc: AdminKyc[] }>("/api/kyc"),
    review: (userId: string, status: AdminKyc["status"], rejectReason?: string) => put<{ kyc: AdminKyc }>("/api/kyc", { userId, status, rejectReason }),
    sync: (userId: string) => post<{ kyc: AdminKyc }>("/api/kyc", { method: "didit-sync", userId }),
  },
  pricing: {
    list: () => get<{ plans: PricingPlan[] }>("/api/pricing-plans"),
    save: (b: { model: string; size: number; price: number; upfrontPrice?: number; status?: string }) => post<{ plan: PricingPlan }>("/api/pricing-plans", b),
    remove: (id: string) => del(`/api/pricing-plans${q("id", id)}`),
  },
  coupons: {
    list: () => get<{ coupons: AdminCoupon[] }>("/api/coupons"),
    save: (b: { code: string; discountPercent: number; status?: string; expiresAt?: string }) => post<{ coupon: AdminCoupon }>("/api/coupons", b),
    remove: (code: string) => del(`/api/coupons${q("code", code)}`),
  },
  inventory: {
    list: () => get<{ plans: InventoryItem[] }>("/api/challenge-inventory"),
    add: (b: { platform: string; size: number; login: string; password: string; server: string; externalStatisticsId?: string; graphLink?: string }) =>
      post<{ plan: InventoryItem }>("/api/challenge-inventory", b),
    remove: (id: string) => del(`/api/challenge-inventory${q("id", id)}`),
  },
  audit: () => get<{ logs: AuditLog[] }>("/api/audit-logs"),
};
