import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";
import {
  buildManualGatewayRef,
  getManualWallet,
  getTxidError,
  isManualCryptoMethod,
  parseManualGatewayRef,
} from "@/config/manualWallets";
import { readSessionUserId } from "@/lib/session";

const PROOF_BUCKET = "payment-proofs";
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROOF_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

// The bucket is private; create it on first use so no dashboard setup is needed.
async function ensureProofBucket() {
  const { data } = await supabase.storage.getBucket(PROOF_BUCKET);
  if (data) return;
  const { error } = await supabase.storage.createBucket(PROOF_BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw error;
}

// Trader submits the TXID + screenshot for a pending "Crypto QR" order.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await request.formData();
    const orderId = String(form.get("orderId") || "");
    const walletId = String(form.get("walletId") || "");
    const txid = String(form.get("txid") || "").trim();
    const screenshot = form.get("screenshot");

    const order = orderId ? await db.getOrderById(orderId) : undefined;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.userId !== user.id) {
      return NextResponse.json({ error: "Access Denied: Order does not belong to you." }, { status: 403 });
    }
    if (!isManualCryptoMethod(order.paymentMethod)) {
      return NextResponse.json({ error: "This order is not a QR wallet payment." }, { status: 400 });
    }
    if (String(order.status || "").toLowerCase() !== "pending") {
      return NextResponse.json({ error: `Order is already in ${order.status} status.` }, { status: 400 });
    }
    if (parseManualGatewayRef(order.gatewayRef)) {
      return NextResponse.json({ error: "Payment proof was already submitted for this order." }, { status: 409 });
    }

    const wallet = getManualWallet(walletId);
    if (!wallet) return NextResponse.json({ error: "Select a valid wallet network." }, { status: 400 });
    const txidError = getTxidError(wallet.id, txid);
    if (txidError) return NextResponse.json({ error: txidError }, { status: 400 });
    if (!(screenshot instanceof File) || screenshot.size === 0) {
      return NextResponse.json({ error: "Upload a screenshot of the transfer." }, { status: 400 });
    }
    const extension = ALLOWED_PROOF_TYPES[screenshot.type];
    if (!extension) return NextResponse.json({ error: "Screenshot must be PNG, JPG, or WEBP." }, { status: 400 });
    if (screenshot.size > MAX_PROOF_BYTES) {
      return NextResponse.json({ error: "Screenshot must be 5 MB or smaller." }, { status: 400 });
    }

    // One on-chain transfer can only pay for one order.
    const normalizedTxid = txid.toLowerCase();
    const allOrders = await db.getOrders();
    const reused = allOrders.some(
      (other) => other.id !== order.id && parseManualGatewayRef(other.gatewayRef)?.txid.toLowerCase() === normalizedTxid,
    );
    if (reused) {
      return NextResponse.json({ error: "This transaction ID was already used for another order." }, { status: 409 });
    }

    await ensureProofBucket();
    const proofPath = `${order.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(PROOF_BUCKET)
      .upload(proofPath, Buffer.from(await screenshot.arrayBuffer()), { contentType: screenshot.type });
    if (uploadError) throw uploadError;

    order.gatewayRef = buildManualGatewayRef(wallet.id, txid, proofPath);
    order.updatedAt = new Date().toISOString();
    await db.saveOrder(order);

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "Payment Proof Submitted",
      message: `We received your ${wallet.label} payment proof for order ${order.id}. Your account will be activated once an admin verifies the transaction.`,
      type: "info",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("Manual payment POST API error:", error);
    return NextResponse.json({ error: "Could not submit payment proof. Please try again." }, { status: 500 });
  }
}

// Admin: short-lived link to view an order's payment screenshot.
export async function GET(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const orderId = new URL(request.url).searchParams.get("orderId");
    const order = orderId ? await db.getOrderById(orderId) : undefined;
    const proof = parseManualGatewayRef(order?.gatewayRef);
    if (!proof) return NextResponse.json({ error: "No payment proof on this order." }, { status: 404 });

    const { data, error } = await supabase.storage.from(PROOF_BUCKET).createSignedUrl(proof.proofPath, 600);
    if (error) throw error;

    return NextResponse.json({ success: true, url: data.signedUrl, ...proof });
  } catch (error: any) {
    console.error("Manual payment GET API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
