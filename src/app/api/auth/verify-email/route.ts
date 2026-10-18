import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumeEmailVerificationToken } from "@/lib/emailVerification";
import { BRAND_NAME } from "@/lib/brand";
import { signSession } from "@/lib/session";

const locales = ["en", "ar", "el", "es"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const localeParam = url.searchParams.get("locale") || "en";
  const email = url.searchParams.get("email") || "";
  const locale = locales.includes(localeParam) ? localeParam : "en";
  const destination = new URL("/auth/verify-email", url.origin);
  if (email) destination.searchParams.set("email", email);

  try {
    const result = await consumeEmailVerificationToken(token);
    destination.searchParams.set("status", result.status === "verified" ? "success" : result.status);

    if (result.status === "verified") {
      const cookieStore = await cookies();
      cookieStore.set("prop_session", signSession(result.user.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      });

      try {
        await db.saveNotification({
          id: "notif-" + Math.random().toString(36).substring(2, 11),
          userId: result.user.id,
          title: `Email verified — welcome to ${BRAND_NAME}`,
          message: `Welcome ${result.user.name}! Your email address has been verified and your trader profile is now active.`,
          type: "success",
          channel: "in_app",
          status: "sent",
          read: false,
          sentAt: new Date().toISOString(),
        });
      } catch (notificationError) {
        console.error("Verification welcome email failed:", notificationError);
      }
    }
  } catch (error) {
    console.error("Email verification failed:", error);
    destination.searchParams.set("status", "error");
  }

  return NextResponse.redirect(destination);
}
