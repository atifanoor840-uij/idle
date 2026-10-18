import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPaidOrder } from "@/lib/orderFulfillment";
import { getCodaPayPaymentResult } from "@/lib/payments";

async function processNotification(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("OrderId") || searchParams.get("orderId");
  const txnId = searchParams.get("TxnId") || searchParams.get("txnId");
  if (!orderId || !txnId) return NextResponse.json({ error: "CodaPay notification is missing OrderId or TxnId." }, { status: 400 });

  const order = await db.getOrderById(orderId);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const gatewayParts = String(order.gatewayRef || "").split(":");
  const country = Number(gatewayParts[3]);
  if (!Number.isFinite(country)) return NextResponse.json({ error: "CodaPay order is missing its checkout country." }, { status: 409 });
  const result = await getCodaPayPaymentResult(txnId, country);
  const status = result?.profile?.entry?.find((entry: { key?: string }) => entry.key === "status")?.value;
  if (Number(result.resultCode) !== 0 || String(status).toLowerCase() !== "success" || String(result.orderId) !== order.id) {
    return NextResponse.json({ error: "CodaPay payment is not confirmed." }, { status: 409 });
  }
  const user = await db.getUserById(order.userId);
  if (!user) return NextResponse.json({ error: "Order user not found." }, { status: 404 });
  const platform = gatewayParts[2] || "MT5";
  await fulfillPaidOrder(order, user, platform, `codapay:${txnId}:${platform}:${country}`);
  return new NextResponse("ResultCode=0", { status: 200, headers: { "Content-Type": "text/plain" } });
}

export async function GET(request: Request) {
  try {
    return await processNotification(request);
  } catch (error: any) {
    console.error("CodaPay notification error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export const POST = GET;
