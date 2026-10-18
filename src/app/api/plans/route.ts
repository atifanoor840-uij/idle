import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBChallengePlan } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

export async function GET() {
  try {
    const plans = await db.getPlans();
    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, size, price, profitTargetP1, profitTargetP2, maxDailyLoss, maxTotalLoss, profitSplit, platform, login, password, server } = body;

    if (!name || !size || !price) {
      return NextResponse.json({ error: "Name, size, and price are required." }, { status: 400 });
    }

    const planId = "plan-" + name.replace(/\s+/g, "-").toLowerCase() + "-" + (size / 1000).toFixed(0) + "k";
    const newPlan: DBChallengePlan = {
      id: planId,
      name,
      size: Number(size),
      price: Number(price),
      profitTargetP1: Number(profitTargetP1 || 0),
      profitTargetP2: Number(profitTargetP2 || 0),
      maxDailyLoss: Number(maxDailyLoss || 5),
      maxTotalLoss: Number(maxTotalLoss || 10),
      profitSplit: Number(profitSplit || 80),
      platform: platform || "",
      login: login || "",
      password: password || "",
      server: server || "",
    };

    await db.savePlan(newPlan);
    return NextResponse.json({ success: true, plan: newPlan });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, size, price, profitTargetP1, profitTargetP2, maxDailyLoss, maxTotalLoss, profitSplit, platform, login, password, server } = body;

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }

    const plan = await db.getPlanById(id);
    if (!plan) {
      return NextResponse.json({ error: "Challenge plan not found." }, { status: 404 });
    }

    if (name) plan.name = name;
    if (size) plan.size = Number(size);
    if (price) plan.price = Number(price);
    if (profitTargetP1 !== undefined) plan.profitTargetP1 = Number(profitTargetP1);
    if (profitTargetP2 !== undefined) plan.profitTargetP2 = Number(profitTargetP2);
    if (maxDailyLoss !== undefined) plan.maxDailyLoss = Number(maxDailyLoss);
    if (maxTotalLoss !== undefined) plan.maxTotalLoss = Number(maxTotalLoss);
    if (profitSplit !== undefined) plan.profitSplit = Number(profitSplit);
    if (platform !== undefined) plan.platform = platform;
    if (login !== undefined) plan.login = login;
    if (password !== undefined) plan.password = password;
    if (server !== undefined) plan.server = server;

    await db.savePlan(plan);
    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }

    const deleted = await db.deletePlan(id);
    if (!deleted) {
      return NextResponse.json({ error: "Plan not found or could not be deleted." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
