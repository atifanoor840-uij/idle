import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBCoupon } from "@/lib/db";
import { CACHE_KEYS, cached, invalidateCache } from "@/lib/routeCache";
import { readSessionUserId } from "@/lib/session";

// Read on every Buy Challenge visit, written only by an admin. The client
// re-derives expiry from `expiresAt`, so a short window of staleness here
// cannot show an expired coupon as usable.
const COUPONS_TTL_MS = 30_000;

function normalizeCouponExpiry(expiresAt?: string) {
  if (!expiresAt) return undefined;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Coupon expiry date is invalid.");
  }
  return parsed.toISOString();
}

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

function isCouponUsable(coupon: DBCoupon) {
  const expired = Boolean(coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now());
  return coupon.status === "active" && !expired;
}

// Admins get the full list. Everyone else can only check one code they already
// know (?code=XYZ), so active codes cannot be harvested from this endpoint.
export async function GET(request: Request) {
  try {
    const coupons = await cached(CACHE_KEYS.coupons, COUPONS_TTL_MS, () =>
      db.getCoupons(),
    );
    const user = await getSessionUser();
    if (user?.role === "admin") {
      return NextResponse.json({ success: true, coupons });
    }

    const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ success: true, coupons: [] });
    }
    const coupon = coupons.find((item) => item.code === code);
    if (!coupon || !isCouponUsable(coupon)) {
      return NextResponse.json({ error: "Invalid or expired coupon code." }, { status: 404 });
    }
    const { code: matched, discountPercent, expiresAt } = coupon;
    return NextResponse.json({ success: true, coupon: { code: matched, discountPercent, expiresAt }, coupons: [{ code: matched, discountPercent, expiresAt, status: "active" }] });
  } catch (error: any) {
    console.error("GET /api/coupons error:", error);
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
    const { code, discountPercent, status, expiresAt } = body;

    if (!code || !discountPercent) {
      return NextResponse.json({ error: "Code and discount percentage are required." }, { status: 400 });
    }

    const normalizedExpiry = normalizeCouponExpiry(expiresAt);
    const coupon: DBCoupon = {
      code: code.trim().toUpperCase(),
      discountPercent: Number(discountPercent),
      status: status || "active",
      expiresAt: normalizedExpiry,
    };

    await db.saveCoupon(coupon);
    invalidateCache(CACHE_KEYS.coupons);
    return NextResponse.json({ success: true, coupon });
  } catch (error: any) {
    console.error("POST /api/coupons error:", error);
    if (error.code === "PGRST205" || error.code === "PGRST204" || (error.message && error.message.includes("schema cache"))) {
      if (error.code === "PGRST204" || error.message?.includes("expiresAt")) {
        return NextResponse.json(
          { error: "Coupons table is missing the expiresAt column. Apply src/lib/coupons_migration.sql in Supabase." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Coupons database table does not exist. Please create the coupons table in your Supabase database." },
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
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json({ error: "Coupon code is required." }, { status: 400 });
    }

    const deleted = await db.deleteCoupon(code);
    if (!deleted) {
      return NextResponse.json({ error: "Coupon not found or could not be deleted." }, { status: 404 });
    }

    invalidateCache(CACHE_KEYS.coupons);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/coupons error:", error);
    if (error.code === "PGRST205" || (error.message && error.message.includes("schema cache"))) {
      return NextResponse.json(
        { error: "Coupons database table does not exist. Please create the coupons table in your Supabase database." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
