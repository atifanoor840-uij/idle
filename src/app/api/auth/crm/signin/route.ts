import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, checkUserPassword } from "@/lib/db";
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

    // Check if the user is an admin or support personnel
    if (user.role !== "admin" && user.role !== "support") {
      return NextResponse.json(
        { error: "Access Denied: Admin or Support privileges are required to access this portal." },
        { status: 403 }
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

    // Store session cookie
    const cookieStore = await cookies();
    cookieStore.set("prop_session", signSession(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "New CRM portal login",
      message: `Hi ${user.name}, your CRM portal account was just used to sign in.`,
      type: "info",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    const { passwordHash, ...userResponse } = user;

    return NextResponse.json({ success: true, user: userResponse });
  } catch (error: any) {
    console.error("CRM Sign-in API error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
