import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createCodaPayCheckout, createNowPaymentsInvoice, createPaddleCheckoutTransaction, createStripeCheckoutSession, createWhopCheckout } from "@/lib/payments";
import { isCodaPayConfigured, isNowPaymentsConfigured, isPaddleConfigured, isStripeConfigured, isWhopConfigured } from "@/config/payments";
import { detectCountry } from "@/lib/geo";
import { isManualCryptoMethod } from "@/config/manualWallets";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, platform, locale = "en" } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const order = await db.getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (order.userId !== user.id) {
      return NextResponse.json({ error: "Access Denied: Order does not belong to you." }, { status: 403 });
    }

    if (order.status.toLowerCase() !== "pending") {
      return NextResponse.json({ error: `Order is already in ${order.status} status.` }, { status: 400 });
    }

    const plan = await db.getPlanById(order.planId);
    if (!plan) {
      return NextResponse.json({ error: "Challenge plan not found for this order." }, { status: 404 });
    }

    const planName = `${plan.name} $${(plan.size / 1000).toFixed(0)}K`;
    const method = (order.paymentMethod || "").toLowerCase();
    const requestWithLocale = new Request(`${request.url}?locale=${encodeURIComponent(locale)}`, { headers: request.headers });

    // Direct wallet transfers have no hosted checkout; proof goes to /api/orders/manual-payment.
    if (isManualCryptoMethod(order.paymentMethod)) {
      return NextResponse.json({ error: "This order is paid by direct wallet transfer. Submit your TXID and screenshot instead." }, { status: 400 });
    }

    if (method.includes("codapay")) {
      if (!isCodaPayConfigured()) return NextResponse.json({ error: "CodaPay live payments are not configured. Set CODAPAY_API_KEY and CODAPAY_PROJECT_ID." }, { status: 503 });
      const checkout = await createCodaPayCheckout(request, order, user, planName);
      order.gatewayRef = `codapay:${checkout.txnId}:${platform || "MT5"}:${checkout.country}`;
      order.updatedAt = new Date().toISOString();
      await db.saveOrder(order);
      return NextResponse.json({ success: true, provider: "codapay", checkoutUrl: checkout.checkoutUrl, gatewayRef: order.gatewayRef });
    }

    if (method.includes("whop")) {
      if (!isWhopConfigured()) return NextResponse.json({ error: "Whop is not configured. Set WHOP_API_KEY, WHOP_COMPANY_ID and WHOP_WEBHOOK_SECRET." }, { status: 503 });
      const checkout = await createWhopCheckout(requestWithLocale, order, user, planName, platform || "MT5");
      order.gatewayRef = `whop:${checkout.id}:${platform || "MT5"}`;
      order.updatedAt = new Date().toISOString();
      await db.saveOrder(order);
      return NextResponse.json({ success: true, provider: "whop", checkoutUrl: checkout.checkoutUrl, gatewayRef: order.gatewayRef });
    }

    if (method.includes("crypto")) {
      if (!isNowPaymentsConfigured()) {
        return NextResponse.json({ error: "NOWPayments live API key is not configured." }, { status: 503 });
      }

      const invoice = await createNowPaymentsInvoice(requestWithLocale, order, user, planName, platform || "MT5");
      order.gatewayRef = `nowpayments:${invoice.id}:${platform || "MT5"}`;
      order.updatedAt = new Date().toISOString();
      await db.saveOrder(order);

      return NextResponse.json({
        success: true,
        provider: "nowpayments",
        checkoutUrl: invoice.invoice_url,
        gatewayRef: order.gatewayRef,
      });
    }

    if (method.includes("paddle")) {
      const geo = await detectCountry(request);
      if (geo.isPakistan) {
        return NextResponse.json(
          { error: "Card payments are not available in your region. Please pay with cryptocurrency." },
          { status: 403 },
        );
      }
      if (!isPaddleConfigured()) return NextResponse.json({ error: "Paddle is not configured. Set PADDLE_API_KEY and PADDLE_WEBHOOK_SECRET before accepting payments." }, { status: 503 });
      const transaction = await createPaddleCheckoutTransaction(requestWithLocale, order, user, planName, platform || "MT5");
      order.gatewayRef = `paddle:${transaction.id}:${platform || "MT5"}`;
      order.updatedAt = new Date().toISOString();
      await db.saveOrder(order);
      return NextResponse.json({ success: true, provider: "paddle", checkoutUrl: transaction.checkout.url, gatewayRef: order.gatewayRef });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ error: "Stripe live secret key is not configured. Use an sk_live_ key for live card payments." }, { status: 503 });
    }

    const session = await createStripeCheckoutSession(requestWithLocale, order, user, planName, platform || "MT5");
    order.gatewayRef = `stripe:${session.id}`;
    order.updatedAt = new Date().toISOString();
    await db.saveOrder(order);

    return NextResponse.json({
      success: true,
      provider: "stripe",
      checkoutUrl: session.url,
      gatewayRef: order.gatewayRef,
    });
  } catch (error: any) {
    console.error("Payment API POST error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
