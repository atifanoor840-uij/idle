// Typed browser client for the backend (/api/*). Same origin, cookie session.
// Errors throw ApiError; a 401 anywhere sends the trader back to sign-in.

export type Role = "trader" | "admin" | "support" | "affiliate" | "collaborator";
export type User = {
  id: string; name: string; email: string; phone: string; country: string;
  role: Role; status: "active" | "suspended" | "banned";
  emailVerified?: boolean; referredBy?: string; createdAt: string;
};
export type PlanModel = "One Step" | "Two Step" | "Instant" | "Flex";
/** Flex: `price` is the real price, `upfrontPrice` what is paid at checkout. */
export type PricingPlan = { id: string; model: PlanModel; size: number; price: number; upfrontPrice?: number | null; status: string };
export type Order = {
  id: string; userId: string; planId: string; couponUsed: string; amountPaid: number;
  referralBalanceApplied?: number; weekendHoldingAddon?: boolean; overnightHoldingAddon?: boolean; legacyRules?: boolean;
  activationFee?: number | null; parentOrderId?: string | null;
  paymentMethod: string; status: string; gatewayRef: string; createdAt: string; updatedAt: string;
  planName?: string;
};
export type TradingAccount = {
  id: string; userId: string; orderId: string; platform: string; login: string;
  passwordMaster: string; passwordInvestor: string; server: string; profitTarget: number;
  balance: number; equity: number; todayPl: number; totalPl: number;
  status: "Active" | "Passed" | "Failed" | "Funded"; phase?: string; graphLink: string; externalStatisticsId?: string;
  weekendHoldingAddon?: boolean; overnightHoldingAddon?: boolean; statisticsPayload?: any; statisticsUpdatedAt?: string;
  deliveryStatus: "pending" | "delivered"; deliveredAt?: string; createdAt: string;
  [computed: string]: unknown;
};
export type Payout = {
  id: string; accountId: string; userId: string; amount: number; profitSplitAmount: number; firmShareAmount: number;
  paymentMethod: string; paymentDetails: string; status: "pending" | "approved" | "processing" | "paid" | "rejected";
  notes?: string; createdAt: string;
};
export type Kyc = {
  userId: string; documentType: string; backUrl: string;
  status: "pending" | "approved" | "rejected" | "needs_review"; rejectReason?: string; updatedAt: string;
};
export type Certificate = { id: string; userId: string; accountId: string; traderName: string; accountSize: number; planName: string; datePassed: string };
export type Referral = { referredName?: string; referredEmail?: string; amountPaid?: number; planName?: string; commissionAmount: number; status: string; createdAt?: string };
export type AffiliateInfo = {
  affiliate: { userId: string; referralCode: string; commissionRate: number };
  metrics: { totalReferrals: number; totalEarned: number; pendingEarned: number; paidEarned: number };
  referrals: Referral[];
};
export type Notification = { id: string; title: string; message: string; type: string; read: boolean; sentAt: string };

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: any) {
    super(message);
  }
}

export function goToSignin() {
  if (typeof window === "undefined") return;
  const next = window.location.pathname + window.location.search;
  window.location.href = `/auth/signin?next=${encodeURIComponent(next)}`;
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
  if (!res.ok || data?.success === false) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data as T;
}
const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, json?: unknown) => request<T>(p, { method: "POST", json: json ?? {} });
const put = <T>(p: string, json: unknown) => request<T>(p, { method: "PUT", json });

export const api = {
  auth: {
    signup: (b: { name: string; email: string; password: string; phone?: string; country?: string; referralCode?: string; collaboratorCode?: string }) =>
      post<{ user: User; emailSent: boolean; verificationPage: string }>("/api/auth/signup", { ...b, locale: "en" }),
    signin: (email: string, password: string) => post<{ user: User; emailVerified: boolean }>("/api/auth/signin", { email, password }),
    signout: () => post("/api/auth/signout"),
    me: () => get<{ user: User }>("/api/auth/me"),
    updateProfile: (b: { name?: string; phone?: string; country?: string }) => put<{ user: User }>("/api/auth/me", b),
    resendVerification: (email: string) => post("/api/auth/resend-verification", { email, locale: "en" }),
  },
  pricingPlans: () => get<{ plans: PricingPlan[] }>("/api/pricing-plans"),
  checkCoupon: (code: string) => get<{ coupon: { code: string; discountPercent: number } }>(`/api/coupons?code=${encodeURIComponent(code)}`),
  geo: () => get<{ cardPaymentAvailable: boolean; country: string }>("/api/geo"),
  orders: {
    list: () => get<{ orders: Order[] }>("/api/orders"),
    /** 409 → ApiError with data.code === "PRICE_CHANGED" and data.amount */
    create: (b: { planId: string; paymentMethod: string; couponUsed?: string; useReferralBalance?: boolean; weekendHoldingAddon?: boolean; overnightHoldingAddon?: boolean; expectedAmount?: number }) =>
      post<{ order: Order }>("/api/orders", b),
    /** Flex: open (or reuse) the order that pays the remaining balance after passing. */
    activateFlex: (accountId: string, paymentMethod: string) => post<{ order: Order }>("/api/orders/activate", { accountId, paymentMethod }),
    pay: (orderId: string, platform: string) =>
      post<{ provider: string; checkoutUrl: string }>("/api/orders/pay", { orderId, platform, locale: "en" }),
    submitManualPayment: (b: { orderId: string; walletId: string; txid: string; screenshot: File }) => {
      const form = new FormData();
      form.set("orderId", b.orderId);
      form.set("walletId", b.walletId);
      form.set("txid", b.txid);
      form.set("screenshot", b.screenshot);
      return request<{ order: Order }>("/api/orders/manual-payment", { method: "POST", body: form });
    },
  },
  accounts: {
    list: () => get<{ accounts: TradingAccount[] }>("/api/accounts"),
    requestNextStage: (accountId: string) => post<{ message: string }>("/api/accounts/request-next", { accountId }),
  },
  payouts: {
    list: () => get<{ payouts: Payout[] }>("/api/payouts"),
    request: (b: { accountId: string; amount: number; paymentMethod: string; paymentDetails: Record<string, string> }) =>
      post<{ payout: Payout; withdrawal: { requestedAmount: number; adjustedAmount: number; wasAdjusted: boolean } }>("/api/payouts", b),
  },
  kyc: {
    get: () => get<{ kyc?: Kyc; isEligible: boolean }>("/api/kyc"),
    start: () => post<{ kyc: Kyc; simulated: boolean }>("/api/kyc", { method: "didit-create" }),
    sync: () => post<{ kyc: Kyc; simulated: boolean }>("/api/kyc", { method: "didit-sync" }),
  },
  affiliate: () => get<AffiliateInfo>("/api/affiliate"),
  certificates: () => get<{ certificates: Certificate[] }>("/api/certificates"),
  notifications: {
    list: () => get<{ notifications: Notification[] }>("/api/notifications"),
    markRead: (id: string) => put("/api/notifications", { id, read: true }),
  },
};

/** Mirrors the server formula in POST /api/orders (no crypto discount). */
export function checkoutTotal(price: number, opts: { weekendHoldingAddon?: boolean; overnightHoldingAddon?: boolean; discountPercent?: number } = {}) {
  let multiplier = 1;
  if (opts.weekendHoldingAddon) multiplier += 0.20;
  if (opts.overnightHoldingAddon) multiplier += 0.10;
  const base = price * multiplier;
  return Math.ceil(base - base * ((opts.discountPercent || 0) / 100));
}
