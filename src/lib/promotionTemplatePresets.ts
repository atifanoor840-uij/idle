import { APP_URL, BRAND_NAME } from "@/lib/brand";
import { site } from "@/site.config";
export type PromotionPricingPlan = {
  model: string;
  size: number;
  price: number;
};

export type PromotionTemplatePreset = {
  id: string;
  name: string;
  subject: string;
  html: string;
  model: "Two Step" | "One Step" | "Instant";
};

type PresetTheme = {
  model: PromotionTemplatePreset["model"];
  headline: string;
  description: string;
  subject: string;
};

const CHECKOUT_URL = `${APP_URL}/challenges`;
const LOGO_URL = process.env.EMAIL_LOGO_URL || `${APP_URL}/logo.png`;
const THEMES: PresetTheme[] = [
  { model: "Two Step", headline: "2-Step Challenge", description: "A structured two-phase skill-based evaluation with 4% daily and 6% static loss limits. Pass both phases to qualify for a simulated account with performance rewards up to 90%.", subject: `Start your ${BRAND_NAME} 2-Step Challenge` },
  { model: "One Step", headline: "1-Step Challenge", description: "One focused skill-based evaluation with clear rules and zero hidden conditions. Pass once to qualify for a simulated account with performance rewards up to 90%.", subject: `Start your ${BRAND_NAME} 1-Step Challenge` },
  { model: "Instant", headline: "Instant Account", description: "Skip the evaluation phases. Choose a simulated account size and start trading in a realistic market setting with bi-weekly reward cycles.", subject: `Get your ${BRAND_NAME} Instant Account` },
];

function escapeHtml(value: string | number) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function money(value: number) {
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

function buildHtml(theme: PresetTheme, plans: PromotionPricingPlan[], promoCode: string, discountPercent: number) {
  const rows = plans.slice(0, 3).map((plan) => {
    const offer = plan.price * (1 - discountPercent / 100);
    return `<tr><td style="padding:14px 18px;border-bottom:1px solid #e5e5e5;font-size:16px;font-weight:700;color:#000">${escapeHtml(money(plan.size))}</td><td style="padding:14px 18px;border-bottom:1px solid #e5e5e5;text-align:right;font-size:15px"><span style="color:#777;text-decoration:line-through">${escapeHtml(money(plan.price))}</span>&nbsp; <strong style="color:#000">${escapeHtml(money(offer))}</strong></td></tr>`;
  }).join("") || `<tr><td colspan="2" style="padding:14px 18px;color:#777">Account sizes will be available soon.</td></tr>`;

  // Same look as the website and the transactional emails: black header/footer, white body, grey cards, green CTA.
  const font = "'DM Sans',Arial,Helvetica,sans-serif";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700&display=swap" rel="stylesheet"><style>body,td,th,p,a,h1{font-family:${font}!important}</style></head><body style="margin:0;background:#f6f6f6;font-family:${font};color:#000"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="padding:22px 36px;background:#000"><a href="${APP_URL}" style="text-decoration:none"><img src="${escapeHtml(LOGO_URL)}" height="32" alt="${escapeHtml(BRAND_NAME)}" style="display:block;height:32px;width:auto;border:0"></a></td></tr>
<tr><td style="height:4px;background:#34e834;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:38px 36px 34px"><table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px"><tr><td style="background:#34e834;color:#000;border-radius:10px;padding:5px 10px;font-size:10px;line-height:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(discountPercent)}% off · Limited offer</td></tr></table><h1 style="margin:0 0 14px;font-size:30px;line-height:37px;font-weight:700;letter-spacing:-.02em;color:#000">${escapeHtml(theme.headline)}</h1><p style="margin:0 0 24px;font-size:15px;line-height:25px;color:#141413">${escapeHtml(theme.description)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;border-radius:14px;border-collapse:separate;overflow:hidden"><tr><th align="left" style="padding:14px 18px 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#777;font-weight:500">Simulated account</th><th align="right" style="padding:14px 18px 8px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#777;font-weight:500">Offer price</th></tr>${rows}</table><p style="margin:24px 0 0;font-size:15px;line-height:24px;color:#141413">Use code <strong style="background:#000;color:#34e834;padding:3px 8px;border-radius:6px;letter-spacing:.05em">${escapeHtml(promoCode)}</strong> for ${escapeHtml(discountPercent)}% off at checkout.</p><table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 0"><tr><td style="border-radius:6px;background:#34e834"><a href="${CHECKOUT_URL}" style="display:inline-block;padding:14px 28px;color:#000;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px">Explore Evaluations</a></td></tr></table></td></tr>
<tr><td style="padding:30px 36px;background:#000"><p style="margin:0 0 12px;color:#777;font-size:11px;line-height:17px"><strong style="color:#fff;font-weight:500">Risk warning:</strong> ${escapeHtml(site.footer.riskWarning)}</p><p style="margin:0 0 12px;color:#777;font-size:11px;line-height:17px">${escapeHtml(BRAND_NAME)} is a brand name of ${escapeHtml(site.legalEntity.name)}, registered in England (Company No. ${escapeHtml(site.legalEntity.companyNumber)}).</p><p style="margin:0;color:#fff;font-size:11px;line-height:17px">You are receiving this email from ${escapeHtml(BRAND_NAME)} at {{email}}.</p></td></tr></table></td></tr></table></body></html>`;
}

export function buildPromotionTemplatePresets(pricingPlans: PromotionPricingPlan[], promoCode: string, discountPercent: number): PromotionTemplatePreset[] {
  return THEMES.map((theme) => {
    const plans = pricingPlans.filter((plan) => plan.model === theme.model).sort((a, b) => a.size - b.size).slice(0, 3);
    return { id: `preset-${theme.model.toLowerCase().replace(/\s+/g, "-")}`, name: `${theme.model} Offer`, subject: theme.subject, html: buildHtml(theme, plans, promoCode, discountPercent), model: theme.model };
  });
}
