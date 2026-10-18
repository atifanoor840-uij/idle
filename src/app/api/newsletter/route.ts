import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";
import { readSessionUserId } from "@/lib/session";

const subscriptionSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(320).transform((value) => value.toLowerCase()),
  source: z.enum(["footer", "home"]).default("footer"),
});

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return db.getUserById(userId);
}

export async function POST(request: Request) {
  try {
    const parsed = subscriptionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid subscription details." }, { status: 400 });
    }

    const { email, source } = parsed.data;
    const { data: subscriber, error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email, source, status: "active", "emailStatus": "pending" })
      .select("id,email,source,status,emailStatus,createdAt")
      .single();

    if (error?.code === "23505") {
      return NextResponse.json({ success: true, alreadySubscribed: true, message: "This email is already subscribed." });
    }
    if (error) {
      console.error("Newsletter subscription insert failed:", error);
      return NextResponse.json({ error: "Newsletter subscriptions are temporarily unavailable." }, { status: 503 });
    }

    // No welcome email: outgoing mail is limited to essential account emails
    // (verification, order, delivery, pass/fail) to protect the sending domain.
    return NextResponse.json({
      success: true,
      subscriber,
      message: "You are subscribed.",
    });
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return NextResponse.json({ error: "Unable to process the subscription." }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "admin" && user.role !== "support")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id,email,source,status,emailStatus,confirmationSentAt,createdAt,updatedAt")
      .order("createdAt", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, subscribers: data || [] });
  } catch (error) {
    console.error("Newsletter subscribers GET error:", error);
    return NextResponse.json({ error: "Unable to load newsletter subscribers." }, { status: 500 });
  }
}