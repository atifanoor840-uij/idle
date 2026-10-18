// Server only (imports db): live challenge prices for the marketing site, read from the same
// pricing_plans table the checkout uses (POST /api/orders prices from it too).
import { db } from "./db";
import { PUBLIC_MODELS, type PublicModel } from "./publicRules";
import { getChallengeRule } from "./rulebook";

export type PricedModel = PublicModel & { sizes: { planId: string; size: number; price: number }[] };

const FALLBACK_PLANS: { id: string; model: "Two Step" | "One Step" | "Instant"; size: number; price: number }[] = [
  { id: "pp-two-step-5k", model: "Two Step", size: 5000, price: 39 },
  { id: "pp-two-step-10k", model: "Two Step", size: 10000, price: 79 },
  { id: "pp-two-step-25k", model: "Two Step", size: 25000, price: 179 },
  { id: "pp-two-step-50k", model: "Two Step", size: 50000, price: 299 },
  { id: "pp-two-step-100k", model: "Two Step", size: 100000, price: 499 },
  { id: "pp-two-step-200k", model: "Two Step", size: 200000, price: 949 },
  { id: "pp-one-step-5k", model: "One Step", size: 5000, price: 49 },
  { id: "pp-one-step-10k", model: "One Step", size: 10000, price: 99 },
  { id: "pp-one-step-25k", model: "One Step", size: 25000, price: 219 },
  { id: "pp-one-step-50k", model: "One Step", size: 50000, price: 349 },
  { id: "pp-one-step-100k", model: "One Step", size: 100000, price: 579 },
  { id: "pp-one-step-200k", model: "One Step", size: 200000, price: 1099 },
  { id: "pp-instant-5k", model: "Instant", size: 5000, price: 99 },
  { id: "pp-instant-10k", model: "Instant", size: 10000, price: 189 },
  { id: "pp-instant-25k", model: "Instant", size: 25000, price: 399 },
  { id: "pp-instant-50k", model: "Instant", size: 50000, price: 749 },
  { id: "pp-instant-100k", model: "Instant", size: 100000, price: 1399 },
];

export async function getPublicPricing(): Promise<PricedModel[]> {
  let plans: Awaited<ReturnType<typeof db.getPricingPlans>> = [];
  try {
    plans = await db.getPricingPlans();
  } catch (error) {
    console.error("Pricing: could not load pricing_plans", error);
  }
  const active = plans
    .filter((p) => String(p.status || "active").toLowerCase() === "active")
    .map((p) => ({
      ...p,
      model: getChallengeRule(p.model).buyLabel,
    }));

  const source = active.length > 0 ? active : FALLBACK_PLANS;

  return PUBLIC_MODELS.map((m) => ({
    ...m,
    sizes: source
      .filter((p) => p.model === m.dbModel)
      .map((p) => ({ planId: p.id, size: Number(p.size), price: Number(p.price) }))
      .sort((a, b) => a.size - b.size),
  })).filter((m) => m.sizes.length > 0);
}
