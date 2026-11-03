import { APP_URL, BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";
import { site } from "@/site.config";
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
// logo.png is the white wordmark the website shows on its black header.
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || `${APP_URL}/logo.png`;

// Website design tokens (src/app/(marketing)/globals.css).
const THEME = {
  green: "#34e834",
  black: "#000000",
  ink: "#141413",
  card: "#f6f6f6",
  muted: "#777777",
  line: "#e5e5e5",
  red: "#f65144",
  font: "'DM Sans',Arial,Helvetica,sans-serif",
};

const FOOTER_LINKS = [
  { label: "Trading Rules", href: "/rules" },
  { label: "Reward Policy", href: "/payout-policy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Contact Us", href: "/contact" },
];

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
  if (value.includes("credential") || value.includes("delivered") || value.includes("simulated account")) return "delivery";
  if (value.includes("payment") || value.includes("order confirmed")) return "payment";
  if (value.includes("order")) return "order";
  if (value.includes("challenge") || value.includes("evaluation") || value.includes("phase") || value.includes("funded")) return "challenge";
  if (value.includes("verify your") || value.includes("email verified")) return "security";
  if (value.includes("kyc") || value.includes("verification")) return "kyc";
  if (value.includes("payout")) return "payout";
  if (value.includes("referral") || value.includes("commission")) return "referral";
  if (value.includes("password") || value.includes("security") || value.includes("email changed")) return "security";
  return "general";
}

function templateCopy(kind: EmailKind) {
  // Wording follows the website: simulated accounts, skill-based evaluations, performance rewards.
  const templates = {
    welcome: ["Welcome", `Your ${BRAND_NAME} trader profile is ready. Choose a simulated account size and start your skill-based evaluation.`, "Explore Evaluations", THEME.green],
    login: ["Security notice", "A successful sign-in was recorded for your account.", "Review your account", THEME.green],
    order: ["Order update", `Here is the latest update for your ${BRAND_NAME} evaluation order.`, "View order", THEME.green],
    payment: ["Payment confirmed", "Your program fee has been received. Your simulated account is being prepared.", "View purchase", THEME.green],
    delivery: ["Simulated account ready", "Your simulated account login details are ready. Trade with discipline and follow the evaluation rules.", "Open My Accounts", THEME.green],
    challenge: ["Evaluation update", "Your trading evaluation has a new update.", "View evaluation", THEME.green],
    kyc: ["Identity verification", "There is an update to your verification status.", "Review verification", THEME.green],
    payout: ["Performance reward", "There is an update to your performance reward request.", "View rewards", THEME.green],
    referral: ["Affiliate update", "Your affiliate activity has a new update.", "View affiliates", THEME.green],
    security: ["Security notice", "An account security change was recorded.", "Review account", THEME.red],
    newsletter: ["Newsletter", "You're subscribed. Educational sessions and evaluation insights are on the way.", `Visit ${BRAND_NAME}`, THEME.green],
    general: ["Account update", `You have a new update from ${BRAND_NAME}.`, "Open dashboard", THEME.green],
  } satisfies Record<EmailKind, [string, string, string, string]>;
  const [eyebrow, intro, button, accent] = templates[kind];
  return { eyebrow, intro, button, accent };
}

// Where each email's button leads when the sender passes no explicit action.
const DEFAULT_PATHS: Record<EmailKind, string> = {
  welcome: "/challenges",
  login: "/settings",
  order: "/billing",
  payment: "/billing",
  delivery: "/accounts",
  challenge: "/accounts",
  kyc: "/profile",
  payout: "/payouts",
  referral: "/affiliate",
  security: "/settings",
  newsletter: "",
  general: "/dashboard",
};

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
  // Real account ids contain a digit; this keeps phrases like "account login" from matching.
  const account = message.match(/\baccount\s+(?=[a-z-]*\d)([a-z0-9-]{4,})\b/i);
  if (account && !details.some((item) => item.label === "Account ID")) details.unshift({ label: "Account ID", value: account[1] });
  return details;
}

function renderDetails(details: EmailDetail[]) {
  if (!details.length) return "";
  const rows = details.map(({ label, value }, i) => {
    const border = i < details.length - 1 ? `border-bottom:1px solid ${THEME.line};` : "";
    return `<tr><td style="padding:13px 18px;${border}color:${THEME.muted};font-size:12px;line-height:18px;text-transform:uppercase;letter-spacing:.1em;width:38%;">${escapeHtml(label)}</td><td style="padding:13px 18px;${border}color:${THEME.black};font-size:14px;line-height:20px;font-weight:700;word-break:break-word;">${escapeHtml(value)}</td></tr>`;
  }).join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0;border-radius:14px;border-collapse:separate;overflow:hidden;background:${THEME.card};">${rows}</table>`;
}

export function renderBrandedEmail(input: BrandedEmailInput) {
  const kind = inferKind(input.subject);
  const copy = templateCopy(kind);
  const baseUrl = appUrl();
  const action = input.action || { label: copy.button, url: `${baseUrl}${DEFAULT_PATHS[kind]}` };
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
  const supportLink = supportEmail
    ? `<a href="mailto:${escapeHtml(supportEmail)}" target="_blank" rel="noopener noreferrer" style="color:${THEME.black};font-weight:700;text-decoration:underline;">${escapeHtml(supportEmail)}</a>`
    : `<a href="${escapeHtml(baseUrl)}/contact" target="_blank" rel="noopener noreferrer" style="color:${THEME.black};font-weight:700;text-decoration:underline;">our support team</a>`;
  const helpText = kind === "login" || kind === "security"
    ? `If you did not make this request, reset your password and contact ${supportLink} immediately.`
    : `Need help? Our team is available 24/7 at ${supportLink}.`;
  const year = sentAt.getUTCFullYear();
  const legal = site.legalEntity;
  const footerLinks = FOOTER_LINKS.map((link) => `<a href="${escapeHtml(baseUrl + link.href)}" target="_blank" rel="noopener noreferrer" style="color:${THEME.muted};text-decoration:none;">${escapeHtml(link.label)}</a>`).join(`<span style="color:#333;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`);

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(input.subject)}</title><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet"><style>body,td,p,a,h1{font-family:${THEME.font}!important}@media (max-width:620px){.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:25px!important;line-height:31px!important}}</style></head>
<body style="margin:0;padding:0;background:${THEME.card};color:${THEME.black};font-family:${THEME.font};-webkit-font-smoothing:antialiased;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(copy.intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${THEME.card};"><tr><td align="center" style="padding:32px 12px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;">
<tr><td class="px" style="padding:22px 36px;background:${THEME.black};"><a href="${escapeHtml(baseUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;text-decoration:none;"><img src="${escapeHtml(EMAIL_LOGO_URL)}" height="32" alt="${BRAND_NAME}" style="display:block;height:32px;width:auto;max-width:160px;border:0;"></a></td></tr>
<tr><td style="height:4px;background:${copy.accent};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td class="px" style="padding:38px 36px 34px;"><table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px;"><tr><td style="background:${copy.accent};color:${THEME.black};border-radius:10px;padding:5px 10px;font-size:10px;line-height:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</td></tr></table><h1 class="h1" style="margin:0 0 18px;color:${THEME.black};font-size:30px;line-height:37px;font-weight:700;letter-spacing:-.02em;">${escapeHtml(input.subject)}</h1><p style="margin:0 0 14px;color:${THEME.ink};font-size:16px;line-height:25px;font-weight:500;">Hi ${escapeHtml(recipientName)},</p><p style="margin:0;color:${THEME.ink};font-size:15px;line-height:25px;font-weight:400;">${escapeHtml(displayMessage).replace(/\n/g, "<br>")}</p>${renderDetails(uniqueDetails)}<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 6px;"><tr><td style="border-radius:6px;background:${THEME.green};"><a href="${escapeHtml(action.url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;color:${THEME.black};font-size:15px;line-height:20px;font-weight:700;text-decoration:none;border-radius:6px;">${escapeHtml(action.label)}</a></td></tr></table><p style="margin:26px 0 0;padding-top:22px;border-top:1px solid ${THEME.line};color:${THEME.muted};font-size:13px;line-height:21px;">${helpText}</p></td></tr>
<tr><td class="px" style="padding:30px 36px;background:${THEME.black};"><img src="${escapeHtml(EMAIL_LOGO_URL)}" height="22" alt="${BRAND_NAME}" style="display:block;height:22px;width:auto;max-width:110px;border:0;margin:0 0 14px;"><p style="margin:0 0 18px;color:${THEME.muted};font-size:12px;line-height:19px;">${escapeHtml(site.tagline.join(" · "))}</p><p style="margin:0 0 20px;font-size:12px;line-height:20px;">${footerLinks}</p><p style="margin:0 0 12px;color:${THEME.muted};font-size:11px;line-height:17px;"><strong style="color:#ffffff;font-weight:500;">Risk warning:</strong> ${escapeHtml(site.footer.riskWarning)}</p><p style="margin:0 0 12px;color:${THEME.muted};font-size:11px;line-height:17px;">${escapeHtml(BRAND_NAME)} is a brand name of ${escapeHtml(legal.name)}, registered in England (Company No. ${escapeHtml(legal.companyNumber)}). Registered office: ${escapeHtml(legal.registeredOffice)}.</p><p style="margin:0;color:#ffffff;font-size:11px;line-height:17px;">This email was sent to ${escapeHtml(input.recipientEmail || "your registered address")}. &copy; ${year} ${escapeHtml(BRAND_NAME)}. All rights reserved.</p></td></tr></table></td></tr></table></body></html>`;

  const plainDetails = uniqueDetails.length ? `\n\nDetails\n${uniqueDetails.map(({ label, value }) => `${label}: ${value}`).join("\n")}` : "";
  const text = `${input.subject}\n\nHi ${recipientName},\n\n${input.message}${plainDetails}\n\n${action.label}: ${action.url}\n\nNeed help? ${supportEmail || `${baseUrl}/contact`}\n\nRisk warning: ${site.footer.riskWarning}\n\n${BRAND_NAME} is a brand name of ${legal.name} (Company No. ${legal.companyNumber}).\n(c) ${year} ${BRAND_NAME}.`;
  return { html, text, kind };
}
