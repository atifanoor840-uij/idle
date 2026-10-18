import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBPricingPlan } from "@/lib/db";
import { BUY_CHALLENGE_TYPES, getChallengeRule } from "@/lib/rulebook";
import { CACHE_KEYS, cached, invalidateCache } from "@/lib/routeCache";
import { readSessionUserId } from "@/lib/session";

// The catalog changes a few times a month but is read on every Buy Challenge
// visit, so serve it from memory and bust it whenever an admin writes.
const PLANS_TTL_MS = 60_000;

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

export async function GET() {
  try {
    const plans = await cached(CACHE_KEYS.pricingPlans, PLANS_TTL_MS, async () =>
      (await db.getPricingPlans()).map((plan) => ({
        ...plan,
        model: getChallengeRule(plan.model).buyLabel,
      })),
    );
    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    console.error("GET /api/pricing-plans error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { model, size, price, status } = body;

    if (!model || !size || !price) {
      return NextResponse.json({ error: "Model, size, and price are required." }, { status: 400 });
    }

    if (!BUY_CHALLENGE_TYPES.includes(model)) {
      return NextResponse.json(
        { error: "Account type must be One Step, Two Step, or Instant." },
        { status: 400 },
      );
    }

    const sizeNum = Number(size);
    // Round-thousand sizes stay readable ("...-100k"); custom sizes that are not
    // a whole number of thousands keep their exact value so ids never collide.
    const sizeSlug =
      sizeNum % 1000 === 0 ? (sizeNum / 1000).toFixed(0) + "k" : String(sizeNum);
    const planId = "pp-" + model.replace(/\s+/g, "-").toLowerCase() + "-" + sizeSlug;
    const pricingPlan: DBPricingPlan = {
      id: planId,
      model: getChallengeRule(model).buyLabel,
      size: Number(size),
      price: Number(price),
      status: status || "active",
    };

    await db.savePricingPlan(pricingPlan);
    invalidateCache(CACHE_KEYS.pricingPlans);
    return NextResponse.json({ success: true, plan: pricingPlan });
  } catch (error: any) {
    console.error("POST /api/pricing-plans error:", error);
    if (error.code === "PGRST205" || (error.message && error.message.includes("schema cache"))) {
      return NextResponse.json(
        { error: "Pricing plans database table does not exist. Please create the pricing_plans table in your Supabase database." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Pricing plan ID is required." }, { status: 400 });
    }

    const deleted = await db.deletePricingPlan(id);
    if (!deleted) {
      return NextResponse.json({ error: "Pricing plan not found or could not be deleted." }, { status: 404 });
    }

    invalidateCache(CACHE_KEYS.pricingPlans);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/pricing-plans error:", error);
    if (error.code === "PGRST205" || (error.message && error.message.includes("schema cache"))) {
      return NextResponse.json(
        { error: "Pricing plans database table does not exist. Please create the pricing_plans table in your Supabase database." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

