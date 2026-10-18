import crypto from "crypto";
import { PAYMENT_CONFIG } from "@/config/payments";
import { DBOrder, DBUser } from "./db";
import { getChallengeRule } from "./rulebook";
import { BRAND_SLUG } from "@/lib/brand";

const PADDLE_PRICE_IDS = PAYMENT_CONFIG.paddle.priceIds;

function getBaseUrl(request: Request): string {
  if (PAYMENT_CONFIG.appUrl) return PAYMENT_CONFIG.appUrl.replace(/\/$/, "");
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return url.origin;
}

function toFormBody(params: Record<string, string | number | undefined>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.append(key, String(value));
  }
  return body;
}

export async function createStripeCheckoutSession(request: Request, order: DBOrder, user: DBUser, planName: string, platform: string) {
  const baseUrl = getBaseUrl(request);
  const locale = new URL(request.url).searchParams.get("locale") || "en";
  const amountCents = Math.round(Number(order.amountPaid) * 100);

  const response = await fetch(`${PAYMENT_CONFIG.stripe.apiBaseUrl}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAYMENT_CONFIG.stripe.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: toFormBody({
      mode: "payment",
      "managed_payments[enabled]": "false",
      customer_email: user.email,
      client_reference_id: order.id,
      success_url: `${baseUrl}/api/orders/pay/stripe-return?session_id={CHECKOUT_SESSION_ID}&locale=${encodeURIComponent(locale)}&platform=${encodeURIComponent(platform)}`,
      cancel_url: `${baseUrl}/pay?orderId=${encodeURIComponent(order.id)}&platform=${encodeURIComponent(platform)}&locale=${encodeURIComponent(locale)}&cancelled=1`,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": amountCents,
      "line_items[0][price_data][product_data][name]": planName,
      "line_items[0][price_data][product_data][description]": `${platform} challenge account`,
      "metadata[orderId]": order.id,
      "metadata[userId]": user.id,
      "metadata[platform]": platform,
      "payment_intent_data[metadata][orderId]": order.id,
      "payment_intent_data[metadata][userId]": user.id,
      "payment_intent_data[metadata][platform]": platform,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Stripe checkout session creation failed.");
  }
  return data;
}

export async function retrieveStripeCheckoutSession(sessionId: string) {
  const response = await fetch(`${PAYMENT_CONFIG.stripe.apiBaseUrl}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${PAYMENT_CONFIG.stripe.secretKey}`,
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Stripe checkout session lookup failed.");
  }
  return data;
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!PAYMENT_CONFIG.stripe.webhookSecret || !signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", PAYMENT_CONFIG.stripe.webhookSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}


export async function createPaddleCheckoutTransaction(
  request: Request,
  order: DBOrder,
  user: DBUser,
  planName: string,
  platform: string,
) {
  const paddleCheckoutDomain = (process.env.PADDLE_CHECKOUT_URL || getBaseUrl(request)).replace(/\/$/, "");
  const locale = new URL(request.url).searchParams.get("locale") || "en";
  const amountCents = Math.round(Number(order.amountPaid) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error("The order total is invalid for Paddle checkout.");

  // Only checks out against a Paddle catalog price if one is explicitly configured for the
  // plan; otherwise builds an ad-hoc inline price from the order's actual total so different
  // account sizes aren't billed the same fixed catalog price.
  const catalogPriceId = PADDLE_PRICE_IDS[getChallengeRule(planName).key] || "";
  const item = catalogPriceId
    ? { price_id: catalogPriceId, quantity: 1 }
    : {
        quantity: 1,
        price: {
          name: planName,
          description: `${platform} challenge account - order ${order.id}`,
          billing_cycle: null,
          tax_mode: "account_setting",
          unit_price: { amount: String(amountCents), currency_code: "USD" },
          product: { name: planName, description: `${platform} trading challenge account`, tax_category: "saas" },
        },
      };

  const response = await fetch(`${PAYMENT_CONFIG.paddle.apiBaseUrl}/transactions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAYMENT_CONFIG.paddle.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      collection_mode: "automatic",
      items: [item],
      custom_data: { orderId: order.id, userId: user.id, platform },
      checkout: { url: `${paddleCheckoutDomain}/pay?orderId=${encodeURIComponent(order.id)}&platform=${encodeURIComponent(platform)}&locale=${encodeURIComponent(locale)}&provider=paddle&success=1` },
    }),
  });
  const data = await response.json();
  if (!response.ok || !data?.data?.checkout?.url || !data?.data?.id) throw new Error(data?.error?.detail || data?.error?.message || "Paddle checkout transaction creation failed.");
  return data.data;
}

export function verifyPaddleWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!PAYMENT_CONFIG.paddle.webhookSecret || !signatureHeader) return false;
  const parts = signatureHeader.split(";").reduce<Record<string, string[]>>((result, part) => {
    const [key, value] = part.trim().split("=", 2);
    if (key && value) (result[key] ||= []).push(value);
    return result;
  }, {});
  const timestamp = parts.ts?.[0];
  const signatures = parts.h1 || [];
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isSafeInteger(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;
  const expected = crypto.createHmac("sha256", PAYMENT_CONFIG.paddle.webhookSecret).update(`${timestamp}:${rawBody}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8");
    return candidate.length === expectedBuffer.length && crypto.timingSafeEqual(candidate, expectedBuffer);
  });
}

export async function createNowPaymentsInvoice(request: Request, order: DBOrder, user: DBUser, planName: string, platform: string) {
  const baseUrl = getBaseUrl(request);
  const locale = new URL(request.url).searchParams.get("locale") || "en";
  const response = await fetch(`${PAYMENT_CONFIG.nowPayments.apiBaseUrl}/invoice`, {
    method: "POST",
    headers: {
      "x-api-key": PAYMENT_CONFIG.nowPayments.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: Number(order.amountPaid),
      price_currency: "usd",
      ipn_callback_url: PAYMENT_CONFIG.nowPayments.ipnCallbackUrl,
      order_id: order.id,
      order_description: `${planName} - ${platform} challenge account`,
      success_url: `${baseUrl}/pay?orderId=${encodeURIComponent(order.id)}&platform=${encodeURIComponent(platform)}&locale=${encodeURIComponent(locale)}&provider=nowpayments&success=1`,
      cancel_url: `${baseUrl}/pay?orderId=${encodeURIComponent(order.id)}&platform=${encodeURIComponent(platform)}&locale=${encodeURIComponent(locale)}&provider=nowpayments&cancelled=1`,
      customer_email: user.email,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "NOWPayments invoice creation failed.");
  }
  return data;
}

// Whop hosted checkout: an inline one-time plan priced at the order's actual total, so
// every account size / coupon / add-on is billed exactly, with the order ids carried in
// metadata for the payment.succeeded webhook.
export async function createWhopCheckout(request: Request, order: DBOrder, user: DBUser, planName: string, platform: string) {
  const { apiBaseUrl, apiKey, companyId } = PAYMENT_CONFIG.whop;
  const baseUrl = getBaseUrl(request);
  const locale = new URL(request.url).searchParams.get("locale") || "en";
  const amount = Math.round(Number(order.amountPaid) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("The order total is invalid for Whop checkout.");

  const response = await fetch(`${apiBaseUrl}/checkout_configurations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "payment",
      metadata: { orderId: order.id, userId: user.id, platform },
      // Whop rejects non-https redirect URLs (local dev), so skip it there and let
      // Whop show its own success page; the webhook still completes the order.
      redirect_url: baseUrl.startsWith("https://")
        ? `${baseUrl}/pay?orderId=${encodeURIComponent(order.id)}&platform=${encodeURIComponent(platform)}&locale=${encodeURIComponent(locale)}&provider=whop&success=1`
        : undefined,
      plan: {
        company_id: companyId,
        currency: "usd",
        plan_type: "one_time",
        release_method: "buy_now",
        visibility: "hidden",
        initial_price: amount,
        title: planName,
        description: `${platform} challenge account - order ${order.id}`,
        product: {
          external_identifier: `${BRAND_SLUG}-${getChallengeRule(planName).key}`,
          title: planName.replace(/\s*\$\d+K$/, "") || "Trading Challenge",
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.id || !data?.purchase_url) {
    throw new Error(data?.error?.message || "Whop checkout creation failed.");
  }
  return { id: String(data.id), checkoutUrl: String(data.purchase_url) };
}

// Whop follows the Standard Webhooks spec: HMAC-SHA256 over "id.timestamp.body", keyed
// with the ws_ secret exactly as Whop shows it, sent as space-separated "v1,<base64>".
export function verifyWhopWebhookSignature(rawBody: string, headers: Headers): boolean {
  const secret = PAYMENT_CONFIG.whop.webhookSecret;
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signatureHeader || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Date.now() - Number(timestamp) * 1000) > 5 * 60 * 1000) return false;
  const expected = Buffer.from(
    crypto.createHmac("sha256", Buffer.from(secret, "utf8")).update(`${id}.${timestamp}.${rawBody}`, "utf8").digest("base64"),
    "utf8",
  );
  return signatureHeader.split(" ").some((part) => {
    const [version, signature] = part.split(",", 2);
    if (version !== "v1" || !signature) return false;
    const candidate = Buffer.from(signature, "utf8");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  });
}

const CODAPAY_COUNTRY_CODES: Record<string, number> = {
  AE: 784, BR: 76, HK: 344, ID: 360, IN: 356, JP: 392, KR: 410, MY: 458,
  MX: 484, PH: 608, SA: 682, SG: 702, TH: 764, TR: 792, TW: 158, US: 840, VN: 704,
};

function getCodaPayCountry(request: Request): number {
  const country = request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry") || "SG";
  return CODAPAY_COUNTRY_CODES[country.toUpperCase()] || 702;
}

export async function createCodaPayCheckout(request: Request, order: DBOrder, user: DBUser, planName: string) {
  const { apiBaseUrl, apiKey, projectId } = PAYMENT_CONFIG.codaPay;
  const country = getCodaPayCountry(request);
  const currency = 840; // Challenge catalogue prices are stored and charged in USD.
  const payType = 0; // CodaPay-hosted channel selection page.
  const response = await fetch(`${apiBaseUrl}/airtime/api/restful/v2.0/Payment/init.json`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initRequest: { country, currency, payType, apiKey, projectId, orderId: order.id, items: [{ code: order.planId, price: Number(order.amountPaid), name: planName }], profile: { entry: [{ key: "user_id", value: user.id }, { key: "email", value: user.email }] } } }),
  });
  const data = await response.json();
  const result = data?.initResult;
  if (!response.ok || Number(result?.resultCode) !== 0 || !result?.txnId) throw new Error(result?.resultDesc || data?.message || "CodaPay checkout initialization failed.");
  const checkoutUrl = new URL(`${apiBaseUrl}/airtime/begin`);
  checkoutUrl.searchParams.set("type", "3"); checkoutUrl.searchParams.set("txn_id", String(result.txnId));
  return { txnId: String(result.txnId), country, checkoutUrl: checkoutUrl.toString() };
}

export async function getCodaPayPaymentResult(txnId: string, country: number) {
  const { apiBaseUrl, apiKey, projectId } = PAYMENT_CONFIG.codaPay;
  const response = await fetch(`${apiBaseUrl}/airtime/api/restful/v2.0/Payment/inquiryPaymentResult.json`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inquiryPaymentRequest: { apiKey, country, projectId, txnId, needStatusFinal: "true" } }),
  });
  const data = await response.json();
  if (!response.ok || !data?.paymentResult) throw new Error(data?.message || "CodaPay payment verification failed.");
  return data.paymentResult;
}

function sortObject(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

export function verifyNowPaymentsIpn(body: any, signatureHeader: string | null): boolean {
  if (!PAYMENT_CONFIG.nowPayments.ipnSecret || !signatureHeader) return false;
  const expected = crypto
    .createHmac("sha512", PAYMENT_CONFIG.nowPayments.ipnSecret)
    .update(JSON.stringify(sortObject(body)))
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
