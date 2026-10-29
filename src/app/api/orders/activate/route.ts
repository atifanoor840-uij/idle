import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBOrder } from "@/lib/db";
import { detectCountry } from "@/lib/geo";
import { awaitingFlexActivation } from "@/lib/challengeStages";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

/**
 * Flex: after the evaluation is passed, the trader pays the remaining balance of
 * the real price (the activation fee fixed at checkout, coupon already applied).
 * This creates - or reuses - a pending activation order that goes through the
 * normal /pay flow; its payment issues the funded account.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId, paymentMethod } = await request.json();
    if (!accountId || !paymentMethod) {
      return NextResponse.json({ error: "Account and payment method are required." }, { status: 400 });
    }

    if (String(paymentMethod).toLowerCase().includes("paddle")) {
      const geo = await detectCountry(request);
      if (geo.isPakistan) {
        return NextResponse.json(
          { error: "Card payments are not available in your region. Please pay with cryptocurrency." },
          { status: 403 },
        );
      }
    }

    const account = await db.getAccountById(accountId);
    if (!account || account.userId !== user.id) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (account.status !== "Passed") {
      return NextResponse.json({ error: "The Flex activation fee is due only after the evaluation is passed." }, { status: 400 });
    }

    const parent = await db.getOrderById(account.orderId);
    if (!parent || !awaitingFlexActivation(parent)) {
      return NextResponse.json({ error: "This account has no activation fee to pay." }, { status: 400 });
    }

    const amount = Number(Number(parent.activationFee).toFixed(2));
    const open = (await db.getOrdersByUserId(user.id)).find(
      (o) => o.parentOrderId === parent.id && o.status.toLowerCase() === "pending",
    );

    // Reuse the open activation order unless a crypto proof is already under
    // review on it; switching the method on a fresh order is fine.
    if (open && !String(open.gatewayRef || "").startsWith("manual:")) {
      open.paymentMethod = paymentMethod;
      open.amountPaid = amount;
      open.updatedAt = new Date().toISOString();
      return NextResponse.json({ success: true, order: await db.saveOrder(open) });
    }
    if (open) {
      return NextResponse.json({ success: true, order: open });
    }

    const order: DBOrder = {
      id: "o-" + Math.floor(1000 + Math.random() * 9000),
      userId: user.id,
      planId: parent.planId,
      couponUsed: "",
      amountPaid: amount,
      referralBalanceApplied: 0,
      parentOrderId: parent.id,
      paymentMethod,
      status: "Pending",
      gatewayRef: "gway_" + Math.random().toString(36).substring(2, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.saveOrder(order);

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "Flex Activation Started",
      message: `Activation order ${order.id} for $${amount.toFixed(2)} was created. Complete the payment to receive your funded account.`,
      type: "info",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("Flex activation POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
