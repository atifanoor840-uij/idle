import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";
import { verifyNowPaymentsIpn } from "@/lib/payments";

const FINAL_NOWPAYMENTS_STATUSES = new Set(["finished"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!verifyNowPaymentsIpn(body, request.headers.get("x-nowpayments-sig"))) {
      return NextResponse.json({ error: "Invalid NOWPayments IPN signature." }, { status: 401 });
    }

    const orderId = body.order_id;
    const paymentStatus = String(body.payment_status || "").toLowerCase();
    if (!orderId) {
      return NextResponse.json({ error: "NOWPayments IPN missing order_id." }, { status: 400 });
    }

    const order = await db.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const existingGatewayParts = String(order.gatewayRef || "").split(":");
    const platform = existingGatewayParts[0] === "nowpayments" ? existingGatewayParts[2] || "MT5" : "MT5";
    order.gatewayRef = `nowpayments:${body.invoice_id || body.payment_id || body.purchase_id || "unknown"}:${platform}`;
    order.updatedAt = new Date().toISOString();

    if (FINAL_NOWPAYMENTS_STATUSES.has(paymentStatus)) {
      const user = await db.getUserById(order.userId);
      if (!user) {
        return NextResponse.json({ error: "Order user not found." }, { status: 404 });
      }
      await fulfillPaidOrder(order, user, platform, order.gatewayRef);
    } else if (["failed", "refunded", "expired"].includes(paymentStatus)) {
      // Distinct from a trading-challenge "Failed" (rule breach on a delivered
      // account) — this order never got an account, the crypto payment itself
      // didn't go through. Keeping the string separate stops payment failures
      // from showing up in the admin "Failed" (challenge) tab.
      order.status = "Payment Failed";
      await db.saveOrder(order);
    } else {
      await db.saveOrder(order);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("NOWPayments IPN error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
