import nodemailer from "nodemailer";
import { supabase } from "./supabaseClient";
import { BRAND_NAME } from "./brand";
import {
  renderBrandedEmail,
  type EmailAction,
  type EmailDetail,
} from "./emailTemplates";

type BaseEmailPayload = {
  subject: string;
  text: string;
  html?: string;
  details?: EmailDetail[];
  action?: EmailAction;
  /** Big heading / eyebrow label in the branded template (defaults come from the subject). */
  heading?: string;
  eyebrow?: string;
  /** Stored in email_logs.provider; follow-ups use "follow-up" so the CRM knows who was emailed. */
  logTag?: string;
};

type EmailPayload = BaseEmailPayload & {
  userId: string;
};

type DirectEmailPayload = BaseEmailPayload & {
  toEmail: string;
  recipientName?: string;
  userId?: string;
};

const SMTP_CONFIG = {
  host: process.env.HOSTINGER_SMTP_HOST || "smtp.hostinger.com",
  port: Number(process.env.HOSTINGER_SMTP_PORT || 465),
  user: process.env.HOSTINGER_SMTP_USER || "",
  pass: process.env.HOSTINGER_SMTP_PASS || "",
  from: process.env.HOSTINGER_EMAIL_FROM || process.env.HOSTINGER_SMTP_USER || "",
};

// Resend (https://resend.com) is used whenever RESEND_API_KEY is set; SMTP is the fallback.
// RESEND_FROM must be an address on a domain verified in Resend. Until a domain is
// verified, Resend only delivers from onboarding@resend.dev to the Resend account's own email.
const RESEND_CONFIG = {
  apiKey: process.env.RESEND_API_KEY || "",
  from:
    process.env.RESEND_FROM ||
    process.env.HOSTINGER_EMAIL_FROM ||
    `${BRAND_NAME} <onboarding@resend.dev>`,
  replyTo: process.env.SUPPORT_EMAIL || "",
};

export const emailProvider = () => (RESEND_CONFIG.apiKey ? "resend" : "hostinger-smtp");

export const emailConfigured = () =>
  Boolean(RESEND_CONFIG.apiKey) ||
  Boolean(SMTP_CONFIG.user && SMTP_CONFIG.pass && SMTP_CONFIG.from);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sendViaResend(mail: { to: string; subject: string; html: string; text: string }) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_CONFIG.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_CONFIG.from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(RESEND_CONFIG.replyTo ? { reply_to: RESEND_CONFIG.replyTo } : {}),
      }),
    });
    if (res.ok) return;
    // Resend rate-limits per second; back off and retry a few times.
    if (res.status === 429 && attempt < 4) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `Resend request failed (${res.status}).`);
  }
}

async function logEmail(
  payload: BaseEmailPayload & { userId?: string },
  toEmail: string,
  status: "sent" | "failed",
  error?: string,
) {
  try {
    await supabase.from("email_logs").upsert({
      id: "email-" + Math.random().toString(36).substring(2, 11),
      userId: payload.userId || null,
      toEmail,
      subject: payload.subject,
      content: payload.html || payload.text,
      status,
      provider: payload.logTag || emailProvider(),
      error: error || "",
      sentAt: new Date().toISOString(),
    });
  } catch (logErr) {
    console.error("Email log save failed:", logErr);
  }
}

async function sendRenderedEmail(
  payload: BaseEmailPayload & { userId?: string },
  toEmail: string,
  recipientName?: string,
): Promise<boolean> {
  if (!emailConfigured()) {
    await logEmail(
      payload,
      toEmail,
      "failed",
      "Email is not configured (set RESEND_API_KEY or SMTP credentials).",
    );
    return false;
  }

  try {
    const rendered = renderBrandedEmail({
      subject: payload.subject,
      message: payload.text,
      recipientName,
      recipientEmail: toEmail,
      details: payload.details,
      action: payload.action,
      heading: payload.heading,
      eyebrow: payload.eyebrow,
    });
    const html = payload.html || rendered.html;

    if (RESEND_CONFIG.apiKey) {
      await sendViaResend({ to: toEmail, subject: payload.subject, html, text: rendered.text });
    } else {
      const transporter = nodemailer.createTransport({
        host: SMTP_CONFIG.host,
        port: SMTP_CONFIG.port,
        secure: SMTP_CONFIG.port === 465,
        auth: { user: SMTP_CONFIG.user, pass: SMTP_CONFIG.pass },
      });
      await transporter.sendMail({
        from: SMTP_CONFIG.from,
        to: toEmail,
        subject: payload.subject,
        text: rendered.text,
        html,
      });
    }

    await logEmail({ ...payload, html }, toEmail, "sent");
    return true;
  } catch (err: any) {
    await logEmail(payload, toEmail, "failed", err?.message || "Email send failed.");
    return false;
  }
}

export async function sendUserEmail(payload: EmailPayload): Promise<boolean> {
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("email,name")
    .eq("id", payload.userId)
    .maybeSingle();
  const toEmail = user?.email || "";

  if (userError || !toEmail) {
    await logEmail(
      payload,
      toEmail || "unknown",
      "failed",
      userError?.message || "User email not found.",
    );
    return false;
  }

  return sendRenderedEmail(payload, toEmail, user?.name);
}

export async function sendDirectEmail(
  payload: DirectEmailPayload,
): Promise<boolean> {
  const toEmail = payload.toEmail.trim().toLowerCase();
  if (!toEmail) return false;

  return sendRenderedEmail(payload, toEmail, payload.recipientName);
}
