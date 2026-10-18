import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";
import { verifyStripeWebhookSignature } from "@/lib/payments";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifyStripeWebhookSignature(rawBody, request.headers.get("stripe-signature"))) {
      return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
      return NextResponse.json({ success: true, ignored: true });
    }

    const session = event.data?.object;
    if (!session || session.payment_status !== "paid") {
      return NextResponse.json({ success: true, ignored: true });
    }

    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "Stripe session missing order reference." }, { status: 400 });
    }

    const order = await db.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const user = await db.getUserById(order.userId);
    if (!user) {
      return NextResponse.json({ error: "Order user not found." }, { status: 404 });
    }

    await fulfillPaidOrder(order, user, session.metadata?.platform || "MT5", `stripe:${session.id}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
