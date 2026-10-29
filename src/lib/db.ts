import crypto from "crypto";
import bcrypt from "bcryptjs";
import { supabase } from "./supabaseClient";
import { sendUserEmail } from "./email";
import { getChallengeRule } from "./rulebook";

// Passwords are bcrypt (cost 12). Rows created before the switch hold an
// unsalted sha256 hex digest; those still verify and are upgraded on sign-in.
const BCRYPT_COST = 12;
const LEGACY_SHA256 = /^[0-9a-f]{64}$/i;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!storedHash) return { ok: false, needsRehash: false };
  if (LEGACY_SHA256.test(storedHash)) {
    const given = Buffer.from(crypto.createHash("sha256").update(password).digest("hex"), "utf8");
    const stored = Buffer.from(storedHash.toLowerCase(), "utf8");
    const ok = given.length === stored.length && crypto.timingSafeEqual(given, stored);
    return { ok, needsRehash: ok };
  }
  const ok = await bcrypt.compare(password, storedHash);
  return { ok, needsRehash: ok && bcrypt.getRounds(storedHash) < BCRYPT_COST };
}

/** Verifies a sign-in password and transparently upgrades a legacy/weak hash. */
export async function checkUserPassword(user: DBUser, password: string): Promise<boolean> {
  const { ok, needsRehash } = await verifyPassword(password, user.passwordHash);
  if (ok && needsRehash) {
    user.passwordHash = await hashPassword(password);
    try {
      await db.saveUser(user);
    } catch (error) {
      // Sign-in still succeeds; the upgrade is retried on the next login.
      console.error("Password rehash failed for", user.id, error);
    }
  }
  return ok;
}

/**e hands jsonb columns back as arrays, but a hand-edited row (or an
 * older text column) can arrive as a JSON string or null — so every scope list
 * is funnelled through these before the app reads it.
 */
function normalizeList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeNumberList(value: unknown): number[] {
  return normalizeList(value).map(Number).filter((item) => Number.isFinite(item));
}

function normalizeStringList(value: unknown): string[] {
  return normalizeList(value).map((item) => String(item).trim()).filter(Boolean);
}

// Interfaces matching the CRM specification
export interface DBUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  passwordHash: string;
  role: "trader" | "admin" | "support" | "affiliate" | "collaborator";
  status: "active" | "suspended" | "banned";
  createdAt: string;
  referredBy?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
}

export interface DBKyc {
  userId: string;
  documentType: "passport" | "national_id" | "drivers_license" | "didit";
  frontUrl: string;
  backUrl: string;
  selfieUrl: string;
  addressUrl: string;
  status: "pending" | "approved" | "rejected" | "needs_review";
  rejectReason?: string;
  updatedAt: string;
}

export interface DBOrder {
  id: string;
  userId: string;
  planId: string;
  couponUsed: string;
  amountPaid: number;
  referralBalanceApplied?: number;
  /** Weekend Holding add-on bought at checkout (+20% fee). */
  weekendHoldingAddon?: boolean;
  /** Overnight Holding add-on bought at checkout (+10% fee). */
  overnightHoldingAddon?: boolean;
  /** Admin-set: pin this order's account(s) to the pre-2026-09 rulebook. */
  legacyRules?: boolean;
  /** Flex: balance still owed after the upfront payment, paid once the evaluation is passed. */
  activationFee?: number | null;
  /** Flex activation order: the Flex order whose remaining balance this order pays. */
  parentOrderId?: string | null;
  paymentMethod: string;
  status: string;
  gatewayRef: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBChallengePlan {
  id: string;
  name: string;
  size: number;
  price: number;
  profitTargetP1: number;
  profitTargetP2: number;
  maxDailyLoss: number;
  maxTotalLoss: number;
  profitSplit: number;
  platform?: string;
  login?: string;
  password?: string;
  server?: string;
}

export interface DBChallengeInventoryItem {
  id: string;
  platform: "MT4" | "MT5" | "cTrader";
  size: number;
  login: string;
  password: string;
  server: string;
  externalStatisticsId?: string;
  graphLink?: string;
  status: "available" | "delivered";
  orderId?: string;
  createdAt?: string;
}

export interface DBPricingPlan {
  id: string;
  model: string;
  size: number;
  /** The real price. For Flex, coupons apply to this and it is split into upfront + activation. */
  price: number;
  /** Flex only: what the trader pays at checkout. */
  upfrontPrice?: number | null;
  status: string;
  createdAt?: string;
}

export interface DBTradingAccount {
  id: string;
  userId: string;
  orderId: string;
  platform: "MT4" | "MT5" | "cTrader";
  login: string;
  passwordMaster: string;
  passwordInvestor: string;
  server: string;
  profitTarget: number;
  balance: number;
  equity: number;
  todayPl: number;
  totalPl: number;
  status: "Active" | "Passed" | "Failed" | "Funded";
  phase?: string;
  graphLink: string;
  /** Weekend Holding add-on carried over from the order (+20% fee). */
  weekendHoldingAddon?: boolean;
  /** Overnight Holding add-on carried over from the order (+10% fee). */
  overnightHoldingAddon?: boolean;
  externalStatisticsId?: string;
  statisticsApiId?: string;
  statisticsPayload?: any;
  statisticsUpdatedAt?: string;
  deliveryStatus: "pending" | "delivered";
  deliveredAt?: string;
  createdAt: string;
}

export interface DBPayout {
  id: string;
  accountId: string;
  userId: string;
  amount: number;
  profitSplitAmount: number;
  firmShareAmount: number;
  paymentMethod: string;
  paymentDetails: string; // JSON string
  status: "pending" | "approved" | "processing" | "paid" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface DBCoupon {
  code: string;
  discountPercent: number;
  status: string;
  expiresAt?: string;
  isExpired?: boolean;
  createdAt?: string;
}

/**
 * Promotional offers that are richer than a percentage coupon: "buy one get
 * one free" bundles and free challenge retries. An offer is scoped by account
 * size / challenge model (which products it applies to) and optionally pinned
 * to specific traders or specific delivered accounts. Empty scope arrays mean
 * "everything", which keeps a store-wide offer a single row.
 */
export type OfferType = "bogo" | "free_retry";

export interface DBOffer {
  id: string;
  name: string;
  type: OfferType;
  /** Legacy column, always blank: offers apply automatically, never by code. */
  code?: string;
  description?: string;
  status: "active" | "paused";
  startsAt?: string;
  expiresAt?: string;
  /** Empty = every account size in the catalog. */
  accountSizes: number[];
  /** Empty = every challenge model (One Step / Two Step / Instant). */
  models: string[];
  /** Empty = every trader; otherwise only these user ids. */
  userIds: string[];
  /** Empty = not pinned; otherwise only these delivered trading accounts. */
  accountIds: string[];
  /** BOGO: buy N, get M of the same size free. */
  buyQuantity: number;
  freeQuantity: number;
  /** Free retry: how many free retries each matching account gets. */
  retryLimit: number;
  /** 0 = unlimited. */
  maxRedemptions: number;
  redeemedCount: number;
  createdAt?: string;
  updatedAt?: string;
  /** Derived on read, never stored. */
  isExpired?: boolean;
  isScheduled?: boolean;
}

/**
 * One granted offer benefit. A free retry writes a row the moment the trader
 * claims it, so the same failed account cannot be claimed twice and the
 * offer's redemption cap is enforced from real rows rather than a counter
 * that could drift.
 */
export interface DBOfferRedemption {
  id: string;
  offerId: string;
  userId: string;
  type: OfferType;
  /** The failed account this retry was claimed against. */
  sourceAccountId?: string;
  /** The replacement account that was issued. */
  newAccountId?: string;
  orderId?: string;
  status: "granted" | "revoked";
  createdAt: string;
}

export interface DBAffiliate {
  userId: string;
  referralCode: string;
  commissionRate: number; // percentage
}

export interface DBReferral {
  referredUserId: string;
  affiliateId: string;
  orderId: string;
  commissionAmount: number;
  status: "pending" | "approved" | "paid";
  createdAt: string;
}

// Collaborators are intentionally separate from the legacy affiliate program.
export interface DBCollaborator {
  userId: string;
  referralCode: string;
  commissionRate: number;
  createdAt: string;
}

export interface DBCollaboratorAttribution {
  referredUserId: string;
  collaboratorId: string;
  createdAt: string;
}

export interface DBCollaboratorSale {
  referredUserId: string;
  collaboratorId: string;
  orderId: string;
  saleAmount: number;
  commissionAmount: number;
  status: "pending" | "approved" | "paid";
  createdAt: string;
}

export interface DBCertificate {
  id: string;
  userId: string;
  accountId: string;
  traderName: string;
  accountSize: number;
  planName: string;
  datePassed: string;
}

export interface DBNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "warning" | "success" | "info" | "error";
  channel: "email" | "in_app";
  status: "sent" | "failed";
  read: boolean;
  sentAt: string;
}

export interface DBEmailLog {
  id: string;
  userId: string;
  toEmail: string;
  subject: string;
  content: string;
  status: "sent" | "failed";
  provider: string;
  error?: string;
  sentAt: string;
}

export interface DBAuditLog {
  id: string;
  userId: string;       // Admin user who performed the change
  userName: string;     // Admin name
  targetId: string;     // ID of the target order/account/user
  targetType: "order" | "account" | "user" | "news_event";
  action: string;       // e.g. "order_status_update"
  description: string;  // e.g. "Changed order o-1002 status"
  createdAt: string;
}

export interface DBPixelEvent {
  id: string;
  eventName: string;               // e.g. "Purchase", "PageView"
  eventId?: string;                // dedup key shared with the browser Pixel
  source: "capi" | "pixel";        // server Conversions API vs browser Pixel
  status: "sent" | "failed";       // outcome of the delivery attempt
  pixelId?: string;
  orderId?: string;
  userId?: string;
  userEmail?: string;
  value?: number;
  currency?: string;
  contentName?: string;
  contentIds?: string;             // comma-joined plan ids
  eventSourceUrl?: string;
  error?: string;
  createdAt: string;
}

// Overnight holding is no longer a rule, so the breach notifications it raised
// earlier are hidden everywhere (user feed, admin feed, breach-reason recovery).
function isLiveNotification(notification: DBNotification) {
  return !String(notification.id || "").endsWith("-overnight-holding-breach");
}

// Whole-table reads that many routes make at the same moment. One admin CRM
// load fires ~14 GETs in parallel and eight of them pull the full `users`
// table (orders/accounts/affiliate/compliance also re-read orders, plans and
// notifications), so the same rows crossed the wire up to eight times per
// load. While a read is in flight, later callers join it instead of starting
// their own. Nothing is kept once it settles - there is no TTL and so no
// staleness beyond a read that had already started. Each caller gets its own
// copy, because some routes mutate rows they read (e.g. compliance edits
// `order.status` before saving).
const inFlightReads = new Map<string, Promise<unknown>>();
function shareInFlight<T>(key: string, load: () => Promise<T>): Promise<T> {
  let pending = inFlightReads.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load().finally(() => inFlightReads.delete(key));
    inFlightReads.set(key, pending);
  }
  return pending.then((rows) => structuredClone(rows));
}

async function loadAllUsers(): Promise<DBUser[]> {
  // Supabase caps a single select at 1000 rows (project "Max rows"), so a
  // plain select silently dropped every user past the first 1000. Page
  // through in 1000-row chunks, ordered by id so pages never overlap.
  const PAGE = 1000;
  const MAX_USERS = 100_000;
  const all: DBUser[] = [];
  // Advance by what actually came back and stop only on an empty page, so a
  // project "Max rows" set below PAGE can't end the loop after the first page.
  while (all.length < MAX_USERS) {
    const from = all.length;
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("id", { ascending: true })
      .range(from, Math.min(from + PAGE, MAX_USERS) - 1);
    if (error) throw error;
    const rows = (data || []) as DBUser[];
    if (rows.length === 0) break;
    all.push(...rows);
  }
  return all;
}

// CRM Data Controller Functions accessing Supabase
function mapOrderRow(o: any): DBOrder {
  if (!o) return o;
  return {
    ...o,
    overnightHoldingAddon: Boolean(o.overnightHoldingAddon || /addon:overnight=1/.test(o.gatewayRef || "")),
  };
}

function mapAccountRow(a: any): DBTradingAccount {
  if (!a) return a;
  return {
    ...a,
    overnightHoldingAddon: Boolean(a.overnightHoldingAddon || a.statisticsPayload?.overnightHoldingAddon),
  };
}

export const db = {
  // Users
  getUsers: (): Promise<DBUser[]> => shareInFlight("users", loadAllUsers),
  /**
   * Batched id lookup. Screens that join a handful of rows to their owners
   * used to pull the whole `users` table and `find()` through it in memory;
   * this keeps the round trip proportional to what is actually shown.
   */
  getUsersByIds: async (ids: string[]): Promise<DBUser[]> => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return [];
    const { data, error } = await supabase.from("users").select("*").in("id", unique);
    if (error) throw error;
    return data || [];
  },
  getUserById: async (id: string): Promise<DBUser | undefined> => {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  getUserByEmail: async (email: string): Promise<DBUser | undefined> => {
    const { data, error } = await supabase.from("users").select("*").ilike("email", email).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  saveUser: async (user: DBUser): Promise<DBUser> => {
    const { data, error } = await supabase.from("users").upsert(user).select().single();
    if (error) throw error;
    return data;
  },

  // KYC
  getKyc: async (): Promise<DBKyc[]> => {
    const { data, error } = await supabase.from("kyc").select("*");
    if (error) throw error;
    return data || [];
  },
  getKycByUserId: async (userId: string): Promise<DBKyc | undefined> => {
    const { data, error } = await supabase.from("kyc").select("*").eq("userId", userId).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  saveKyc: async (kyc: DBKyc): Promise<DBKyc> => {
    const { data, error } = await supabase.from("kyc").upsert(kyc).select().single();
    if (error) throw error;
    return data;
  },

  // Orders
  getOrders: (): Promise<DBOrder[]> =>
    shareInFlight("orders", async () => {
      const { data, error } = await supabase.from("orders").select("*");
      if (error) throw error;
      return data || [];
    }),
  getOrdersByUserId: async (userId: string): Promise<DBOrder[]> => {
    const { data, error } = await supabase.from("orders").select("*").eq("userId", userId);
    if (error) throw error;
    return (data || []).map(mapOrderRow);
  },
  /** Batched id lookup - see `getUsersByIds`. */
  getOrdersByIds: async (ids: string[]): Promise<DBOrder[]> => {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (unique.length === 0) return [];
    const { data, error } = await supabase.from("orders").select("*").in("id", unique);
    if (error) throw error;
    return data || [];
  },
  getOrderById: async (id: string): Promise<DBOrder | undefined> => {
    const { data, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapOrderRow(data) : undefined;
  },
  saveOrder: async (order: DBOrder): Promise<DBOrder> => {
    const { overnightHoldingAddon, ...dbPayload } = order as any;
    if (overnightHoldingAddon) {
      if (!dbPayload.gatewayRef) dbPayload.gatewayRef = "";
      if (!dbPayload.gatewayRef.includes("addon:overnight=1")) {
        dbPayload.gatewayRef = `${dbPayload.gatewayRef}|addon:overnight=1`;
      }
    }
    const { data, error } = await supabase.from("orders").upsert(dbPayload).select().single();
    if (error) throw error;
    return mapOrderRow({ ...data, overnightHoldingAddon });
  },
  deleteOrder: async (id: string): Promise<boolean> => {
    const { error, count } = await supabase.from("orders").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return count !== null && count > 0;
  },

  // Challenge Plans
  getPlans: (): Promise<DBChallengePlan[]> =>
    shareInFlight("challenge_plans", async () => {
      const { data, error } = await supabase.from("challenge_plans").select("*");
      if (error) throw error;
      return data || [];
    }),
  getPlanById: async (id: string): Promise<DBChallengePlan | undefined> => {
    // 1. Try challenge_plans
    const { data, error } = await supabase.from("challenge_plans").select("*").eq("id", id).maybeSingle();
    if (!error && data) return data;

    // 2. Try pricing_plans
    try {
      const { data: pPlan, error: pError } = await supabase.from("pricing_plans").select("*").eq("id", id).maybeSingle();
      if (!pError && pPlan) {
        const model = pPlan.model || "TWO STEP STANDARD";
        const rule = getChallengeRule(model);

        return {
          id: pPlan.id,
          name: rule.displayName,
          size: Number(pPlan.size),
          price: Number(pPlan.price),
          profitTargetP1: rule.phase1TargetPercent,
          profitTargetP2: rule.phase2TargetPercent,
          maxDailyLoss: rule.dailyDrawdownPercent,
          maxTotalLoss: rule.overallDrawdownPercent,
          profitSplit: rule.profitSplitPercent,
        };
      }
    } catch (e) {
      console.warn("Pricing plans table query error", e);
    }
    return undefined;
  },
  savePlan: async (plan: DBChallengePlan): Promise<DBChallengePlan> => {
    const { data, error } = await supabase.from("challenge_plans").upsert(plan).select().single();
    if (error) throw error;
    return data;
  },
  deletePlan: async (id: string): Promise<boolean> => {
    const { error, count } = await supabase.from("challenge_plans").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return count !== null && count > 0;
  },

  // Challenge Inventory (credential pool, separate from purchasable plans)
  getChallengeInventory: async (): Promise<DBChallengeInventoryItem[]> => {
    const { data, error } = await supabase.from("challenge_inventory").select("*").order("createdAt", { ascending: false });
    if (error) throw error;
    return data || [];
  },
  getChallengeInventoryById: async (id: string): Promise<DBChallengeInventoryItem | undefined> => {
    const { data, error } = await supabase.from("challenge_inventory").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  saveChallengeInventoryItem: async (item: DBChallengeInventoryItem): Promise<DBChallengeInventoryItem> => {
    const { data, error } = await supabase.from("challenge_inventory").upsert(item).select().single();
    if (error) {
      // The "graphLink" column comes from challenge_inventory_graph_link_migration.sql.
      // Until it is applied, still save containers that carry no graph link.
      const missingGraphColumn =
        error.code === "PGRST204" && String(error.message || "").includes("graphLink");
      if (missingGraphColumn && !item.graphLink) {
        const { graphLink: _omit, ...withoutGraph } = item;
        const retry = await supabase.from("challenge_inventory").upsert(withoutGraph).select().single();
        if (retry.error) throw retry.error;
        return retry.data;
      }
      if (missingGraphColumn) {
        throw new Error(
          "Graph link column is missing. Apply src/lib/challenge_inventory_graph_link_migration.sql in Supabase.",
        );
      }
      throw error;
    }
    return data;
  },
  /**
   * Atomically hand one container to an order: flips it to "delivered" only if
   * it is still "available", so two payments landing together can never get
   * the same credentials. Resolves undefined when another order won the race.
   */
  claimChallengeInventoryItem: async (
    id: string,
    orderId: string,
  ): Promise<DBChallengeInventoryItem | undefined> => {
    const { data, error } = await supabase
      .from("challenge_inventory")
      .update({ status: "delivered", orderId })
      .eq("id", id)
      .eq("status", "available")
      .select()
      .maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  /** Undo a claim that could not be turned into an account. */
  releaseChallengeInventoryItem: async (id: string, orderId: string): Promise<void> => {
    const { error } = await supabase
      .from("challenge_inventory")
      .update({ status: "available", orderId: null })
      .eq("id", id)
      .eq("orderId", orderId);
    if (error) throw error;
  },
  deleteChallengeInventoryItem: async (id: string): Promise<boolean> => {
    const { error, count } = await supabase.from("challenge_inventory").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return count !== null && count > 0;
  },

  // Trading Accounts
  getAccounts: async (): Promise<DBTradingAccount[]> => {
    const { data, error } = await supabase.from("trading_accounts").select("*");
    if (error) throw error;
    return (data || []).map(mapAccountRow);
  },
  getAccountsByUserId: async (userId: string): Promise<DBTradingAccount[]> => {
    const { data, error } = await supabase.from("trading_accounts").select("*").eq("userId", userId);
    if (error) throw error;
    return (data || []).map(mapAccountRow);
  },
  getAccountById: async (id: string): Promise<DBTradingAccount | undefined> => {
    const { data, error } = await supabase.from("trading_accounts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapAccountRow(data) : undefined;
  },
  saveAccount: async (account: DBTradingAccount): Promise<DBTradingAccount> => {
    const { overnightHoldingAddon, ...dbPayload } = account as any;
    if (overnightHoldingAddon) {
      dbPayload.statisticsPayload = {
        ...(dbPayload.statisticsPayload || {}),
        overnightHoldingAddon: true,
      };
    }
    const { data, error } = await supabase.from("trading_accounts").upsert(dbPayload).select().single();
    if (error) throw error;
    return mapAccountRow({ ...data, overnightHoldingAddon });
  },
  deleteAccount: async (id: string): Promise<boolean> => {
    const { error, count } = await supabase.from("trading_accounts").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return count !== null && count > 0;
  },

  // Payouts
  getPayouts: async (): Promise<DBPayout[]> => {
    const { data, error } = await supabase.from("payouts").select("*");
    if (error) throw error;
    return data || [];
  },
  getPayoutsByUserId: async (userId: string): Promise<DBPayout[]> => {
    const { data, error } = await supabase.from("payouts").select("*").eq("userId", userId);
    if (error) throw error;
    return data || [];
  },
  getPayoutById: async (id: string): Promise<DBPayout | undefined> => {
    const { data, error } = await supabase.from("payouts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  savePayout: async (payout: DBPayout): Promise<DBPayout> => {
    const { data, error } = await supabase.from("payouts").upsert(payout).select().single();
    if (error) throw error;
    return data;
  },

  // Affiliates
  getAffiliates: async (): Promise<DBAffiliate[]> => {
    const { data, error } = await supabase.from("affiliates").select("*");
    if (error) throw error;
    return data || [];
  },
  getAffiliateByUserId: async (userId: string): Promise<DBAffiliate | undefined> => {
    const { data, error } = await supabase.from("affiliates").select("*").eq("userId", userId).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  getAffiliateByCode: async (code: string): Promise<DBAffiliate | undefined> => {
    const { data, error } = await supabase.from("affiliates").select("*").ilike("referralCode", code).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  saveAffiliate: async (affiliate: DBAffiliate): Promise<DBAffiliate> => {
    const { data, error } = await supabase.from("affiliates").upsert(affiliate).select().single();
    if (error) throw error;
    return data;
  },

  // Referrals
  getReferrals: async (): Promise<DBReferral[]> => {
    const { data, error } = await supabase.from("referrals").select("*");
    if (error) throw error;
    return data || [];
  },
  getReferralsByAffiliateId: async (affiliateId: string): Promise<DBReferral[]> => {
    const { data, error } = await supabase.from("referrals").select("*").eq("affiliateId", affiliateId);
    if (error) throw error;
    return data || [];
  },
  saveReferral: async (referral: DBReferral): Promise<DBReferral> => {
    const { data, error } = await supabase.from("referrals").upsert(referral).select().single();
    if (error) throw error;
    return data;
  },
  updateReferralStatus: async (referredUserId: string, orderId: string, status: "pending" | "approved" | "paid"): Promise<boolean> => {
    const { data, error } = await supabase
      .from("referrals")
      .update({ status })
      .eq("referredUserId", referredUserId)
      .eq("orderId", orderId)
      .select("*");
    if (error) throw error;
    return data !== null && data.length > 0;
  },

  // Collaborators (a separate admin-managed referral program)
  getCollaborators: async (): Promise<DBCollaborator[]> => {
    const { data, error } = await supabase.from("collaborators").select("*");
    if (error) throw error;
    return data || [];
  },
  getCollaboratorByUserId: async (userId: string): Promise<DBCollaborator | undefined> => {
    const { data, error } = await supabase.from("collaborators").select("*").eq("userId", userId).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  getCollaboratorByCode: async (code: string): Promise<DBCollaborator | undefined> => {
    const { data, error } = await supabase.from("collaborators").select("*").ilike("referralCode", code.trim()).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  saveCollaborator: async (collaborator: DBCollaborator): Promise<DBCollaborator> => {
    const { data, error } = await supabase.from("collaborators").upsert(collaborator).select().single();
    if (error) throw error;
    return data;
  },
  getCollaboratorAttribution: async (referredUserId: string): Promise<DBCollaboratorAttribution | undefined> => {
    const { data, error } = await supabase.from("collaborator_attributions").select("*").eq("referredUserId", referredUserId).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  getCollaboratorAttributions: async (): Promise<DBCollaboratorAttribution[]> => {
    const { data, error } = await supabase.from("collaborator_attributions").select("*");
    if (error) throw error;
    return data || [];
  },
  saveCollaboratorAttribution: async (attribution: DBCollaboratorAttribution): Promise<DBCollaboratorAttribution> => {
    const { data, error } = await supabase.from("collaborator_attributions").upsert(attribution).select().single();
    if (error) throw error;
    return data;
  },
  getCollaboratorSales: async (): Promise<DBCollaboratorSale[]> => {
    const { data, error } = await supabase.from("collaborator_sales").select("*");
    if (error) throw error;
    return data || [];
  },
  getCollaboratorSalesByCollaboratorId: async (collaboratorId: string): Promise<DBCollaboratorSale[]> => {
    const { data, error } = await supabase.from("collaborator_sales").select("*").eq("collaboratorId", collaboratorId);
    if (error) throw error;
    return data || [];
  },
  saveCollaboratorSale: async (sale: DBCollaboratorSale): Promise<DBCollaboratorSale> => {
    const { data, error } = await supabase.from("collaborator_sales").upsert(sale).select().single();
    if (error) throw error;
    return data;
  },
  updateCollaboratorSaleStatus: async (referredUserId: string, orderId: string, status: DBCollaboratorSale["status"]): Promise<boolean> => {
    const { data, error } = await supabase.from("collaborator_sales").update({ status }).eq("referredUserId", referredUserId).eq("orderId", orderId).select("*");
    if (error) throw error;
    return Boolean(data?.length);
  },

  // Certificates
  getCertificates: async (): Promise<DBCertificate[]> => {
    const { data, error } = await supabase.from("certificates").select("*");
    if (error) throw error;
    return data || [];
  },
  getCertificatesByUserId: async (userId: string): Promise<DBCertificate[]> => {
    const { data, error } = await supabase.from("certificates").select("*").eq("userId", userId);
    if (error) throw error;
    return data || [];
  },
  getCertificateById: async (id: string): Promise<DBCertificate | undefined> => {
    const { data, error } = await supabase.from("certificates").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || undefined;
  },
  saveCertificate: async (cert: DBCertificate): Promise<DBCertificate> => {
    const { data, error } = await supabase.from("certificates").upsert(cert).select().single();
    if (error) throw error;
    return data;
  },

  // Notifications
  getNotifications: (): Promise<DBNotification[]> =>
    shareInFlight("notifications", async () => {
      const { data, error } = await supabase.from("notifications").select("*");
      if (error) throw error;
      return (data || []).filter(isLiveNotification);
    }),
  getNotificationsByUserId: async (userId: string): Promise<DBNotification[]> => {
    const { data, error } = await supabase.from("notifications").select("*").eq("userId", userId);
    if (error) throw error;
    return (data || []).filter(isLiveNotification);
  },
  saveNotification: async (notif: DBNotification): Promise<DBNotification> => {
    const { data, error } = await supabase.from("notifications").upsert(notif).select().single();
    if (error) throw error;
    if (notif.channel === "email") {
      await sendUserEmail({
        userId: notif.userId,
        subject: notif.title,
        text: notif.message,
      });
    }
    return data;
  },

  // Email Logs
  getEmailLogs: async (): Promise<DBEmailLog[]> => {
    try {
      const { data, error } = await supabase.from("email_logs").select("*").order("sentAt", { ascending: false });
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist")) {
          const { data: notifications, error: notifError } = await supabase
            .from("notifications")
            .select("*")
            .eq("channel", "email")
            .order("sentAt", { ascending: false });
          if (notifError) throw notifError;
          return (notifications || []).map((n: any) => ({
            id: n.id,
            userId: n.userId,
            toEmail: "",
            subject: n.title,
            content: n.message,
            status: n.status,
            provider: "notification-fallback",
            error: "",
            sentAt: n.sentAt,
          }));
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      console.warn("Email logs table not found, fallback to empty array.");
      return [];
    }
  },
  getEmailLogsByUserId: async (userId: string): Promise<DBEmailLog[]> => {
    try {
      const { data, error } = await supabase.from("email_logs").select("*").eq("userId", userId).order("sentAt", { ascending: false });
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist")) {
          const { data: notifications, error: notifError } = await supabase
            .from("notifications")
            .select("*")
            .eq("userId", userId)
            .eq("channel", "email")
            .order("sentAt", { ascending: false });
          if (notifError) throw notifError;
          return (notifications || []).map((n: any) => ({
            id: n.id,
            userId: n.userId,
            toEmail: "",
            subject: n.title,
            content: n.message,
            status: n.status,
            provider: "notification-fallback",
            error: "",
            sentAt: n.sentAt,
          }));
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      console.warn("Email logs table not found, fallback to empty array.");
      return [];
    }
  },
  saveEmailLog: async (log: DBEmailLog): Promise<DBEmailLog> => {
    const { data, error } = await supabase.from("email_logs").upsert(log).select().single();
    if (error) throw error;
    return data;
  },

  // Audit Logs
  getAuditLogs: async (): Promise<DBAuditLog[]> => {
    const { data, error } = await supabase.from("audit_logs").select("*");
    if (error) throw error;
    return data || [];
  },
  saveAuditLog: async (log: DBAuditLog): Promise<DBAuditLog> => {
    const { data, error } = await supabase.from("audit_logs").upsert(log).select().single();
    if (error) throw error;
    return data;
  },

  // Pixel / Conversions API events
  getPixelEvents: async (): Promise<DBPixelEvent[]> => {
    try {
      const { data, error } = await supabase
        .from("pixel_events")
        .select("*")
        .order("createdAt", { ascending: false });
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist")) {
          return [];
        }
        throw error;
      }
      return data || [];
    } catch {
      console.warn("pixel_events table not found, fallback to empty array.");
      return [];
    }
  },
  savePixelEvent: async (event: DBPixelEvent): Promise<DBPixelEvent | null> => {
    try {
      const { data, error } = await supabase
        .from("pixel_events")
        .upsert(event)
        .select()
        .single();
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist")) {
          return null;
        }
        throw error;
      }
      return data;
    } catch (err) {
      console.warn("Failed to persist pixel_events row:", err);
      return null;
    }
  },

  // Coupons
  getCoupons: async (): Promise<DBCoupon[]> => {
    try {
      const { data, error } = await supabase.from("coupons").select("*");
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist")) {
          return [];
        }
        throw error;
      }
      return (data || []).map((coupon) => {
        const isExpired = Boolean(coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now());
        return {
          ...coupon,
          isExpired,
          status: isExpired ? "expired" : coupon.status,
        };
      });
    } catch (err) {
      console.warn("Coupons table not found, fallback to empty array.");
      return [];
    }
  },
  saveCoupon: async (coupon: DBCoupon): Promise<DBCoupon> => {
    const { data, error } = await supabase.from("coupons").upsert(coupon).select().single();
    if (error) throw error;
    return data;
  },
  deleteCoupon: async (code: string): Promise<boolean> => {
    const { error, count } = await supabase.from("coupons").delete({ count: "exact" }).eq("code", code);
    if (error) throw error;
    return count !== null && count > 0;
  },
  // Offers (BOGO / free retry) — richer than the flat percentage coupons above.
  getOffers: async (): Promise<DBOffer[]> => {
    try {
      const { data, error } = await supabase.from("offers").select("*");
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist")) {
          return [];
        }
        throw error;
      }
      const now = Date.now();
      return (data || []).map((offer) => {
        const isExpired = Boolean(offer.expiresAt && new Date(offer.expiresAt).getTime() <= now);
        const isScheduled = Boolean(offer.startsAt && new Date(offer.startsAt).getTime() > now);
        return {
          ...offer,
          accountSizes: normalizeNumberList(offer.accountSizes),
          models: normalizeStringList(offer.models),
          userIds: normalizeStringList(offer.userIds),
          accountIds: normalizeStringList(offer.accountIds),
          buyQuantity: Number(offer.buyQuantity) || 1,
          freeQuantity: Number(offer.freeQuantity) || 0,
          retryLimit: Number(offer.retryLimit) || 0,
          maxRedemptions: Number(offer.maxRedemptions) || 0,
          redeemedCount: Number(offer.redeemedCount) || 0,
          isExpired,
          isScheduled,
        } as DBOffer;
      });
    } catch (err) {
      console.warn("Offers table not found, fallback to empty array.");
      return [];
    }
  },
  saveOffer: async (offer: DBOffer): Promise<DBOffer> => {
    const { data, error } = await supabase.from("offers").upsert(offer).select().single();
    if (error) throw error;
    return data;
  },
  deleteOffer: async (id: string): Promise<boolean> => {
    const { error, count } = await supabase.from("offers").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return count !== null && count > 0;
  },
  getOfferRedemptions: async (): Promise<DBOfferRedemption[]> => {
    try {
      const { data, error } = await supabase.from("offer_redemptions").select("*");
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist")) {
          return [];
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      console.warn("Offer redemptions table not found, fallback to empty array.");
      return [];
    }
  },
  saveOfferRedemption: async (redemption: DBOfferRedemption): Promise<DBOfferRedemption> => {
    const { data, error } = await supabase
      .from("offer_redemptions")
      .upsert(redemption)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  getPricingPlans: async (): Promise<DBPricingPlan[]> => {
    try {
      const { data, error } = await supabase.from("pricing_plans").select("*");
      if (error) {
        if (error.code === "PGRST205" || error.message.includes("does not exist")) {
          return [];
        }
        throw error;
      }
      return data || [];
    } catch (err) {
      console.warn("Pricing plans table not found, fallback to empty array.");
      return [];
    }
  },
  savePricingPlan: async (plan: DBPricingPlan): Promise<DBPricingPlan> => {
    const { data, error } = await supabase.from("pricing_plans").upsert(plan).select().single();
    if (error) throw error;
    return data;
  },
  deletePricingPlan: async (id: string): Promise<boolean> => {
    const { error, count } = await supabase.from("pricing_plans").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return count !== null && count > 0;
  },
};
