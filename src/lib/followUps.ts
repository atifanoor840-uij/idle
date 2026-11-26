/**
 * Follow-up emails (CRM → Follow-ups): the admin picks an audience segment
 * (unpaid orders, unverified sign-ups, no purchase yet, failed challenge, all
 * traders, price list), edits a branded message and sends it to the users they
 * tick. Recipients are always recomputed on the server from the segment, so
 * only real matching users can be emailed.
 */
import { supabase } from "./supabaseClient";
import { db, type DBCoupon, type DBOrder, type DBPricingPlan, type DBUser } from "./db";
import { APP_URL, BRAND_NAME } from "./brand";
import { renderBrandedEmail, type EmailDetail } from "./emailTemplates";

export type SegmentId = "unpaid_orders" | "unverified" | "no_orders" | "failed_challenge" | "all_traders" | "pricing";

export type Recipient = {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  orderId?: string;
  plan?: string;
  amount?: number;
  orderDate?: string;
  lastFollowUpAt?: string | null;
};

export type FollowUpDraft = {
  subject: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
  coupon: string;
  planIds?: string[];
};

export type PriceRow = { id: string; model: string; size: number; price: number };

export const FOLLOW_UP_TAG = "follow-up";

export const SEGMENTS: Record<SegmentId, { label: string; description: string }> = {
  unpaid_orders: { label: "Unpaid orders", description: "Created an order but never paid (no paid order since)." },
  unverified: { label: "Unverified sign-ups", description: "Signed up but haven't confirmed their email address." },
  no_orders: { label: "No purchase yet", description: "Active traders who never created an order." },
  failed_challenge: { label: "Failed challenge", description: "Latest account failed and no new paid order since — offer a retry." },
  all_traders: { label: "All active traders", description: "Promotions and announcements for every active trader." },
  pricing: { label: "Price list", description: "Send live prices for the accounts you pick to the traders you choose." },
};

/** Default copy per segment. Placeholders: {{name}} {{plan}} {{amount}} {{orderId}} {{coupon}}. */
export const PRESETS: Record<SegmentId, Omit<FollowUpDraft, "coupon" | "planIds">> = {
  unpaid_orders: {
    subject: "Your {{plan}} evaluation is waiting for you",
    title: "Complete your order",
    message: `You started an order for the {{plan}} evaluation ({{amount}}) but the payment wasn't completed.\nYour spot is still reserved — finish checkout and start trading today.`,
    ctaLabel: "Complete payment",
    ctaUrl: "/billing",
  },
  unverified: {
    subject: `Confirm your ${BRAND_NAME} email`,
    title: "One step left",
    message: "You're almost there! Confirm your email address to unlock your dashboard and start your first evaluation.",
    ctaLabel: "Sign in & verify",
    ctaUrl: "/auth/signin",
  },
  no_orders: {
    subject: "Ready to get started, {{name}}?",
    title: "Start your evaluation",
    message: `Thanks for joining ${BRAND_NAME}. Pick a simulated account size, prove your strategy and earn performance rewards.`,
    ctaLabel: "Choose an evaluation",
    ctaUrl: "/challenges",
  },
  failed_challenge: {
    subject: "Every great trader has a comeback",
    title: "Ready for another shot?",
    message: "Your last evaluation didn't go to plan — that's part of trading. Take what you learned and start a new one today.",
    ctaLabel: "Start a new evaluation",
    ctaUrl: "/challenges",
  },
  all_traders: {
    subject: `A special offer for ${BRAND_NAME} traders`,
    title: "Limited-time offer",
    message: "For a limited time get a discount on any evaluation. Don't miss it!",
    ctaLabel: "Claim offer",
    ctaUrl: "/challenges",
  },
  pricing: {
    subject: `${BRAND_NAME} evaluation pricing for you, {{name}}`,
    title: "Our evaluation pricing",
    message: "Here are the current prices for the accounts we picked for you. Choose your size, pass the evaluation and earn performance rewards.",
    ctaLabel: "Get started",
    ctaUrl: "/challenges",
  },
};

const MODEL_ORDER = ["One Step", "Two Step", "Instant", "Flex"];
const money = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const sizeLabel = (n: number) => (n >= 1000 ? `$${+(n / 1000).toFixed(1)}K` : `$${n}`);
const time = (s?: string | null) => (s ? new Date(s).getTime() || 0 : 0);
const isUnpaid = (status: string) => {
  const s = String(status || "").toLowerCase();
  return s === "pending" || s === "payment failed";
};

export const isSegment = (s: string): s is SegmentId => s in SEGMENTS;

export async function activePlans(): Promise<PriceRow[]> {
  const rows = await db.getPricingPlans().catch(() => [] as DBPricingPlan[]);
  return rows
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, model: p.model, size: Number(p.size), price: Number(p.price) }))
    .sort((a, b) => {
      const ai = MODEL_ORDER.indexOf(a.model), bi = MODEL_ORDER.indexOf(b.model);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.model.localeCompare(b.model) || a.size - b.size;
    });
}

export async function pickPlans(raw: unknown): Promise<PriceRow[]> {
  const ids = new Set((Array.isArray(raw) ? raw : []).map((x) => String(x ?? "").trim()).filter(Boolean));
  if (!ids.size) return [];
  if (ids.size > 30) throw new Error("Pick at most 30 accounts for the price list.");
  return (await activePlans()).filter((p) => ids.has(p.id));
}

export async function activeCoupons(): Promise<{ code: string; discountPercent: number }[]> {
  const rows = await db.getCoupons().catch(() => [] as DBCoupon[]);
  return rows
    .filter((c) => c.status === "active" && (!c.expiresAt || time(c.expiresAt) > Date.now()))
    .map((c) => ({ code: c.code, discountPercent: Number(c.discountPercent) }));
}

async function lastFollowUps(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabase
    .from("email_logs")
    .select("userId,sentAt")
    .eq("provider", FOLLOW_UP_TAG)
    .eq("status", "sent")
    .order("sentAt", { ascending: false })
    .limit(5000);
  if (error) return map; // email_logs missing on this project
  for (const r of data || []) if (r.userId && !map.has(r.userId)) map.set(r.userId, r.sentAt);
  return map;
}

async function planNames(orders: DBOrder[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const [pricing, ids] = [await activePlans().catch(() => []), [...new Set(orders.map((o) => o.planId).filter(Boolean))]];
  await Promise.all(
    ids.map(async (id) => {
      const p = pricing.find((x) => x.id === id);
      if (p) return names.set(id, `${p.model} ${sizeLabel(p.size)}`);
      const plan = await db.getPlanById(id).catch(() => undefined);
      names.set(id, plan?.name || id);
    }),
  );
  return names;
}

/** Computes every segment's recipients from users + orders + accounts. */
export async function computeSegments(): Promise<Record<SegmentId, Recipient[]>> {
  const [allUsers, orders, accounts, last] = await Promise.all([
    db.getUsers(),
    db.getOrders(),
    db.getAccounts().catch(() => []),
    lastFollowUps(),
  ]);
  const users = allUsers
    .filter((u: DBUser) => (u.role === "trader" || u.role === "affiliate") && u.status === "active" && u.email)
    .sort((a, b) => time(b.createdAt) - time(a.createdAt));
  const ordersByUser = new Map<string, DBOrder[]>();
  for (const o of [...orders].sort((a, b) => time(b.createdAt) - time(a.createdAt))) {
    ordersByUser.set(o.userId, [...(ordersByUser.get(o.userId) ?? []), o]); // newest first
  }
  const accountsByUser = new Map<string, typeof accounts>();
  for (const a of accounts) accountsByUser.set(a.userId, [...(accountsByUser.get(a.userId) ?? []), a]);
  const names = await planNames(orders);

  const base = (u: DBUser): Recipient => ({
    userId: u.id, name: u.name || "", email: u.email, createdAt: u.createdAt, lastFollowUpAt: last.get(u.id) ?? null,
  });
  const withOrder = (r: Recipient, o: DBOrder): Recipient => ({
    ...r, orderId: o.id, plan: names.get(o.planId) ?? o.planId, amount: Number(o.amountPaid) || 0, orderDate: o.createdAt,
  });

  const out: Record<SegmentId, Recipient[]> = {
    unpaid_orders: [], unverified: [], no_orders: [], failed_challenge: [], all_traders: [], pricing: [],
  };
  for (const u of users) {
    const list = ordersByUser.get(u.id) ?? [];
    const r = base(u);
    out.all_traders.push(r);
    out.pricing.push(r);
    if (u.emailVerified === false) out.unverified.push(r);
    if (!list.length) out.no_orders.push(r);

    const paid = list.filter((o) => !isUnpaid(o.status) && !/fail|refund|cancel/i.test(o.status));
    const lastPaid = Math.max(0, ...paid.map((o) => time(o.createdAt)));
    const unpaid = list.find((o) => isUnpaid(o.status) && time(o.createdAt) > lastPaid);
    if (unpaid) out.unpaid_orders.push(withOrder(r, unpaid));

    // Failed challenge: the newest account is Failed and nothing was bought after it.
    const accs = [...(accountsByUser.get(u.id) ?? [])].sort((a, b) => time(b.createdAt) - time(a.createdAt));
    const newest = accs[0];
    if (newest && newest.status === "Failed" && !paid.some((o) => time(o.createdAt) > time(newest.createdAt))) {
      const order = list.find((o) => o.id === newest.orderId);
      out.failed_challenge.push(order ? withOrder(r, order) : r);
    }
  }
  return out;
}

export function fill(text: string, r: Recipient, coupon: string) {
  return text
    .replaceAll("{{name}}", (r.name || "").split(" ")[0] || "Trader")
    .replaceAll("{{plan}}", r.plan ?? "evaluation")
    .replaceAll("{{amount}}", r.amount !== undefined ? money(r.amount) : "")
    .replaceAll("{{orderId}}", r.orderId ?? "")
    .replaceAll("{{coupon}}", coupon);
}

export function absoluteUrl(url: string) {
  const u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  return `${APP_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

/** Builds subject + plain message + details for one recipient. */
export function buildFollowUp(r: Recipient, d: FollowUpDraft, opts: { couponPercent?: number; plans?: PriceRow[] }) {
  const coupon = d.coupon;
  const couponLine = coupon ? `\n\nUse code ${coupon}${opts.couponPercent ? ` for ${opts.couponPercent}% off` : ""} at checkout.` : "";
  const details: EmailDetail[] = [
    ...(r.orderId ? [{ label: "Order ID", value: r.orderId }, { label: "Plan", value: r.plan ?? "" }, { label: "Amount", value: money(r.amount ?? 0) }] : []),
    ...(opts.plans ?? []).map((p) => {
      const now = opts.couponPercent ? p.price * (1 - opts.couponPercent / 100) : p.price;
      return { label: `${p.model} ${sizeLabel(p.size)}`, value: opts.couponPercent ? `${money(now)} (was ${money(p.price)})` : money(now) };
    }),
  ];
  const ctaUrl = absoluteUrl(d.ctaUrl);
  return {
    subject: fill(d.subject, r, coupon),
    heading: fill(d.title, r, coupon),
    text: fill(d.message, r, coupon) + couponLine,
    details,
    action: d.ctaLabel && ctaUrl ? { label: d.ctaLabel, url: ctaUrl } : undefined,
  };
}

export function renderFollowUpPreview(r: Recipient, d: FollowUpDraft, opts: { couponPercent?: number; plans?: PriceRow[] }) {
  const m = buildFollowUp(r, d, opts);
  const rendered = renderBrandedEmail({
    subject: m.subject,
    heading: m.heading,
    eyebrow: "Update",
    message: m.text,
    recipientName: (r.name || "").split(" ")[0] || "Trader",
    recipientEmail: r.email,
    details: m.details,
    action: m.action,
  });
  return { subject: m.subject, html: rendered.html };
}
