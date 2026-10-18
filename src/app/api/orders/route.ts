import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBOrder, DBTradingAccount } from "@/lib/db";
import { recordCollaboratorSale } from "@/lib/collaborators";
import { detectCountry } from "@/lib/geo";
import { sendMetaConversionEvent } from "@/lib/metaConversionsApi";
import { grantBogoOffersForOrder } from "@/lib/offerGrants";
import { getOrderPlatform, notifyCredentialsDelivered, reserveInventoryAccount, saveNewAccount } from "@/lib/orderFulfillment";

import {
  PHASE_FUNDED,
  PHASE_ONE,
  PHASE_TWO,
  getNextStagePhase,
  getOrderStatusForPhase,
  getStageAccountStatus,
  getStageProfitTarget,
  planSupportsPhase,
} from "@/lib/challengeStages";
import { applyWeekendHoldingAddon } from "@/lib/rulebook";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

function isCouponUsable(coupon: { status?: string; expiresAt?: string }) {
  const isExpired = Boolean(coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now());
  return coupon.status === "active" && !isExpired;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "admin") {
      const [allOrders, allUsers, allPlans] = await Promise.all([db.getOrders(), db.getUsers(), db.getPlans()]);
      const usersById = new Map(allUsers.map((usr) => [usr.id, usr]));
      const plansById = new Map(allPlans.map((pln) => [pln.id, pln]));
      // Join order details for admin convenience
      const enrichedOrders = allOrders.map((o) => {
        const u = usersById.get(o.userId);
        const p = plansById.get(o.planId);
        return {
          ...o,
          userName: u?.name || "Unknown User",
          userEmail: u?.email || "N/A",
          planName: p ? `${p.name} $${(p.size / 1000).toFixed(0)}K` : "Unknown Plan",
        };
      });
      return NextResponse.json({ success: true, orders: enrichedOrders });
    }

    const [myOrders, plans] = await Promise.all([db.getOrdersByUserId(user.id), db.getPlans()]);
    const enrichedOrders = myOrders.map((o) => {
      const p = plans.find((pln) => pln.id === o.planId);
      return {
        ...o,
        planName: p ? `${p.name} $${(p.size / 1000).toFixed(0)}K` : "Unknown Plan",
      };
    });
    return NextResponse.json({ success: true, orders: enrichedOrders });
  } catch (error: any) {
    console.error("Orders GET API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { planId, couponUsed, paymentMethod, useReferralBalance, expectedAmount } = body;
    const weekendHoldingAddon = Boolean(body.weekendHoldingAddon);

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }

    // Card / digital-wallet (Paddle) checkout is not offered in Pakistan.
    if (String(paymentMethod || "").toLowerCase().includes("paddle")) {
      const geo = await detectCountry(request);
      if (geo.isPakistan) {
        return NextResponse.json(
          { error: "Card payments are not available in your region. Please pay with cryptocurrency." },
          { status: 403 },
        );
      }
    }

    const plan = await db.getPlanById(planId);
    if (!plan) {
      return NextResponse.json({ error: "Challenge plan not found." }, { status: 404 });
    }

    const pricingPlans = await db.getPricingPlans();
    const catalogPlan = pricingPlans.find(
      (item) =>
        item.id === planId &&
        String(item.status || "active").toLowerCase() === "active",
    );
    if (!catalogPlan) {
      return NextResponse.json(
        { error: "This challenge size is not available in the admin pricing catalog." },
        { status: 400 },
      );
    }

    // Ensure the plan exists in the challenge_plans table to satisfy foreign key constraint on orders
    try {
      const allChallengePlans = await db.getPlans();
      const planExists = allChallengePlans.some((p) => p.id === plan.id);
      if (!planExists) {
        await db.savePlan(plan);
      }
    } catch (syncErr) {
      console.warn("Failed to dynamically sync plan to challenge_plans:", syncErr);
    }

    // Price calculation. The Weekend Holding add-on adds 20% to the challenge fee
    // before any coupon or referral discount is applied.
    // Always price from the live admin pricing catalog (what the trader saw on
    // the Buy page). challenge_plans holds a copy made on the first order and
    // goes stale once the admin edits the price.
    const catalogPrice = Number(catalogPlan.price);
    let basePrice = applyWeekendHoldingAddon(catalogPrice, weekendHoldingAddon);
    let discountPercent = 0;
    let isAffiliateRef = false;
    let affiliateUserId = "";
    let commissionAmount = 0;

    if (couponUsed) {
      const normalizedCoupon = couponUsed.trim().toUpperCase();
      const coupons = await db.getCoupons();
      const coupon = coupons.find((item) => item.code === normalizedCoupon);

      if (coupon && isCouponUsable(coupon)) {
        discountPercent = Number(coupon.discountPercent);
      }
    }

    if (!discountPercent && couponUsed) {
      // Check if it is an affiliate code
      const affiliate = await db.getAffiliateByCode(couponUsed.trim());
      if (affiliate) {
        discountPercent = 10; // Give trader 10% off
        isAffiliateRef = true;
        affiliateUserId = affiliate.userId;
        // Affiliate gets percentage commission on final price
        commissionAmount = (basePrice * 0.9) * (affiliate.commissionRate / 100);
      }
    }

    const discountAmount = basePrice * (discountPercent / 100);
    const finalPrice = Math.ceil(basePrice - discountAmount);

    let appliedReferralBalance = 0;
    if (useReferralBalance) {
      const userReferrals = await db.getReferrals();
      const myApprovedReferrals = userReferrals.filter(
        (r) => r.affiliateId === user.id && r.status === "approved"
      );
      const totalAvailable = myApprovedReferrals.reduce((sum, r) => sum + r.commissionAmount, 0);
      appliedReferralBalance = Number(Math.min(finalPrice, totalAvailable).toFixed(2));
    }

    const amountToPay = Number((finalPrice - appliedReferralBalance).toFixed(2));

    // The trader pays exactly what the Buy page showed. If the server total
    // differs (price edited, coupon expired, referral balance changed), refuse
    // instead of recording an amount the trader never agreed to.
    if (
      expectedAmount !== undefined &&
      expectedAmount !== null &&
      Math.abs(Number(expectedAmount) - amountToPay) > 0.01
    ) {
      return NextResponse.json(
        {
          error: `The price for this challenge has changed to $${amountToPay.toFixed(2)}. Please review the updated total and try again.`,
          code: "PRICE_CHANGED",
          amount: amountToPay,
        },
        { status: 409 },
      );
    }

    const orderId = "o-" + Math.floor(1000 + Math.random() * 9000);
    const newOrder: DBOrder = {
      id: orderId,
      userId: user.id,
      planId,
      couponUsed: couponUsed || "",
      amountPaid: amountToPay,
      referralBalanceApplied: appliedReferralBalance,
      weekendHoldingAddon,
      paymentMethod: paymentMethod || "Credit Card",
      status: "Pending", // Pending until payment approved
      gatewayRef: "gway_" + Math.random().toString(36).substring(2, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveOrder(newOrder);

    // Send server-side Meta Conversions API event immediately on order creation.
    // sendMetaConversionEvent also mirrors this into the admin pixel-events log.
    void sendMetaConversionEvent({
      eventName: "Purchase",
      eventId: `purchase_${newOrder.id}`,
      orderId: newOrder.id,
      userId: user.id,
      userData: {
        email: user.email,
      },
      customData: {
        value: Number(newOrder.amountPaid || 0),
        currency: "USD",
        content_ids: [newOrder.planId],
        content_name: plan.name || "Trading challenge",
        content_type: "product",
      },
    });

    // Save affiliate referral if applicable
    if (isAffiliateRef) {
      await db.saveReferral({
        referredUserId: user.id,
        affiliateId: affiliateUserId,
        orderId: orderId,
        commissionAmount: Number(commissionAmount.toFixed(2)),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "Order Initiated",
      message: `Your order ${orderId} for ${plan.name} has been initiated. Complete checkout to deliver your trading credentials.`,
      type: "info",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "Order Created",
      message: `Your order has been created. Order ID: ${orderId} | Plan: ${plan.name} | Amount: $${newOrder.amountPaid.toFixed(2)} | Status: Payment pending. Please complete checkout to activate account provisioning.`,
      type: "info",
      channel: "email",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, order: newOrder });
  } catch (error: any) {
    console.error("Order POST API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    // Standalone toggle: pin this order's account(s) to the legacy (pre-2026-09)
    // rulebook, or move them back to the current rules. Sent without `status`.
    if (typeof body.legacyRules === "boolean" && status === undefined) {
      const order = await db.getOrderById(orderId);
      if (!order) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
      order.legacyRules = body.legacyRules;
      order.updatedAt = new Date().toISOString();
      await db.saveOrder(order);

      await db.saveAuditLog({
        id: "log-" + Math.random().toString(36).substring(2, 11),
        userId: admin.id,
        userName: admin.name,
        targetId: order.id,
        targetType: "order",
        action: "order_rule_version_update",
        description: `Admin set Order ${order.id} rule version to "${body.legacyRules ? "legacy" : "current"}"`,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, order });
    }

    if (!status) {
      return NextResponse.json({ error: "Order ID and status are required." }, { status: 400 });
    }

    const order = await db.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const plan = await db.getPlanById(order.planId);
    const planName = plan ? plan.name : "Challenge Account";

    // One Step and Instant plans have no verification stage — reject before anything is written.
    if (status === "Step2 Active" && !planSupportsPhase(planName, PHASE_TWO)) {
      return NextResponse.json(
        {
          error: `${planName} plans run a single evaluation stage. Move this order straight to "Live Active" instead of Phase 2.`,
        },
        { status: 400 },
      );
    }

    const oldStatus = order.status;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    await db.saveOrder(order);

    await db.saveAuditLog({
      id: "log-" + Math.random().toString(36).substring(2, 11),
      userId: admin.id,
      userName: admin.name,
      targetId: order.id,
      targetType: "order",
      action: "order_status_update",
      description: `Admin updated Order ${order.id} status from "${oldStatus}" to "${status}"`,
      createdAt: new Date().toISOString(),
    });

    const accountsList = await db.getAccounts();

    if (status === "Active" || status.toLowerCase() === "paid") {
      const p1Exists = accountsList.some((a) => a.orderId === order.id && a.phase === PHASE_ONE);
      if (!p1Exists) {
        const accountId = Math.floor(100000 + Math.random() * 900000).toString();
        // Same instant delivery as the payment webhooks: a ready container of
        // this size goes straight onto the account, otherwise it waits in the
        // manual delivery queue.
        const orderPlatform = getOrderPlatform(order);
        const reserved = plan ? await reserveInventoryAccount(order, orderPlatform, plan.size) : undefined;
        const pendingAccount: DBTradingAccount = {
          id: accountId,
          userId: order.userId,
          orderId: order.id,
          platform: orderPlatform as DBTradingAccount["platform"],
          login: accountId,
          passwordMaster: "GENERATED_MASTER_PASS",
          passwordInvestor: "GENERATED_INVEST_PASS",
          server: "Range4ex-PendingServer",
          profitTarget: plan ? getStageProfitTarget(planName, PHASE_ONE, plan.size) : 10000,
          balance: plan ? plan.size : 100000,
          equity: plan ? plan.size : 100000,
          todayPl: 0,
          totalPl: 0,
          status: "Active",
          phase: PHASE_ONE,
          graphLink: "",
          weekendHoldingAddon: order.weekendHoldingAddon ?? false,
          deliveryStatus: "pending",
          createdAt: new Date().toISOString(),
        };
        const { account: newAccount, delivered } = await saveNewAccount(pendingAccount, reserved, order);
        if (delivered) await notifyCredentialsDelivered(newAccount);

        // Live BOGO offers apply on their own — no code — alongside any coupon
        // discount already baked into the price. An offers failure must never
        // block the paid account itself.
        try {
          await grantBogoOffersForOrder(order, plan);
        } catch (offerError) {
          console.warn("BOGO offer grant skipped:", offerError);
        }

        const orderUser = await db.getUserById(order.userId);
        if (orderUser) await recordCollaboratorSale(order, orderUser);

        // Deduct applied referral balance by marking user's approved referrals as paid
        if (order.referralBalanceApplied && order.referralBalanceApplied > 0) {
          const userReferrals = (await db.getReferrals()).filter(
            (r) => r.affiliateId === order.userId && r.status === "approved"
          );
          let remainingToPay = order.referralBalanceApplied;
          for (const ref of userReferrals) {
            if (remainingToPay <= 0) break;
            await db.updateReferralStatus(ref.referredUserId, ref.orderId, "paid");
            remainingToPay -= ref.commissionAmount;
          }
        }

        const referrals = await db.getReferrals();
        const linkedRef = referrals.find((r) => r.orderId === order.id);
        if (linkedRef) {
          await db.updateReferralStatus(order.userId, order.id, "approved");
          await db.saveNotification({
            id: "notif-" + Math.random().toString(36).substring(2, 11),
            userId: linkedRef.affiliateId,
            title: "Referral Commission Earned",
            message: `Your referral link generated a new sale! $${linkedRef.commissionAmount} has been credited to your balance (pending payout).`,
            type: "success",
            channel: "in_app",
            status: "sent",
            read: false,
            sentAt: new Date().toISOString(),
          });
        } else {
          const referredUser = await db.getUserById(order.userId);
          if (referredUser?.referredBy) {
            const commissionAmount = Number((order.amountPaid * 0.05).toFixed(2));
            await db.saveReferral({
              referredUserId: order.userId,
              affiliateId: referredUser.referredBy,
              orderId: order.id,
              commissionAmount,
              status: "approved",
              createdAt: new Date().toISOString(),
            });
            await db.saveNotification({
              id: "notif-" + Math.random().toString(36).substring(2, 11),
              userId: referredUser.referredBy,
              title: "Referral Commission Earned",
              message: `Your referral link generated a new sale! $${commissionAmount} has been credited to your balance (pending payout).`,
              type: "success",
              channel: "in_app",
              status: "sent",
              read: false,
              sentAt: new Date().toISOString(),
            });
          }
        }

        await db.saveNotification({
          id: "notif-" + Math.random().toString(36).substring(2, 11),
          userId: order.userId,
          title: "Order Confirmed & Phase 1 Active",
          message: delivered
            ? `Thank you! Your order ${order.id} was confirmed and your Phase 1 evaluation account is ready in your dashboard.`
            : `Thank you! Your order ${order.id} was confirmed. Your Phase 1 evaluation credentials are currently being generated.`,
          type: "success",
          channel: "in_app",
          status: "sent",
          read: false,
          sentAt: new Date().toISOString(),
        });
      }
    } else if (status === "Step2 Active") {
      const p2Exists = accountsList.some((a) => a.orderId === order.id && a.phase === PHASE_TWO);
      if (!p2Exists) {
        const accountId = Math.floor(100000 + Math.random() * 900000).toString();
        const newAccount: DBTradingAccount = {
          id: accountId,
          userId: order.userId,
          orderId: order.id,
          platform: "MT5",
          login: accountId,
          passwordMaster: "GENERATED_MASTER_PASS",
          passwordInvestor: "GENERATED_INVEST_PASS",
          server: "Range4ex-PendingServer",
          profitTarget: getStageProfitTarget(planName, PHASE_TWO, plan ? plan.size : 100000),
          balance: plan ? plan.size : 100000,
          equity: plan ? plan.size : 100000,
          todayPl: 0,
          totalPl: 0,
          status: "Active",
          phase: PHASE_TWO,
          graphLink: "",
          weekendHoldingAddon: order.weekendHoldingAddon ?? false,
          deliveryStatus: "pending",
          createdAt: new Date().toISOString(),
        };
        await db.saveAccount(newAccount);

        await db.saveNotification({
          id: "notif-" + Math.random().toString(36).substring(2, 11),
          userId: order.userId,
          title: "Phase 2 Verification Generated",
          message: `Congratulations on passing Phase 1! Your Phase 2 Verification trading account is being generated.`,
          type: "success",
          channel: "in_app",
          status: "sent",
          read: false,
          sentAt: new Date().toISOString(),
        });
      }
    } else if (status === "Live Active") {
      const liveExists = accountsList.some((a) => a.orderId === order.id && a.phase === PHASE_FUNDED);
      if (!liveExists) {
        const accountId = Math.floor(100000 + Math.random() * 900000).toString();
        const newAccount: DBTradingAccount = {
          id: accountId,
          userId: order.userId,
          orderId: order.id,
          platform: "MT5",
          login: accountId,
          passwordMaster: "GENERATED_MASTER_PASS",
          passwordInvestor: "GENERATED_INVEST_PASS",
          server: "Range4ex-PendingServer",
          profitTarget: 0,
          balance: plan ? plan.size : 100000,
          equity: plan ? plan.size : 100000,
          todayPl: 0,
          totalPl: 0,
          status: "Funded",
          phase: PHASE_FUNDED,
          graphLink: "",
          weekendHoldingAddon: order.weekendHoldingAddon ?? false,
          deliveryStatus: "pending",
          createdAt: new Date().toISOString(),
        };
        await db.saveAccount(newAccount);

        await db.saveNotification({
          id: "notif-" + Math.random().toString(36).substring(2, 11),
          userId: order.userId,
          title: "Live Funded Account Generated",
          message: `Congratulations on passing your evaluation! Your Live Funded trading account is currently being provisioned.`,
          type: "success",
          channel: "in_app",
          status: "sent",
          read: false,
          sentAt: new Date().toISOString(),
        });
      }
    }

    // Sync account status of the latest account for the order if it changes
    const orderAccounts = (await db.getAccounts()).filter((a) => a.orderId === order.id);
    if (orderAccounts.length > 0) {
      const latestAcc = orderAccounts.reduce((prev, current) => 
        new Date(prev.createdAt) > new Date(current.createdAt) ? prev : current
      );
      if (status === "Failed") {
        latestAcc.status = "Failed";
        await db.saveAccount(latestAcc);
        await db.saveNotification({
          id: "notif-" + Math.random().toString(36).substring(2, 11),
          userId: order.userId,
          title: "Challenge Account Failed",
          message: `Account ${latestAcc.id} has been marked as failed. Please review the rules and contact support if you believe this is incorrect.`,
          type: "error",
          channel: "email",
          status: "sent",
          read: false,
          sentAt: new Date().toISOString(),
        });
      } else if (status === "Passed") {
        const oldStatus = latestAcc.status;
        latestAcc.status = "Passed";
        await db.saveAccount(latestAcc);
        await db.saveNotification({
          id: "notif-" + Math.random().toString(36).substring(2, 11),
          userId: order.userId,
          title: "Challenge Account Passed",
          message: `Account ${latestAcc.id} has been marked as passed. Your next stage or certificate will be processed automatically where applicable.`,
          type: "success",
          channel: "email",
          status: "sent",
          read: false,
          sentAt: new Date().toISOString(),
        });

        // Auto-progress order if account status is marked as Passed (similar to api/accounts route).
        // One Step and Instant plans skip Phase 2 and go straight to Funded (Live).
        const nextPhase = oldStatus !== "Passed" ? getNextStagePhase(planName, latestAcc.phase) : null;
        if (nextPhase) {
          order.status = getOrderStatusForPhase(nextPhase);
          order.updatedAt = new Date().toISOString();
          await db.saveOrder(order);

          const currentAccounts = await db.getAccounts();
          const nextExists = currentAccounts.some((a) => a.orderId === order.id && a.phase === nextPhase);
          if (!nextExists) {
            const accountId = Math.floor(100000 + Math.random() * 900000).toString();
            const newAccount: DBTradingAccount = {
              id: accountId,
              userId: order.userId,
              orderId: order.id,
              platform: latestAcc.platform,
              login: accountId,
              passwordMaster: "GENERATED_MASTER_PASS",
              passwordInvestor: "GENERATED_INVEST_PASS",
              server: "Range4ex-PendingServer",
              profitTarget: getStageProfitTarget(planName, nextPhase, plan ? plan.size : latestAcc.balance),
              balance: latestAcc.balance,
              equity: latestAcc.balance,
              todayPl: 0,
              totalPl: 0,
              status: getStageAccountStatus(nextPhase),
              phase: nextPhase,
              graphLink: "",
              weekendHoldingAddon: order.weekendHoldingAddon ?? false,
              deliveryStatus: "pending",
              createdAt: new Date().toISOString(),
            };
            await db.saveAccount(newAccount);

            await db.saveNotification({
              id: "notif-" + Math.random().toString(36).substring(2, 11),
              userId: order.userId,
              title:
                nextPhase === PHASE_FUNDED
                  ? "Funded Account Ready for Delivery"
                  : "Phase 2 Account Ready for Delivery",
              message:
                nextPhase === PHASE_FUNDED
                  ? `Congratulations on passing ${latestAcc.phase}! Your Live Funded trading account is ready to be delivered by the administrator.`
                  : `Congratulations on passing Phase 1! Your Phase 2 Verification trading account is ready to be delivered by the administrator.`,
              type: "success",
              channel: "in_app",
              status: "sent",
              read: false,
              sentAt: new Date().toISOString(),
            });
          }
        }
      } else if (status === "Replaced") {
        latestAcc.status = "Active";
        latestAcc.todayPl = 0;
        latestAcc.totalPl = 0;
        await db.saveAccount(latestAcc);
      }
    }

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("Order PUT API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

function orderCredentialKey(platform: unknown, server: unknown, login: unknown) {
  return [platform, server, login]
    .map((part) => String(part ?? "").trim().toLowerCase())
    .join("|");
}

export async function DELETE(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const order = await db.getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Remove any trading accounts spawned from this order and release the
    // inventory credentials they were holding, so nothing is left orphaned.
    const linkedAccounts = (await db.getAccounts()).filter(
      (account) => account.orderId === id,
    );

    if (linkedAccounts.length > 0) {
      let inventory: Awaited<ReturnType<typeof db.getChallengeInventory>> = [];
      try {
        inventory = await db.getChallengeInventory();
      } catch (inventoryError) {
        console.warn("Inventory lookup skipped during order deletion:", inventoryError);
      }

      for (const account of linkedAccounts) {
        const heldItem = inventory.find(
          (item) =>
            item.status === "delivered" &&
            orderCredentialKey(item.platform, item.server, item.login) ===
              orderCredentialKey(account.platform, account.server, account.login),
        );
        if (heldItem) {
          heldItem.status = "available";
          heldItem.orderId = undefined;
          try {
            await db.saveChallengeInventoryItem(heldItem);
          } catch (releaseError) {
            console.warn("Inventory release skipped:", releaseError);
          }
        }
        await db.deleteAccount(account.id);
      }
    }

    const deleted = await db.deleteOrder(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Order could not be deleted." },
        { status: 500 },
      );
    }

    await db.saveAuditLog({
      id: "log-" + Math.random().toString(36).substring(2, 11),
      userId: admin.id,
      userName: admin.name,
      targetId: id,
      targetType: "order",
      action: "order_delete",
      description: `Admin deleted Order ${id} (User: ${order.userId}, Status: "${order.status}", Amount: $${Number(order.amountPaid || 0).toFixed(2)}, Linked accounts removed: ${linkedAccounts.length})`,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      removedAccounts: linkedAccounts.length,
    });
  } catch (error: any) {
    console.error("Order DELETE API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
