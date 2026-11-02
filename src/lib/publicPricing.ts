// Server only (imports db): challenge prices for the marketing site. Displayed prices come from
// DISPLAY_PRICES below (real price struck through + discounted price); plan ids are matched
// from the pricing_plans table the checkout uses (POST /api/orders prices from it).
import { db } from "./db";
import { PUBLIC_MODELS, type PublicModel } from "./publicRules";
import { getChallengeRule } from "./rulebook";

export type PricedModel = PublicModel & {
  sizes: { planId: string; size: number; price: number; realPrice: number }[];
};

type Model = "Two Step" | "One Step" | "Instant";

// [size, real price, discounted price]
const DISPLAY_PRICES: Record<Model, [number, number, number][]> = {
  "One Step": [
    [3000, 48, 15],
    [5000, 55, 16],
    [10000, 71, 23],
    [25000, 103, 29],
    [50000, 159, 51],
    [100000, 255, 73],
    [200000, 359, 112],
  ],
  "Two Step": [
    [3000, 39, 12],
    [5000, 45, 13],
    [10000, 69, 19],
    [25000, 91, 27],
    [50000, 141, 40],
    [100000, 203, 64],
    [200000, 333, 96],
  ],
  Instant: [
    [10000, 119, 34],
    [25000, 169, 53],
    [50000, 309, 89],
    [100000, 459, 142],
    [200000, 819, 238],
  ],
};

const slug = (model: Model) => model.toLowerCase().replace(" ", "-");

export async function getPublicPricing(): Promise<PricedModel[]> {
  let plans: Awaited<ReturnType<typeof db.getPricingPlans>> = [];
  try {
    plans = await db.getPricingPlans();
  } catch (error) {
    console.error("Pricing: could not load pricing_plans", error);
  }
  const planIds = new Map(
    plans.map((p) => [`${getChallengeRule(p.model).buyLabel}:${Number(p.size)}`, p.id])
  );

  return PUBLIC_MODELS.map((m) => ({
    ...m,
    sizes: (DISPLAY_PRICES[m.dbModel] || []).map(([size, realPrice, price]) => ({
      planId: planIds.get(`${m.dbModel}:${size}`) || `pp-${slug(m.dbModel)}-${size / 1000}k`,
      size,
      price,
      realPrice,
    })),
  })).filter((m) => m.sizes.length > 0);
}
