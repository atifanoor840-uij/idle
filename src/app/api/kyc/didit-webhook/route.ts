import { NextResponse } from "next/server";
import { DIDIT_CONFIG } from "@/config/didit";
import { db, DBKyc } from "@/lib/db";
import { formatDiditStatus, getDiditRejectReason, mapDiditStatus, verifyDiditWebhookSignature } from "@/lib/didit";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!DIDIT_CONFIG.webhookSecret) {
      return NextResponse.json({ error: "Didit webhook secret is not configured." }, { status: 503 });
    }

    if (!verifyDiditWebhookSignature(body, request.headers, DIDIT_CONFIG.webhookSecret)) {
      return NextResponse.json({ error: "Invalid Didit webhook signature." }, { status: 401 });
    }

    if (!["status.updated", "data.updated"].includes(body.webhook_type)) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const targetUserId = body.vendor_data || body.metadata?.user_id;
    const sessionId = body.session_id || body.decision?.session_id;
    if (!targetUserId || !sessionId) {
      return NextResponse.json({ error: "Didit webhook missing vendor_data or session_id." }, { status: 400 });
    }

    const kyc = await db.getKycByUserId(targetUserId);
    if (!kyc || kyc.documentType !== "didit" || kyc.frontUrl !== sessionId) {
      return NextResponse.json({ success: true, ignored: true });
    }

    const nextStatus = formatDiditStatus(body.status || body.decision?.status || kyc.addressUrl);
    const localStatus = mapDiditStatus(nextStatus);
    const rejectReason = localStatus === "rejected" ? getDiditRejectReason(body, nextStatus) : "";
    const updatedKyc: DBKyc = {
      ...kyc,
      addressUrl: nextStatus,
      status: localStatus,
      rejectReason,
      updatedAt: new Date().toISOString(),
    };

    await db.saveKyc(updatedKyc);

    if (localStatus !== kyc.status) {
      const notificationPayload = {
        id: "notif-" + Math.random().toString(36).substring(2, 11),
        userId: targetUserId,
        title: localStatus === "approved" ? "KYC Approved via Didit" : localStatus === "rejected" ? "KYC Action Required" : "KYC Update",
        message:
          localStatus === "approved"
            ? "Congratulations! Your Didit identity verification has been approved. You are now authorized to purchase challenge plans."
            : localStatus === "rejected"
            ? `Your Didit KYC verification was rejected. Reason: ${rejectReason}. Please try again.`
            : `Your Didit KYC status was updated to ${nextStatus}.`,
        type: localStatus === "approved" ? "success" : localStatus === "rejected" ? "error" : "info",
        channel: "in_app",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      } as const;
      await db.saveNotification(notificationPayload);
      await db.saveNotification({ ...notificationPayload, id: "notif-" + Math.random().toString(36).substring(2, 11), channel: "in_app" });
    }

    return NextResponse.json({ success: true, kyc: updatedKyc });
  } catch (error: any) {
    console.error("Didit webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
