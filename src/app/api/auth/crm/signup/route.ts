import crypto from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, hashPassword, DBUser } from "@/lib/db";
import { signSession } from "@/lib/session";

// Constant-time compare so the passcode can't be guessed character by character from response timing.
function passcodeMatches(given: string, expected: string) {
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  try {
    // Admin sign-up is closed unless a passcode is configured; there is no default.
    const expectedPasscode = process.env.CRM_ADMIN_PASSCODE || "";
    if (expectedPasscode.length < 8) {
      return NextResponse.json({ error: "Admin sign-up is disabled. Set CRM_ADMIN_PASSCODE (8+ characters) to enable it." }, { status: 503 });
    }

    const body = await request.json();
    const name = String(body.name || "").trim().slice(0, 120);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const passcode = String(body.passcode || "");

    if (!name || !email || !password || !passcode) {
      return NextResponse.json(
        { error: "Name, email, password and admin passcode are required fields." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (password.length < 10) {
      return NextResponse.json({ error: "Admin passwords must be at least 10 characters." }, { status: 400 });
    }

    if (!passcodeMatches(passcode, expectedPasscode)) {
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
      country: "United Kingdom",
      passwordHash: await hashPassword(password),
      role: "admin", // Admin role for CRM Portal
      status: "active",
      createdAt: new Date().toISOString(),
    };

    await db.saveUser(newUser);

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
    return NextResponse.json({ error: "Could not create the admin account." }, { status: 500 });
  }
}
