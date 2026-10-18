import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";
import { verifyWhopWebhookSignature } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifyWhopWebhookSignature(rawBody, request.headers)) {
      return NextResponse.json({ error: "Invalid Whop webhook signature." }, { status: 401 });
    }
    const event = JSON.parse(rawBody);
    if (event.type !== "payment.succeeded") return NextResponse.json({ success: true, ignored: true });

    const payment = event.data;
    const orderId = payment?.metadata?.orderId;
    const userId = payment?.metadata?.userId;
    const platform = payment?.metadata?.platform || "MT5";
    const checkoutId = payment?.checkout_configuration_id;
    if (!orderId || !userId || !payment?.id) return NextResponse.json({ error: "Whop payment is missing required order metadata." }, { status: 400 });

    const order = await db.getOrderById(orderId);
    if (!order || order.userId !== userId) return NextResponse.json({ error: "Whop order reference is invalid." }, { status: 400 });
    // Already fulfilled (Whop retries deliveries): acknowledge so it stops retrying.
    if (order.status.toLowerCase() !== "pending") return NextResponse.json({ success: true, alreadyProcessed: true });
    if (!checkoutId || !String(order.gatewayRef || "").startsWith(`whop:${checkoutId}:`)) {
      return NextResponse.json({ error: "Whop payment does not match the active order checkout." }, { status: 409 });
    }
    const paidUsd = Number(payment.usd_total ?? payment.subtotal ?? payment.total);
    if (Number.isFinite(paidUsd) && paidUsd + 0.01 < Number(order.amountPaid)) {
      return NextResponse.json({ error: "Whop payment amount is below the order total." }, { status: 409 });
    }
    const user = await db.getUserById(order.userId);
    if (!user) return NextResponse.json({ error: "Order user not found." }, { status: 404 });

    await fulfillPaidOrder(order, user, platform, `whop:${checkoutId}:${platform}:${payment.id}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Whop webhook error:", error);
    return NextResponse.json({ error: "Unable to process Whop webhook." }, { status: 500 });
  }
}
