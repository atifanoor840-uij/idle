import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";
import { retrieveStripeCheckoutSession } from "@/lib/payments";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id");
    const locale = searchParams.get("locale") || "en";
    const platform = searchParams.get("platform") || "MT5";

    if (!sessionId) {
      return NextResponse.redirect(new URL(`/dashboard?payment=missing-session`, request.url));
    }

    const session = await retrieveStripeCheckoutSession(sessionId);
    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (!orderId || session.payment_status !== "paid") {
      return NextResponse.redirect(new URL(`/pay?orderId=${orderId || ""}&platform=${platform}&locale=${locale}&payment=pending`, request.url));
    }

    const order = await db.getOrderById(orderId);
    if (!order) {
      return NextResponse.redirect(new URL(`/dashboard?payment=order-not-found`, request.url));
    }

    const user = await db.getUserById(order.userId);
    if (!user) {
      return NextResponse.redirect(new URL(`/dashboard?payment=user-not-found`, request.url));
    }

    await fulfillPaidOrder(order, user, session.metadata?.platform || platform, `stripe:${session.id}`);
    return NextResponse.redirect(new URL(`/dashboard?payment=success&orderId=${order.id}`, request.url));
  } catch (error) {
    console.error("Stripe return error:", error);
    return NextResponse.redirect(new URL("/dashboard?payment=error", request.url));
  }
}
