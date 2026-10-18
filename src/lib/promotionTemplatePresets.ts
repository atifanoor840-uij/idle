import { APP_URL, BRAND_NAME } from "@/lib/brand";
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

const CHECKOUT_URL = `${APP_URL}/dashboard`;
const THEMES: PresetTheme[] = [
  { model: "Two Step", headline: "Two-Step Evaluation", description: "A structured two-phase path for disciplined traders.", subject: `Explore the ${BRAND_NAME} Two-Step evaluation` },
  { model: "One Step", headline: "One-Step Evaluation", description: "One focused evaluation on your path to funding.", subject: `Explore the ${BRAND_NAME} One-Step evaluation` },
  { model: "Instant", headline: "Instant Funding", description: "Choose an account size and start your funded journey.", subject: `Explore ${BRAND_NAME} instant funding` },
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
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #e8e8e8;font-weight:700">${escapeHtml(money(plan.size))}</td><td style="padding:8px 0;border-bottom:1px solid #e8e8e8;text-align:right"><span style="color:#777;text-decoration:line-through">${escapeHtml(money(plan.price))}</span> <strong>${escapeHtml(money(offer))}</strong></td></tr>`;
  }).join("") || `<tr><td colspan="2" style="padding:12px 0;color:#666">Account sizes will be available soon.</td></tr>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#202020"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e5e5e5"><tr><td style="padding:28px"><p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:1.5px;color:#1a8f1a">${escapeHtml(BRAND_NAME.toUpperCase())}</p><h1 style="margin:0 0 12px;font-size:27px;line-height:34px">${escapeHtml(theme.headline)}</h1><p style="margin:0 0 20px;font-size:15px;line-height:23px;color:#555">${escapeHtml(theme.description)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px"><tr><th align="left" style="padding:0 0 7px">Account size</th><th align="right" style="padding:0 0 7px">Offer price</th></tr>${rows}</table><p style="margin:20px 0 0;font-size:14px">Use code <strong>${escapeHtml(promoCode)}</strong> for ${escapeHtml(discountPercent)}% off at checkout.</p><p style="margin:22px 0 0"><a href="${CHECKOUT_URL}" style="display:inline-block;background:#34e834;color:#000;padding:12px 18px;text-decoration:none;font-weight:700">View account options</a></p><p style="margin:24px 0 0;font-size:11px;line-height:16px;color:#777">You are receiving this email from ${escapeHtml(BRAND_NAME)} at {{email}}. Trading involves risk.</p></td></tr></table></td></tr></table></body></html>`;
}

export function buildPromotionTemplatePresets(pricingPlans: PromotionPricingPlan[], promoCode: string, discountPercent: number): PromotionTemplatePreset[] {
  return THEMES.map((theme) => {
    const plans = pricingPlans.filter((plan) => plan.model === theme.model).sort((a, b) => a.size - b.size).slice(0, 3);
    return { id: `preset-${theme.model.toLowerCase().replace(/\s+/g, "-")}`, name: `${theme.model} Offer`, subject: theme.subject, html: buildHtml(theme, plans, promoCode, discountPercent), model: theme.model };
  });
}
