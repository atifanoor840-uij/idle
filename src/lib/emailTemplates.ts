import { APP_URL, BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";
export type EmailDetail = { label: string; value: string };
export type EmailAction = { label: string; url: string };

export type BrandedEmailInput = {
  subject: string;
  message: string;
  recipientName?: string;
  recipientEmail?: string;
  details?: EmailDetail[];
  action?: EmailAction;
  sentAt?: Date;
};

type EmailKind = "welcome" | "login" | "order" | "payment" | "delivery" | "challenge" | "kyc" | "payout" | "referral" | "security" | "newsletter" | "general";


// PNG recommended: Gmail/Outlook do not render SVG. Set EMAIL_LOGO_URL to a hosted PNG of your logo.
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || `${APP_URL}/icon.svg`;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function appUrl() {
  return APP_URL;
}

function inferKind(subject: string): EmailKind {
  const value = subject.toLowerCase();
  if (value.includes("newsletter")) return "newsletter";
  if (value.includes("welcome") || value.includes("account confirmed")) return "welcome";
  if (value.includes("login") || value.includes("sign-in") || value.includes("sign in")) return "login";
  if (value.includes("credential") || value.includes("delivered")) return "delivery";
  if (value.includes("payment") || value.includes("order confirmed")) return "payment";
  if (value.includes("order")) return "order";
  if (value.includes("challenge") || value.includes("phase") || value.includes("funded")) return "challenge";
  if (value.includes("verify your") || value.includes("email verified")) return "security";
  if (value.includes("kyc") || value.includes("verification")) return "kyc";
  if (value.includes("payout")) return "payout";
  if (value.includes("referral") || value.includes("commission")) return "referral";
  if (value.includes("password") || value.includes("security") || value.includes("email changed")) return "security";
  return "general";
}

function templateCopy(kind: EmailKind) {
  const templates = {
    welcome: ["Account confirmation", `Your ${BRAND_NAME} profile is ready.`, "Open your dashboard", "#34e834"],
    login: ["Security notice", "A successful sign-in was recorded for your account.", "Review your account", "#68a7ff"],
    order: ["Order update", `Here is the latest update for your ${BRAND_NAME} order.`, "View order", "#34e834"],
    payment: ["Payment confirmation", "Your payment has been recorded successfully.", "View purchase", "#53d6a2"],
    delivery: ["Account delivery", "Your trading account details are ready.", "Open trading accounts", "#53d6a2"],
    challenge: ["Challenge update", "Your trading challenge has a new update.", "View challenge", "#f0bd68"],
    kyc: ["Identity verification", "There is an update to your verification status.", "Review verification", "#68a7ff"],
    payout: ["Payout update", "There is an update to your payout request.", "View payouts", "#53d6a2"],
    referral: ["Referral update", "Your referral activity has a new update.", "View referrals", "#34e834"],
    security: ["Security notice", "An account security change was recorded.", "Review account", "#ff7a8a"],
    newsletter: ["Newsletter subscription", "Your market updates are on the way.", `Visit ${BRAND_NAME}`, "#34e834"],
    general: ["Account update", `You have a new update from ${BRAND_NAME}.`, "Open dashboard", "#34e834"],
  } satisfies Record<EmailKind, [string, string, string, string]>;
  const [eyebrow, intro, button, accent] = templates[kind];
  return { eyebrow, intro, button, accent };
}

function extractDetails(message: string): EmailDetail[] {
  const details: EmailDetail[] = [];
  const pattern = /\b(Login(?: ID)?|Platform|Server|Master Pass(?:word)?|Investor Pass(?:word)?|Order ID|Account ID|Status|Amount|Plan|IP Address|Device):\s*([^|.\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(message)) !== null) {
    const label = match[1].replace(/password/i, "Password");
    const value = match[2].trim();
    if (value && !details.some((item) => item.label.toLowerCase() === label.toLowerCase())) details.push({ label, value });
  }
  const order = message.match(/\border\s+(o-[a-z0-9-]+)\b/i);
  if (order && !details.some((item) => item.label === "Order ID")) details.unshift({ label: "Order ID", value: order[1] });
  const account = message.match(/\baccount\s+([a-z0-9-]{4,})\b/i);
  if (account && !details.some((item) => item.label === "Account ID")) details.unshift({ label: "Account ID", value: account[1] });
  return details;
}

function renderDetails(details: EmailDetail[]) {
  if (!details.length) return "";
  const rows = details.map(({ label, value }) => `<tr><td style="padding:12px 16px;border-bottom:1px solid #292534;color:#aaa4b5;font-size:12px;line-height:18px;text-transform:uppercase;letter-spacing:.08em;width:38%;">${escapeHtml(label)}</td><td style="padding:12px 16px;border-bottom:1px solid #292534;color:#fff;font-size:14px;line-height:20px;font-weight:600;word-break:break-word;">${escapeHtml(value)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border:1px solid #292534;border-radius:12px;border-collapse:separate;overflow:hidden;background:#15131b;">${rows}</table>`;
}

export function renderBrandedEmail(input: BrandedEmailInput) {
  const kind = inferKind(input.subject);
  const copy = templateCopy(kind);
  const baseUrl = appUrl();
  const action = input.action || { label: copy.button, url: `${baseUrl}/dashboard` };
  const supportEmail = SUPPORT_EMAIL;
  const recipientName = input.recipientName?.trim() || "Trader";
  const sentAt = input.sentAt || new Date();
  const details = [...(input.details || []), ...extractDetails(input.message)];

  if (kind === "login") {
    details.push({ label: "Date & time", value: `${sentAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC` });
  }
  if ((kind === "welcome" || kind === "login") && input.recipientEmail) details.unshift({ label: "Account email", value: input.recipientEmail });
  const uniqueDetails = details.filter((detail, index, all) => all.findIndex((item) => item.label.toLowerCase() === detail.label.toLowerCase()) === index);
  const escapedName = recipientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let displayMessage = input.message
    .replace(new RegExp(`^Hi\\s+${escapedName},?\\s*`, "i"), "")
    .replace(new RegExp(`^Welcome\\s+${escapedName}[!.]?\\s*`, "i"), "");
  const detailStart = displayMessage.search(/\b(Login(?: ID)?|Platform|Server|Master Pass(?:word)?|Investor Pass(?:word)?|Order ID|Account ID|Status|Amount|Plan|IP Address|Device):/i);
  if (detailStart > 0) displayMessage = displayMessage.slice(0, detailStart).trim();
  const helpText = kind === "login" || kind === "security"
    ? `If you did not make this request, reset your password and contact <a href="mailto:${escapeHtml(supportEmail)}" target="_blank" rel="noopener noreferrer" style="color:#34e834;text-decoration:none;">${escapeHtml(supportEmail)}</a> immediately.`
    : `Need help? Contact <a href="mailto:${escapeHtml(supportEmail)}" target="_blank" rel="noopener noreferrer" style="color:#34e834;text-decoration:none;">${escapeHtml(supportEmail)}</a>.`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(input.subject)}</title><style>.email-heading{font-family:'Clash Display','DM Sans',Arial,Helvetica,sans-serif!important}.email-body{font-family:'DM Sans',Arial,Helvetica,sans-serif!important}</style></head>
<body class="email-body" style="margin:0;padding:0;background:#0b0a0e;color:#f6f3fb;font-family:'DM Sans',Arial,Helvetica,sans-serif;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0a0e;"><tr><td align="center" style="padding:32px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#111016;border:1px solid #292534;border-radius:18px;overflow:hidden;">
<tr><td style="height:4px;background:${copy.accent};font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:28px 34px 20px;border-bottom:1px solid #24212c;"><a href="${escapeHtml(baseUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;"><img src="${escapeHtml(EMAIL_LOGO_URL)}" width="48" height="48" alt="${BRAND_NAME}" style="display:inline-block;vertical-align:middle;width:48px;height:48px;object-fit:contain;border:0;"><span class="email-heading" style="display:inline-block;vertical-align:middle;margin-left:12px;color:#fff;font-family:'Clash Display','DM Sans',Arial,Helvetica,sans-serif;font-size:22px;font-weight:600;letter-spacing:-.02em;">${BRAND_NAME}</span></a></td></tr>
<tr><td style="padding:34px;"><p style="margin:0 0 12px;color:${copy.accent};font-size:11px;line-height:16px;font-weight:700;letter-spacing:.04em;">${copy.eyebrow}</p><h1 class="email-heading" style="margin:0 0 16px;color:#fff;font-family:'Clash Display','DM Sans',Arial,Helvetica,sans-serif;font-size:28px;line-height:35px;font-weight:600;letter-spacing:-.025em;">${escapeHtml(input.subject)}</h1><p style="margin:0 0 18px;color:#d9d4e1;font-size:16px;line-height:25px;">Hi ${escapeHtml(recipientName)},</p><p style="margin:0;color:#bcb6c7;font-size:15px;line-height:24px;">${escapeHtml(displayMessage).replace(/\n/g, "<br>")}</p>${renderDetails(uniqueDetails)}<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px;"><tr><td style="border-radius:10px;background:${copy.accent};"><a href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 22px;color:#0b0a0e;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;border-radius:10px;">${escapeHtml(action.label)}</a></td></tr></table></td></tr>
<tr><td style="padding:22px 34px;background:#0e0d12;border-top:1px solid #24212c;"><p style="margin:0 0 8px;color:#918a9d;font-size:12px;line-height:19px;">${helpText}</p><p style="margin:0;color:#655f70;font-size:11px;line-height:18px;">This transactional email was sent to ${escapeHtml(input.recipientEmail || "your registered address")} by ${BRAND_NAME}. &copy; ${sentAt.getUTCFullYear()} ${BRAND_NAME}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;

  const plainDetails = uniqueDetails.length ? `\n\nDetails\n${uniqueDetails.map(({ label, value }) => `${label}: ${value}`).join("\n")}` : "";
  const text = `${input.subject}\n\nHi ${recipientName},\n\n${input.message}${plainDetails}\n\n${action.label}: ${action.url}\n\nNeed help? ${supportEmail}\n\n(c) ${sentAt.getUTCFullYear()} ${BRAND_NAME}.`;
  return { html, text, kind };
}
