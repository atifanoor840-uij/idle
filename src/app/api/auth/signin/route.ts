import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, checkUserPassword } from "@/lib/db";
import { BRAND_NAME } from "@/lib/brand";
import { signSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required fields." },
        { status: 400 }
      );
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 400 }
      );
    }

    // Collaborators have an isolated portal and must not enter the trader login.
    if (user.role === "collaborator") {
      return NextResponse.json(
        { error: "Please use the dedicated Collaborator Portal to sign in." },
        { status: 403 },
      );
    }

    if (user.status !== "active") {
      return NextResponse.json(
        { error: `Your account is currently ${user.status}. Contact support.` },
        { status: 403 }
      );
    }

    // Verify password hash
    if (!(await checkUserPassword(user, password))) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 400 }
      );
    }

    // An unverified email no longer blocks sign-in: users who skip verification
    // still get a session, and the flag travels back so the UI can nudge them.
    const emailVerified = user.emailVerified !== false;

    // Store session cookie
    const cookieStore = await cookies();
    cookieStore.set("prop_session", signSession(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "Unavailable";
    const device = request.headers.get("user-agent") || "Unknown device";

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: `New login to your ${BRAND_NAME} account`,
      message: `Hi ${user.name}, we noticed a successful login to your account. IP Address: ${ipAddress} | Device: ${device}. If this was not you, please contact support immediately.`,
      type: "info",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    const { passwordHash, ...userResponse } = user;

    return NextResponse.json({ success: true, user: userResponse, emailVerified });
  } catch (error: any) {
    console.error("Sign-in API error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
