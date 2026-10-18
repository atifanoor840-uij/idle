import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBOfferRedemption, DBOrder, DBTradingAccount } from "@/lib/db";
import { findFreeRetryOffer } from "@/lib/offerEligibility";
import { FREE_RETRY_PAYMENT_METHOD } from "@/lib/offerGrants";
import { PHASE_ONE, getStageProfitTarget } from "@/lib/challengeStages";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

function randomId(prefix: string) {
  return prefix + Math.random().toString(36).substring(2, 11);
}

/**
 * The plan behind an account, resolved through its order. Falls back to the
 * account's own balance for the size so a legacy account with a missing order
 * can still be matched against size-scoped offers.
 */
async function resolveAccountPlan(account: DBTradingAccount) {
  const order = account.orderId ? await db.getOrderById(account.orderId) : null;
  const plan = order ? await db.getPlanById(order.planId) : null;
  return {
    order,
    plan,
    planName: plan?.name || account.phase || "",
    size: Number(plan?.size) || Number(account.balance) || 0,
  };
}

/**
 * GET — every failed account of the signed-in trader, with the free retry (if
 * any) that it can currently claim. The dashboard uses this to decide whether
 * to show the claim button.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [offers, redemptions, accounts] = await Promise.all([
      db.getOffers(),
      db.getOfferRedemptions(),
      db.getAccountsByUserId(user.id),
    ]);

    const failedAccounts = accounts.filter((account) => account.status === "Failed");
    const eligibility = [];

    for (const account of failedAccounts) {
      const { planName, size } = await resolveAccountPlan(account);
      const match = findFreeRetryOffer(offers, redemptions, {
        accountId: account.id,
        userId: user.id,
        planName,
        size,
      });

      // A retry already claimed for this account is still worth reporting, so
      // the trader sees "requested" instead of the button simply vanishing.
      const claimed = redemptions.filter(
        (redemption) =>
          redemption.status !== "revoked" &&
          redemption.type === "free_retry" &&
          redemption.sourceAccountId === account.id,
      );

      if (!match && claimed.length === 0) continue;

      eligibility.push({
        accountId: account.id,
        accountSize: size,
        planName,
        claimedCount: claimed.length,
        newAccountId: claimed[claimed.length - 1]?.newAccountId || null,
        offer: match
          ? {
              id: match.offer.id,
              name: match.offer.name,
              retriesRemaining: match.remaining,
            }
          : null,
      });
    }

    return NextResponse.json({ success: true, eligibility });
  } catch (error: any) {
    console.error("GET /api/offers/retry error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

/**
 * POST — the trader claims a free retry on one failed account. This issues a
 * zero-cost order plus a replacement account in "pending delivery", which is
 * the same state a newly bought account sits in, so it lands on the admin's
 * existing Delivery desk with no separate approval queue.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const accountId = String(body.accountId || "").trim();
    if (!accountId) {
      return NextResponse.json({ error: "Account id is required." }, { status: 400 });
    }

    const accounts = await db.getAccounts();
    const account = accounts.find((item) => item.id === accountId);
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    // An admin may claim on a trader's behalf; nobody else may touch it.
    if (account.userId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (account.status !== "Failed") {
      return NextResponse.json(
        { error: "A free retry can only be claimed on a failed account." },
        { status: 400 },
      );
    }

    const [offers, redemptions] = await Promise.all([
      db.getOffers(),
      db.getOfferRedemptions(),
    ]);
    const { order, plan, planName, size } = await resolveAccountPlan(account);

    const match = findFreeRetryOffer(offers, redemptions, {
      accountId: account.id,
      userId: account.userId,
      planName,
      size,
    });
    if (!match) {
      return NextResponse.json(
        { error: "No free retry is available for this account." },
        { status: 400 },
      );
    }

    const offer = match.offer;
    const now = new Date().toISOString();

    // Zero-cost order so the replacement account keeps a plan, a model and a
    // place in the orders ledger exactly like a purchased one.
    const retryOrder: DBOrder = {
      id: randomId("ord-retry-"),
      userId: account.userId,
      planId: order?.planId || plan?.id || "",
      couponUsed: "",
      amountPaid: 0,
      weekendHoldingAddon: Boolean(account.weekendHoldingAddon),
      legacyRules: order?.legacyRules,
      paymentMethod: FREE_RETRY_PAYMENT_METHOD,
      status: "Active",
      gatewayRef: `offer:${offer.id}`,
      createdAt: now,
      updatedAt: now,
    };
    await db.saveOrder(retryOrder);

    const newAccountId = Math.floor(100000 + Math.random() * 900000).toString();
    const retryAccount: DBTradingAccount = {
      id: newAccountId,
      userId: account.userId,
      orderId: retryOrder.id,
      platform: account.platform,
      login: newAccountId,
      passwordMaster: "GENERATED_MASTER_PASS",
      passwordInvestor: "GENERATED_INVEST_PASS",
      server: "Range4ex-PendingServer",
      profitTarget: getStageProfitTarget(planName, PHASE_ONE, size),
      balance: size,
      equity: size,
      todayPl: 0,
      totalPl: 0,
      status: "Active",
      phase: PHASE_ONE,
      graphLink: "",
      weekendHoldingAddon: Boolean(account.weekendHoldingAddon),
      deliveryStatus: "pending",
      createdAt: now,
    };
    await db.saveAccount(retryAccount);

    const redemption: DBOfferRedemption = {
      id: randomId("redeem-"),
      offerId: offer.id,
      userId: account.userId,
      type: "free_retry",
      sourceAccountId: account.id,
      newAccountId: retryAccount.id,
      orderId: retryOrder.id,
      status: "granted",
      createdAt: now,
    };
    await db.saveOfferRedemption(redemption);

    // Counter on the offer itself keeps the admin ledger readable without
    // aggregating the redemption rows on every render.
    const { isExpired, isScheduled, ...storedOffer } = offer;
    await db.saveOffer({
      ...storedOffer,
      redeemedCount: (Number(offer.redeemedCount) || 0) + 1,
      updatedAt: now,
    });

    await db.saveAuditLog({
      id: randomId("log-"),
      userId: user.id,
      userName: user.name,
      targetId: account.id,
      targetType: "account",
      action: "free_retry_claimed",
      description: `Free retry "${offer.name}" claimed on failed Account ${account.id}; replacement Account ${retryAccount.id} queued for delivery (Order ${retryOrder.id}).`,
      createdAt: now,
    });

    await db.saveNotification({
      id: randomId("notif-"),
      userId: account.userId,
      title: "Free Retry Approved",
      message: `Your free retry for Account ${account.id} is confirmed. A new $${Number(size).toLocaleString()} ${planName || "challenge"} account (#${retryAccount.id}) is being provisioned and its credentials will appear in your dashboard shortly.`,
      type: "success",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: now,
    });

    return NextResponse.json({
      success: true,
      account: retryAccount,
      order: retryOrder,
      offer: { id: offer.id, name: offer.name },
      retriesRemaining: match.remaining - 1,
    });
  } catch (error: any) {
    console.error("POST /api/offers/retry error:", error);
    if (
      error?.code === "PGRST205" ||
      error?.code === "PGRST204" ||
      (error?.message && error.message.includes("schema cache"))
    ) {
      return NextResponse.json(
        {
          error:
            "Offers tables are missing. Apply src/lib/offers_migration.sql in Supabase.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
