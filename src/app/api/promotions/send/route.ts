import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendDirectEmail } from "@/lib/email";
import { readSessionUserId } from "@/lib/session";

const PROMOTION_EMAILS_ENABLED = false;

const sendPromotionSchema = z.object({
  subject: z.string().trim().min(1, "Email subject is required.").max(200),
  html: z.string().trim().min(1, "HTML template is required.").max(25000, "Keep promotion HTML under 25 KB for better deliverability."),
  recipients: z
    .array(z.string().trim().email())
    .min(1, "Add at least one recipient.")
    .max(100, "A promotion can contain at most 100 recipients."),
});

async function getAdmin() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  const user = await db.getUserById(userId);
  return user?.role === "admin" ? user : null;
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function replaceRecipientVariables(value: string, email: string) {
  return value.replace(/\{\{\s*email\s*\}\}/gi, email);
}

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Bulk promotional mail from the transactional SMTP account gets it flagged and
  // suspended, so sending is switched off; only essential account emails go out.
  if (!PROMOTION_EMAILS_ENABLED) {
    return NextResponse.json(
      { error: "Promotional emails are disabled. Only account emails (verification, orders, delivery, pass/fail) are sent." },
      { status: 403 },
    );
  }

  const parsed = sendPromotionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid promotion." },
      { status: 400 },
    );
  }

  if (parsed.data.html.includes("ADD-CODE")) {
    return NextResponse.json(
      { error: "Replace ADD-CODE with a real active coupon before sending." },
      { status: 400 },
    );
  }

  const recipients = Array.from(
    new Set(parsed.data.recipients.map((email) => email.toLowerCase())),
  );
  const results: Array<{ email: string; sent: boolean }> = [];

  for (let index = 0; index < recipients.length; index += 5) {
    const batch = recipients.slice(index, index + 5);
    const batchResults = await Promise.all(
      batch.map(async (email) => {
        const html = replaceRecipientVariables(parsed.data.html, email);
        const sent = await sendDirectEmail({
          toEmail: email,
          recipientName: "Trader",
          subject: parsed.data.subject,
          text: htmlToText(html),
          html,
        });
        return { email, sent };
      }),
    );
    results.push(...batchResults);
  }

  const sentCount = results.filter((result) => result.sent).length;
  const failed = results
    .filter((result) => !result.sent)
    .map((result) => result.email);

  return NextResponse.json({
    success: failed.length === 0,
    sentCount,
    failedCount: failed.length,
    failed,
  });
}
