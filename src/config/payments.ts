import { APP_URL } from "@/lib/brand";
export const PAYMENT_CONFIG = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "",
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    secretKey: process.env.STRIPE_SECRET_KEY || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    apiBaseUrl: "https://api.stripe.com/v1",
  },
  nowPayments: {
    apiKey: process.env.NOWPAYMENTS_API_KEY || "",
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || "",
    apiBaseUrl: "https://api.nowpayments.io/v1",
    ipnCallbackUrl: `${APP_URL}/api/orders/pay/nowpayments-ipn`,
  },
  paddle: {
    apiKey: process.env.PADDLE_API_KEY || "",
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || "",
    environment: process.env.PADDLE_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
    apiBaseUrl: process.env.PADDLE_ENVIRONMENT === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com",
    // Paddle catalog price IDs, keyed by challenge rule. A plan listed here checks out against
    // the catalog price instead of an ad-hoc inline price.
    priceIds: {
      two_step_standard: process.env.PADDLE_TWO_STEP_PRICE_ID || "",
      one_step_pro: process.env.PADDLE_ONE_STEP_PRICE_ID || "",
      instant_funding: process.env.PADDLE_INSTANT_PRICE_ID || "",
    } as Record<string, string>,
  },
  whop: {
    apiKey: process.env.WHOP_API_KEY || "",
    // Company (business) id from the Whop dashboard URL, e.g. biz_xxxxxxxxxxxxxx.
    companyId: process.env.WHOP_COMPANY_ID || "",
    webhookSecret: process.env.WHOP_WEBHOOK_SECRET || "",
    apiBaseUrl: "https://api.whop.com/api/v1",
  },
  codaPay: {
    apiKey: process.env.CODAPAY_API_KEY || "",
    projectId: Number(process.env.CODAPAY_PROJECT_ID),
    environment: process.env.CODAPAY_ENVIRONMENT === "sandbox" ? "sandbox" : "production",
    apiBaseUrl: process.env.CODAPAY_ENVIRONMENT === "sandbox" ? "https://sandbox.codapayments.com" : "https://airtime.codapayments.com",
  },
};

export function isStripeConfigured(): boolean {
  return PAYMENT_CONFIG.stripe.secretKey.startsWith("sk_live_");
}

export function isStripePublishableKeyConfigured(): boolean {
  return PAYMENT_CONFIG.stripe.publishableKey.startsWith("pk_live_");
}

export function isNowPaymentsConfigured(): boolean {
  return !!PAYMENT_CONFIG.nowPayments.apiKey && PAYMENT_CONFIG.nowPayments.apiKey !== "YOUR_NOWPAYMENTS_API_KEY";
}

export function isPaddleConfigured(): boolean {
  return !!PAYMENT_CONFIG.paddle.apiKey && !!PAYMENT_CONFIG.paddle.webhookSecret;
}

export function isCodaPayConfigured(): boolean {
  const { apiKey, projectId } = PAYMENT_CONFIG.codaPay;
  return Boolean(apiKey) && !apiKey.startsWith("test_") && Number.isFinite(projectId);
}

export function isWhopConfigured(): boolean {
  const { apiKey, companyId, webhookSecret } = PAYMENT_CONFIG.whop;
  return Boolean(apiKey) && companyId.startsWith("biz_") && Boolean(webhookSecret);
}
