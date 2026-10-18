import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBKyc } from "@/lib/db";
import { formatDiditStatus, getDiditRejectReason, mapDiditStatus } from "@/lib/didit";
import { userIsKycEligible } from "@/lib/kycEligibility";
import { readSessionUserId } from "@/lib/session";

// Helper to check user auth
async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");

    // Admin can view any user's KYC, or filter all KYC requests
    if (user.role === "admin") {
      if (userIdParam) {
        const kyc = await db.getKycByUserId(userIdParam);
        return NextResponse.json({ success: true, kyc });
      }
      const [allKyc, users] = await Promise.all([db.getKyc(), db.getUsers()]);
      // Join with user names for convenience
      const usersById = new Map(users.map((usr) => [usr.id, usr]));
      const enrichedKyc = allKyc.map((k) => {
        const u = usersById.get(k.userId);
        return {
          ...k,
          userName: u?.name || "Unknown User",
          userEmail: u?.email || "N/A",
        };
      });
      return NextResponse.json({ success: true, kyc: enrichedKyc });
    }

    // Trader gets their own KYC record
    const userAccounts = await db.getAccountsByUserId(user.id);
    const isEligible = (user.role as string) === "admin" || userIsKycEligible(userAccounts);
    const kyc = await db.getKycByUserId(user.id);
    return NextResponse.json({ success: true, kyc, isEligible });
  } catch (error: any) {
    console.error("KYC GET API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { method } = body;

    // Check account eligibility for KYC creation or document submission (non-admin users)
    if (method === "didit-create" || !method) {
      if ((user.role as string) !== "admin") {
        const userAccounts = await db.getAccountsByUserId(user.id);
        if (!userIsKycEligible(userAccounts)) {
          return NextResponse.json(
            { error: "KYC verification is only permitted for traders with an active, delivered Funded Account, Instant Account, or Funded Phase Account." },
            { status: 403 }
          );
        }
      }
    }

    // 1. Didit KYC - Session Creation
    if (method === "didit-create") {
      const { isDiditConfigured, DIDIT_CONFIG } = await import("@/config/didit");
      let sessionId = "";
      let sessionUrl = "";
      let sessionToken = "";
      let sessionStatus = "Not Started";

      if (isDiditConfigured()) {
        try {
          const response = await fetch(`${DIDIT_CONFIG.apiBaseUrl}/session/`, {
            method: "POST",
            headers: {
              "x-api-key": DIDIT_CONFIG.apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              workflow_id: DIDIT_CONFIG.workflowId,
              vendor_data: user.id,
              ...(DIDIT_CONFIG.callbackUrl ? { callback: DIDIT_CONFIG.callbackUrl, callback_method: "both" } : {}),
              metadata: {
                user_id: user.id,
                email: user.email,
                source: "dashboard",
              },
              contact_details: {
                email: user.email,
                send_notification_emails: false,
                ...(user.phone ? { phone: user.phone } : {}),
              },
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Didit API error: ${response.status} - ${errText}`);
          }

          const data = await response.json();
          sessionId = data.session_id || "";
          sessionUrl = data.url || "";
          sessionToken = data.session_token || "";
          sessionStatus = formatDiditStatus(data.status);
        } catch (apiErr: any) {
          console.error("Didit session creation error:", apiErr);
          return NextResponse.json({ error: apiErr.message || "Failed to contact Didit API." }, { status: 502 });
        }
      } else {
        // Fallback simulation mode
        sessionId = "didit-mock-session-" + Math.random().toString(36).substring(2, 11);
        sessionUrl = `/dashboard?mock_session_id=${sessionId}`;
        sessionToken = "mock-token-" + Math.random().toString(36).substring(2, 6);
        sessionStatus = "Not Started";
      }

      const newKyc: DBKyc = {
        userId: user.id,
        documentType: "didit",
        frontUrl: sessionId,
        backUrl: sessionUrl,
        selfieUrl: sessionToken,
        addressUrl: sessionStatus, // Store didit status in addressUrl
        status: "pending",
        rejectReason: "",
        updatedAt: new Date().toISOString(),
      };

      await db.saveKyc(newKyc);

      await db.saveNotification({
        id: "notif-" + Math.random().toString(36).substring(2, 11),
        userId: user.id,
        title: "KYC Verification Initiated",
        message: "You have started the Didit third-party identity verification flow.",
        type: "info",
        channel: "in_app",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      });

      await db.saveNotification({
        id: "notif-" + Math.random().toString(36).substring(2, 11),
        userId: user.id,
        title: "KYC Verification Started",
        message: "Your Didit identity verification has been started. We will email you when the verification result is available.",
        type: "info",
        channel: "in_app",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, kyc: newKyc, simulated: !isDiditConfigured() });
    }

    // 2. Didit KYC - Sync Status
    if (method === "didit-sync") {
      const targetUserId = body.userId || user.id;

      // If syncing another user's KYC, caller must be admin
      if (targetUserId !== user.id && user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
      }

      const kyc = await db.getKycByUserId(targetUserId);
      if (!kyc || kyc.documentType !== "didit") {
        return NextResponse.json({ error: "Didit KYC session not found." }, { status: 404 });
      }

      const sessionId = kyc.frontUrl;
      const { isDiditConfigured, DIDIT_CONFIG } = await import("@/config/didit");
      let nextStatus = kyc.addressUrl; // Current Didit status
      let decisionPayload: any = null;

      if (isDiditConfigured()) {
        try {
          const response = await fetch(`${DIDIT_CONFIG.apiBaseUrl}/session/${sessionId}/decision/`, {
            method: "GET",
            headers: {
              "x-api-key": DIDIT_CONFIG.apiKey,
            },
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Didit Decision API error: ${response.status} - ${errText}`);
          }

          const data = await response.json();
          decisionPayload = data;
          nextStatus = formatDiditStatus(data.status || kyc.addressUrl);
        } catch (apiErr: any) {
          console.error("Didit session fetch error:", apiErr);
          return NextResponse.json({ error: apiErr.message || "Failed to contact Didit API." }, { status: 502 });
        }
      } else {
        // Simulation mode
        if (body.simulateStatus) {
          nextStatus = body.simulateStatus;
        } else if (kyc.addressUrl === "Not Started") {
          nextStatus = "In Progress";
        }
      }

      // Map Didit status to local status
      let localStatus = mapDiditStatus(nextStatus);
      let rejectReason = kyc.rejectReason || "";

      if (localStatus === "approved") {
        rejectReason = "";
      } else if (localStatus === "rejected") {
        rejectReason = body.rejectReason || getDiditRejectReason(decisionPayload, nextStatus);
      } else {
        rejectReason = "";
      }

      const updatedKyc: DBKyc = {
        ...kyc,
        addressUrl: nextStatus,
        status: localStatus as any,
        rejectReason,
        updatedAt: new Date().toISOString(),
      };

      await db.saveKyc(updatedKyc);

      // Trigger notification if status changed
      if (localStatus !== kyc.status) {
        const isApproved = localStatus === "approved";
        const isRejected = localStatus === "rejected";

        const notificationPayload = {
          id: "notif-" + Math.random().toString(36).substring(2, 11),
          userId: targetUserId,
          title: isApproved ? "KYC Approved via Didit" : isRejected ? "KYC Action Required" : "KYC Update",
          message: isApproved
            ? "Congratulations! Your Didit identity verification has been approved. You are now authorized to purchase challenge plans."
            : isRejected
            ? `Your Didit KYC verification was rejected. Reason: ${rejectReason}. Please try again.`
            : `Your Didit KYC status was updated to ${nextStatus}.`,
          type: isApproved ? "success" : isRejected ? "error" : "info",
          channel: "in_app",
          status: "sent",
          read: false,
          sentAt: new Date().toISOString(),
        } as const;
        await db.saveNotification(notificationPayload);
        await db.saveNotification({ ...notificationPayload, id: "notif-" + Math.random().toString(36).substring(2, 11), channel: "in_app" });
      }

      return NextResponse.json({ success: true, kyc: updatedKyc, simulated: !isDiditConfigured() });
    }

    // 3. Fallback File-upload KYC
    const { documentType, frontUrl, backUrl, selfieUrl, addressUrl } = body;

    if (!documentType || !frontUrl || !selfieUrl || !addressUrl) {
      return NextResponse.json({ error: "Missing required KYC documents." }, { status: 400 });
    }

    const newKyc: DBKyc = {
      userId: user.id,
      documentType,
      frontUrl,
      backUrl: backUrl || "",
      selfieUrl,
      addressUrl,
      status: "pending",
      rejectReason: "",
      updatedAt: new Date().toISOString(),
    };

    await db.saveKyc(newKyc);

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "KYC Documents Received",
      message: "Your identity verification documents have been received and are queued for admin review.",
      type: "info",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "KYC Documents Submitted",
      message: "Your identity verification documents have been submitted successfully and are waiting for review.",
      type: "info",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, kyc: newKyc });
  } catch (error: any) {
    console.error("KYC POST API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { userId, status, rejectReason } = body;

    if (!userId || !status) {
      return NextResponse.json({ error: "User ID and status are required." }, { status: 400 });
    }

    const kyc = await db.getKycByUserId(userId);
    if (!kyc) {
      return NextResponse.json({ error: "KYC submission not found for this user." }, { status: 404 });
    }

    kyc.status = status;
    if (rejectReason !== undefined) kyc.rejectReason = rejectReason;
    kyc.updatedAt = new Date().toISOString();

    await db.saveKyc(kyc);

    // Trigger notification
    const isApproved = status === "approved";
    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: userId,
      title: isApproved ? "KYC Approved" : "KYC Action Required",
      message: isApproved
        ? "Congratulations! Your identity documents have been approved. You are now authorized to purchase challenges."
        : `Your KYC documents were rejected. Reason: ${rejectReason || "No details provided"}. Please re-submit.`,
      type: isApproved ? "success" : "error",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, kyc });
  } catch (error: any) {
    console.error("KYC PUT API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
