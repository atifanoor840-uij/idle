import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, hashPassword, DBUser } from "@/lib/db";
import { signSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, passcode } = body;

    if (!name || !email || !password || !passcode) {
      return NextResponse.json(
        { error: "Name, email, password and admin passcode are required fields." },
        { status: 400 }
      );
    }

    // Verify admin passcode
    const expectedPasscode = process.env.CRM_ADMIN_PASSCODE || "ADMIN123";
    if (passcode !== expectedPasscode) {
      return NextResponse.json(
        { error: "Invalid Admin Security Passcode. Access denied." },
        { status: 403 }
      );
    }

    // Check if email already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email address already exists." },
        { status: 400 }
      );
    }

    // Create admin user object
    const userId = "u-admin-" + Math.random().toString(36).substring(2, 11);
    const newUser: DBUser = {
      id: userId,
      name,
      email,
      phone: "",
      country: "United States",
      passwordHash: await hashPassword(password),
      role: "admin", // Admin role for CRM Portal
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await db.saveUser(newUser);

    // Create default welcome notification for admin
    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: userId,
      title: "Welcome to Administrative Console",
      message: `Welcome ${name}! Your administrator account has been initialized. You have full access to the CRM telemetry and trader directory.`,
      type: "success",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId,
      title: "Welcome to the CRM Administrative Console",
      message: `Welcome ${name}! Your administrator account has been created and is ready to access the CRM portal.`,
      type: "success",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    // Store session cookie
    const cookieStore = await cookies();
    cookieStore.set("prop_session", signSession(userId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Strip password hash before sending back
    const { passwordHash, ...userResponse } = newUser;

    return NextResponse.json({ success: true, user: userResponse });
  } catch (error: any) {
    console.error("CRM Sign-up API error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
