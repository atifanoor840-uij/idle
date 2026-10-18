import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBOffer } from "@/lib/db";
import { countRetriesUsed, isOfferLive, offerCoversTarget } from "@/lib/offerEligibility";
import {
  BOGO_PAYMENT_METHOD,
  FREE_RETRY_PAYMENT_METHOD,
  parseOfferGatewayRef,
} from "@/lib/offerGrants";
import { readSessionUserId } from "@/lib/session";

export type AccountOfferTag = {
  offerId: string;
  offerName: string;
  offerType: DBOffer["type"];
  /** active = offer is live on this account; granted = account came from the offer; applied = this purchase triggered it. */
  kind: "active" | "granted" | "applied";
  label: string;
  detail: string;
};

/** A live offer as the trader sees it in the Offers section — scope, never other traders' ids. */
export type TraderOffer = {
  id: string;
  name: string;
  type: DBOffer["type"];
  description: string;
  summary: string;
  startsAt?: string;
  expiresAt?: string;
  accountSizes: number[];
  models: string[];
  /** Pinned to specific traders/accounts rather than store-wide. */
  targeted: boolean;
  /** This trader's accounts the offer is attached to, with how. */
  accounts: { accountId: string; login: string; platform: string; kind: AccountOfferTag["kind"] }[];
};

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

function describeBogo(offer: DBOffer) {
  return `Buy ${Number(offer.buyQuantity) || 1}, get ${Number(offer.freeQuantity) || 1} free`;
}

function describeOffer(offer: DBOffer) {
  if (offer.type === "free_retry") {
    const retries = Number(offer.retryLimit) || 1;
    return `${retries} free retr${retries === 1 ? "y" : "ies"} if a covered account fails`;
  }
  return `${describeBogo(offer)} — applied automatically at purchase`;
}

/**
 * GET — offer tags for each of the signed-in trader's accounts (every account
 * for an admin): which live offers cover it, and which offer an account or its
 * purchase came from. Offers are applied automatically, so this is the only
 * place a trader sees that an offer is attached to an account. Also returns
 * every live offer the trader is in scope for, for the Offers section.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.role === "admin";
    const [offers, redemptions, accounts, orders, plans] = await Promise.all([
      db.getOffers(),
      db.getOfferRedemptions(),
      isAdmin ? db.getAccounts() : db.getAccountsByUserId(user.id),
      isAdmin ? db.getOrders() : db.getOrdersByUserId(user.id),
      db.getPlans(),
    ]);
    if (offers.length === 0) {
      return NextResponse.json({ success: true, tags: {}, offers: [] });
    }

    const offerById = new Map(offers.map((offer) => [offer.id, offer]));
    const orderById = new Map(orders.map((order) => [order.id, order]));
    const planById = new Map(plans.map((plan) => [plan.id, plan]));

    // Paid order id -> BOGO offers it triggered.
    const bogoSources = new Map<string, Set<string>>();
    for (const order of orders) {
      if (order.paymentMethod !== BOGO_PAYMENT_METHOD) continue;
      const ref = parseOfferGatewayRef(order.gatewayRef);
      if (!ref?.sourceOrderId) continue;
      const set = bogoSources.get(ref.sourceOrderId) || new Set<string>();
      set.add(ref.offerId);
      bogoSources.set(ref.sourceOrderId, set);
    }

    const tags: Record<string, AccountOfferTag[]> = {};

    for (const account of accounts) {
      const order = account.orderId ? orderById.get(account.orderId) : undefined;
      const plan = order ? planById.get(order.planId) : undefined;
      const size = Number(plan?.size) || Number(account.balance) || 0;
      const planName = plan?.name || account.phase || "";
      const list: AccountOfferTag[] = [];
      const seen = new Set<string>();
      const push = (tag: AccountOfferTag) => {
        const key = `${tag.kind}:${tag.offerId}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push(tag);
      };

      // Account issued by an offer.
      if (order && (order.paymentMethod === BOGO_PAYMENT_METHOD || order.paymentMethod === FREE_RETRY_PAYMENT_METHOD)) {
        const ref = parseOfferGatewayRef(order.gatewayRef);
        const offer = ref ? offerById.get(ref.offerId) : undefined;
        if (offer) {
          push({
            offerId: offer.id,
            offerName: offer.name,
            offerType: offer.type,
            kind: "granted",
            label: order.paymentMethod === BOGO_PAYMENT_METHOD ? `Free · ${offer.name}` : `Free retry · ${offer.name}`,
            detail:
              order.paymentMethod === BOGO_PAYMENT_METHOD
                ? `Issued free by the "${offer.name}" offer (${describeBogo(offer)}).`
                : `Issued free as a retry under the "${offer.name}" offer.`,
          });
        }
      }

      // Purchase that unlocked a BOGO grant.
      for (const offerId of (order && bogoSources.get(order.id)) || []) {
        const offer = offerById.get(offerId);
        if (!offer) continue;
        push({
          offerId: offer.id,
          offerName: offer.name,
          offerType: offer.type,
          kind: "applied",
          label: `${offer.name} applied`,
          detail: `This purchase unlocked the "${offer.name}" offer (${describeBogo(offer)}).`,
        });
      }

      // Live offers currently covering this account.
      for (const offer of offers) {
        if (!isOfferLive(offer)) continue;
        if (!offerCoversTarget(offer, { size, planName, userId: account.userId, accountId: account.id })) continue;

        if (offer.type === "free_retry") {
          const remaining = (Number(offer.retryLimit) || 0) - countRetriesUsed(redemptions, offer.id, account.id);
          if (remaining <= 0) continue;
          push({
            offerId: offer.id,
            offerName: offer.name,
            offerType: offer.type,
            kind: "active",
            label: offer.name,
            detail: `Free retry offer active — ${remaining} free retr${remaining === 1 ? "y" : "ies"} if this account fails.`,
          });
        } else {
          // BOGO triggers on purchases; show it on accounts of a covered size/model
          // so the trader knows buying this again unlocks free accounts.
          push({
            offerId: offer.id,
            offerName: offer.name,
            offerType: offer.type,
            kind: "active",
            label: offer.name,
            detail: `Offer active on this account size — ${describeBogo(offer)}, applied automatically at purchase.`,
          });
        }
      }

      if (list.length) tags[account.id] = list;
    }

    // Live offers this trader can see: store-wide ones, ones naming them, and
    // ones pinned to one of their accounts. Admins see every live offer.
    const accountIds = new Set(accounts.map((account) => account.id));
    const liveOffers: TraderOffer[] = offers
      .filter((offer) => isOfferLive(offer))
      .filter((offer) => {
        if (isAdmin) return true;
        const userIds = offer.userIds || [];
        if (userIds.length && !userIds.includes(user.id)) return false;
        const pinned = offer.accountIds || [];
        if (pinned.length && !pinned.some((id) => accountIds.has(id))) return false;
        return true;
      })
      .map((offer) => ({
        id: offer.id,
        name: offer.name,
        type: offer.type,
        description: offer.description || "",
        summary: describeOffer(offer),
        startsAt: offer.startsAt,
        expiresAt: offer.expiresAt,
        accountSizes: offer.accountSizes || [],
        models: offer.models || [],
        targeted: Boolean((offer.userIds || []).length || (offer.accountIds || []).length),
        accounts: accounts.flatMap((account) => {
          const tag = (tags[account.id] || []).find((item) => item.offerId === offer.id);
          return tag
            ? [{ accountId: account.id, login: account.login || account.id, platform: account.platform || "MT5", kind: tag.kind }]
            : [];
        }),
      }));

    return NextResponse.json({ success: true, tags, offers: liveOffers });
  } catch (error: any) {
    console.error("GET /api/offers/accounts error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
