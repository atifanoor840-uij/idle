import nodemailer from "nodemailer";
import { supabase } from "./supabaseClient";
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
};

type EmailPayload = BaseEmailPayload & {
  userId: string;
};

type DirectEmailPayload = BaseEmailPayload & {
  toEmail: string;
  recipientName?: string;
};

const SMTP_CONFIG = {
  host: process.env.HOSTINGER_SMTP_HOST || "smtp.hostinger.com",
  port: Number(process.env.HOSTINGER_SMTP_PORT || 465),
  user: process.env.HOSTINGER_SMTP_USER || "",
  pass: process.env.HOSTINGER_SMTP_PASS || "",
  from: process.env.HOSTINGER_EMAIL_FROM || process.env.HOSTINGER_SMTP_USER || "",
};

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
      provider: "hostinger-smtp",
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
  if (!SMTP_CONFIG.user || !SMTP_CONFIG.pass || !SMTP_CONFIG.from) {
    await logEmail(
      payload,
      toEmail,
      "failed",
      "Hostinger SMTP credentials are not configured.",
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
    });
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
      html: payload.html || rendered.html,
    });

    await logEmail(
      { ...payload, html: payload.html || rendered.html },
      toEmail,
      "sent",
    );
    return true;
  } catch (err: any) {
    await logEmail(
      payload,
      toEmail,
      "failed",
      err.message || "SMTP send failed.",
    );
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