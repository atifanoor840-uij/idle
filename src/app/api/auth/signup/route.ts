import { NextResponse } from "next/server";
import { db, hashPassword, DBUser } from "@/lib/db";
import { sendDirectEmail } from "@/lib/email";
import {
  createEmailVerificationToken,
  getVerificationUrl,
} from "@/lib/emailVerification";
import { BRAND_NAME } from "@/lib/brand";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, country, password, referralCode, collaboratorCode, locale } = body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const safeLocale = ["en", "ar", "el", "es"].includes(locale) ? locale : "en";

    if (!name || !normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Name, email and password are required fields." },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password must be 8–128 characters." }, { status: 400 });
    }
    if (String(name).trim().length > 120) {
      return NextResponse.json({ error: "Name is too long." }, { status: 400 });
    }

    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email address already exists." },
        { status: 400 },
      );
    }

    let referredBy: string | undefined;
    if (referralCode && referralCode.trim() !== "") {
      const affiliate = await db.getAffiliateByCode(referralCode.trim());
      if (!affiliate) {
        return NextResponse.json(
          { error: "Invalid referral code. Please check the code or clear the field." },
          { status: 400 },
        );
      }
      referredBy = affiliate.userId;
    }

    // Collaborator attribution is a standalone program; it does not write to
    // the legacy referral field or alter the existing affiliate workflow.
    let collaboratorId: string | undefined;
    if (collaboratorCode && collaboratorCode.trim() !== "") {
      const collaborator = await db.getCollaboratorByCode(collaboratorCode);
      if (!collaborator) {
        return NextResponse.json({ error: "This collaborator link is invalid or inactive." }, { status: 400 });
      }
      collaboratorId = collaborator.userId;
    }

    const userId = "u-" + Math.random().toString(36).substring(2, 11);
    const newUser: DBUser = {
      id: userId,
      name,
      email: normalizedEmail,
      phone: phone || "",
      country: country || "United States",
      passwordHash: await hashPassword(password),
      role: "trader",
      status: "active",
      referredBy,
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };

    await db.saveUser(newUser);

    if (collaboratorId) {
      await db.saveCollaboratorAttribution({
        referredUserId: userId,
        collaboratorId,
        createdAt: new Date().toISOString(),
      });
    }

    const generatedReferralCode =
      name.replace(/\s+/g, "").toUpperCase().substring(0, 7) +
      Math.floor(100 + Math.random() * 900);
    await db.saveAffiliate({
      userId,
      referralCode: generatedReferralCode,
      commissionRate: 10,
    });

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId,
      title: `Welcome to ${BRAND_NAME}`,
      message: `Welcome ${name}! Your account has been initialized. Please verify your email address using the link we sent you.`,
      type: "success",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    const { token } = await createEmailVerificationToken(userId);
    const verificationUrl = getVerificationUrl(request, token, safeLocale, normalizedEmail);
    const emailSent = await sendDirectEmail({
      toEmail: normalizedEmail,
      recipientName: name,
      subject: `Verify your ${BRAND_NAME} email address`,
      text: "Confirm your email address to activate your trader profile. This link expires in 24 hours and can be used once.",
      action: { label: "Verify email address", url: verificationUrl },
    });

    const { passwordHash, ...userResponse } = newUser;
    return NextResponse.json({
      success: true,
      user: userResponse,
      emailSent,
      verificationPage: `/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}${emailSent ? "" : "&status=email-failed"}`,
    });
  } catch (error: any) {
    console.error("Sign-up API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
