import { db, DBChallengePlan, DBOffer, DBOrder, DBTradingAccount } from "./db";
import { isOfferLive, offerCoversTarget } from "./offerEligibility";
import { PHASE_FUNDED, PHASE_ONE, getStageProfitTarget } from "./challengeStages";
import { getChallengeRule } from "./rulebook";

/**
 * Server-side granting for offers that fire automatically (no code). Coupons
 * only ever change the price; offers hand out accounts. A live BOGO offer is
 * applied when a qualifying purchase is activated, whether or not the trader
 * also used a coupon on it.
 */

export const BOGO_PAYMENT_METHOD = "offer_bogo";
export const FREE_RETRY_PAYMENT_METHOD = "free_retry";

const FREE_PAYMENT_METHODS = new Set([BOGO_PAYMENT_METHOD, FREE_RETRY_PAYMENT_METHOD]);
const NON_PAID_STATUSES = new Set(["pending", "cancelled", "canceled", "refunded", "rejected", "failed payment"]);

function randomId(prefix: string) {
  return prefix + Math.random().toString(36).substring(2, 11);
}

/** Free orders carry `offer:<offerId>` (retry) or `offer:<offerId>:from:<orderId>` (BOGO). */
export function parseOfferGatewayRef(gatewayRef?: string) {
  const match = /^offer:([^:]+)(?::from:(.+))?$/.exec(String(gatewayRef || ""));
  if (!match) return null;
  return { offerId: match[1], sourceOrderId: match[2] || null };
}

function isPaidPurchase(order: DBOrder) {
  if (FREE_PAYMENT_METHODS.has(order.paymentMethod)) return false;
  return !NON_PAID_STATUSES.has(String(order.status || "").toLowerCase());
}

function offerWindowStart(offer: DBOffer) {
  return new Date(offer.startsAt || offer.createdAt || 0).getTime();
}

/**
 * Call once an order has been paid/activated. For every live BOGO offer that
 * covers this purchase, counts the trader's qualifying paid purchases inside
 * the offer window; each full set of `buyQuantity` earns `freeQuantity` free
 * accounts of the same plan. Idempotent: a source order that already triggered
 * a grant never triggers another, so re-saving an order status is safe.
 */
export async function grantBogoOffersForOrder(order: DBOrder, plan: DBChallengePlan | null | undefined) {
  if (!plan || !isPaidPurchase(order)) return [];

  const offers = (await db.getOffers()).filter(
    (offer) =>
      offer.type === "bogo" &&
      isOfferLive(offer) &&
      offerCoversTarget(offer, { size: plan.size, planName: plan.name, userId: order.userId }),
  );
  if (offers.length === 0) return [];

  const [orders, plans] = await Promise.all([db.getOrdersByUserId(order.userId), db.getPlans()]);
  const planById = new Map(plans.map((item) => [item.id, item]));
  const granted: Array<{ offer: DBOffer; accounts: DBTradingAccount[] }> = [];

  for (const offer of offers) {
    const freeOrders = orders.filter(
      (item) =>
        item.paymentMethod === BOGO_PAYMENT_METHOD &&
        parseOfferGatewayRef(item.gatewayRef)?.offerId === offer.id,
    );
    const triggeredSources = new Set(
      freeOrders.map((item) => parseOfferGatewayRef(item.gatewayRef)?.sourceOrderId).filter(Boolean),
    );
    if (triggeredSources.has(order.id)) continue;

    const windowStart = offerWindowStart(offer);
    const qualifying = orders.filter((item) => {
      if (item.id !== order.id && !isPaidPurchase(item)) return false;
      if (new Date(item.createdAt).getTime() < windowStart) return false;
      const itemPlan = planById.get(item.planId) || (item.id === order.id ? plan : undefined);
      if (!itemPlan) return false;
      return offerCoversTarget(offer, { size: itemPlan.size, planName: itemPlan.name, userId: item.userId });
    });
    // The activating order must itself be in the window to trigger anything.
    if (!qualifying.some((item) => item.id === order.id)) continue;

    const buyQuantity = Math.max(1, Number(offer.buyQuantity) || 1);
    const grantsEarned = Math.floor(qualifying.length / buyQuantity);
    if (grantsEarned <= triggeredSources.size) continue;

    const cap = Number(offer.maxRedemptions) || 0;
    if (cap > 0 && (Number(offer.redeemedCount) || 0) >= cap) continue;

    const now = new Date().toISOString();
    const freeQuantity = Math.max(1, Number(offer.freeQuantity) || 1);
    const accounts: DBTradingAccount[] = [];
    // Same stage a bought account starts on: Instant goes straight to Funded.
    const isInstant = getChallengeRule(plan.name).key === "instant_funding";

    for (let i = 0; i < freeQuantity; i += 1) {
      const freeOrder: DBOrder = {
        id: randomId("ord-bogo-"),
        userId: order.userId,
        planId: plan.id,
        couponUsed: "",
        amountPaid: 0,
        weekendHoldingAddon: Boolean(order.weekendHoldingAddon),
        legacyRules: order.legacyRules,
        paymentMethod: BOGO_PAYMENT_METHOD,
        status: "Active",
        gatewayRef: `offer:${offer.id}:from:${order.id}`,
        createdAt: now,
        updatedAt: now,
      };
      await db.saveOrder(freeOrder);

      const accountId = Math.floor(100000 + Math.random() * 900000).toString();
      const account: DBTradingAccount = {
        id: accountId,
        userId: order.userId,
        orderId: freeOrder.id,
        platform: "MT5",
        login: accountId,
        passwordMaster: "GENERATED_MASTER_PASS",
        passwordInvestor: "GENERATED_INVEST_PASS",
        server: "Range4ex-PendingServer",
        profitTarget: isInstant ? 0 : getStageProfitTarget(plan.name, PHASE_ONE, plan.size),
        balance: plan.size,
        equity: plan.size,
        todayPl: 0,
        totalPl: 0,
        status: isInstant ? "Funded" : "Active",
        phase: isInstant ? PHASE_FUNDED : PHASE_ONE,
        graphLink: "",
        weekendHoldingAddon: Boolean(order.weekendHoldingAddon),
        deliveryStatus: "pending",
        createdAt: now,
      };
      await db.saveAccount(account);
      accounts.push(account);

      await db.saveOfferRedemption({
        id: randomId("redeem-"),
        offerId: offer.id,
        userId: order.userId,
        type: "bogo",
        newAccountId: account.id,
        orderId: freeOrder.id,
        status: "granted",
        createdAt: now,
      });
    }

    const { isExpired, isScheduled, ...storedOffer } = offer;
    await db.saveOffer({
      ...storedOffer,
      redeemedCount: (Number(offer.redeemedCount) || 0) + 1,
      updatedAt: now,
    });

    await db.saveAuditLog({
      id: randomId("log-"),
      userId: order.userId,
      userName: "Offer Engine",
      targetId: order.id,
      targetType: "order",
      action: "bogo_offer_granted",
      description: `Offer "${offer.name}" auto-applied to Order ${order.id}: ${accounts.length} free $${plan.size.toLocaleString()} ${plan.name} account(s) queued for delivery (${accounts.map((item) => `#${item.id}`).join(", ")}).`,
      createdAt: now,
    });

    await db.saveNotification({
      id: randomId("notif-"),
      userId: order.userId,
      title: "Offer Applied — Free Account Unlocked",
      message: `"${offer.name}" was applied to your order ${order.id}. You received ${accounts.length} free $${plan.size.toLocaleString()} ${plan.name} account${accounts.length === 1 ? "" : "s"} (${accounts.map((item) => `#${item.id}`).join(", ")}); credentials appear in your dashboard once delivered.`,
      type: "success",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: now,
    });

    granted.push({ offer, accounts });
  }

  return granted;
}
