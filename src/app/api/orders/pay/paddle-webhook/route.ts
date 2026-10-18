import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";
import { verifyPaddleWebhookSignature } from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifyPaddleWebhookSignature(rawBody, request.headers.get("paddle-signature"))) {
      return NextResponse.json({ error: "Invalid Paddle webhook signature." }, { status: 401 });
    }
    const event = JSON.parse(rawBody);
    if (event.event_type !== "transaction.completed") return NextResponse.json({ success: true, ignored: true });

    const transaction = event.data;
    const orderId = transaction?.custom_data?.orderId;
    const userId = transaction?.custom_data?.userId;
    const platform = transaction?.custom_data?.platform || "MT5";
    if (!orderId || !userId || !transaction?.id) return NextResponse.json({ error: "Paddle transaction is missing required order metadata." }, { status: 400 });

    const order = await db.getOrderById(orderId);
    if (!order || order.userId !== userId) return NextResponse.json({ error: "Paddle order reference is invalid." }, { status: 400 });
    if (!String(order.gatewayRef || "").startsWith(`paddle:${transaction.id}:`)) {
      return NextResponse.json({ error: "Paddle transaction does not match the active order checkout." }, { status: 409 });
    }
    const user = await db.getUserById(order.userId);
    if (!user) return NextResponse.json({ error: "Order user not found." }, { status: 404 });

    await fulfillPaidOrder(order, user, platform, `paddle:${transaction.id}:${platform}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Paddle webhook error:", error);
    return NextResponse.json({ error: "Unable to process Paddle webhook." }, { status: 500 });
  }
}
