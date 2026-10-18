import type { DBOffer, DBOfferRedemption } from "./db";
import { normalizeChallengeRuleKey } from "./rulebook";

/**
 * Pure matching rules for promotional offers. Kept free of any database access
 * so the same predicates run on the trader's eligibility read and on the claim
 * write without the two drifting apart.
 */

/** What an offer is being tested against — one account, or one prospective purchase. */
export type OfferTarget = {
  /** Account size in dollars (the plan size, not the live balance). */
  size?: number;
  /** Plan / challenge model name in any spelling; normalized before comparing. */
  planName?: string;
  userId?: string;
  accountId?: string;
};

/**
 * Live means: switched on, inside its date window, and not already used up.
 * An empty/zero `maxRedemptions` is unlimited.
 */
export function isOfferLive(offer: DBOffer, now = Date.now()) {
  if (offer.status !== "active") return false;
  if (offer.startsAt && new Date(offer.startsAt).getTime() > now) return false;
  if (offer.expiresAt && new Date(offer.expiresAt).getTime() <= now) return false;
  const cap = Number(offer.maxRedemptions) || 0;
  if (cap > 0 && (Number(offer.redeemedCount) || 0) >= cap) return false;
  return true;
}

/**
 * Scope test. Every scope list is "empty means all", so an offer with no lists
 * set covers the whole store — that is what makes a site-wide offer one row.
 */
export function offerCoversTarget(offer: DBOffer, target: OfferTarget) {
  const sizes = offer.accountSizes || [];
  if (sizes.length) {
    if (!Number.isFinite(Number(target.size))) return false;
    if (!sizes.some((size) => Number(size) === Number(target.size))) return false;
  }

  const models = offer.models || [];
  if (models.length) {
    if (!target.planName) return false;
    const targetKey = normalizeChallengeRuleKey(target.planName);
    if (!models.some((model) => normalizeChallengeRuleKey(model) === targetKey)) {
      return false;
    }
  }

  const userIds = offer.userIds || [];
  if (userIds.length) {
    if (!target.userId || !userIds.includes(target.userId)) return false;
  }

  const accountIds = offer.accountIds || [];
  if (accountIds.length) {
    if (!target.accountId || !accountIds.includes(target.accountId)) return false;
  }

  return true;
}

/** Retries already granted against one specific failed account, for one offer. */
export function countRetriesUsed(
  redemptions: DBOfferRedemption[],
  offerId: string,
  sourceAccountId: string,
) {
  return redemptions.filter(
    (redemption) =>
      redemption.status !== "revoked" &&
      redemption.type === "free_retry" &&
      redemption.offerId === offerId &&
      redemption.sourceAccountId === sourceAccountId,
  ).length;
}

/**
 * The free-retry offer a failed account can claim right now, or null.
 * When several offers match, the one granting the most remaining retries wins
 * so a trader is never quietly given the stingier of two applicable deals.
 */
export function findFreeRetryOffer(
  offers: DBOffer[],
  redemptions: DBOfferRedemption[],
  target: OfferTarget & { accountId: string },
  now = Date.now(),
) {
  const candidates = offers
    .filter((offer) => offer.type === "free_retry")
    .filter((offer) => isOfferLive(offer, now))
    .filter((offer) => offerCoversTarget(offer, target))
    .map((offer) => {
      const limit = Number(offer.retryLimit) || 0;
      const used = countRetriesUsed(redemptions, offer.id, target.accountId);
      return { offer, remaining: limit - used };
    })
    .filter((candidate) => candidate.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);

  return candidates[0] || null;
}
