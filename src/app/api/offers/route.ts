import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBOffer, OfferType } from "@/lib/db";
import { CACHE_KEYS, cached, invalidateCache } from "@/lib/routeCache";
import { readSessionUserId } from "@/lib/session";

// Only the trader-facing GET is cached. Every write path below, and the grant
// logic in offerGrants, still reads `db.getOffers()` straight from Supabase.
const OFFERS_TTL_MS = 30_000;

const OFFER_TYPES: OfferType[] = ["bogo", "free_retry"];

function normalizeDate(value: unknown, label: string) {
  if (!value) return undefined;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} is invalid.`);
  }
  return parsed.toISOString();
}

function toNumberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(Number).filter((item) => Number.isFinite(item) && item > 0)),
  ).sort((a, b) => a - b);
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item).trim()).filter(Boolean)),
  );
}

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

function schemaErrorResponse(error: any) {
  if (
    error?.code === "PGRST205" ||
    error?.code === "PGRST204" ||
    (error?.message && error.message.includes("schema cache"))
  ) {
    return NextResponse.json(
      {
        error:
          "Offers database table does not exist. Apply src/lib/offers_migration.sql in Supabase.",
      },
      { status: 500 },
    );
  }
  return null;
}

export async function GET() {
  try {
    const offers = await cached(CACHE_KEYS.offers, OFFERS_TTL_MS, () =>
      db.getOffers(),
    );
    return NextResponse.json({ success: true, offers });
  } catch (error: any) {
    console.error("GET /api/offers error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

/** Create a new offer, or update an existing one when `id` is supplied. */
export async function POST(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const type: OfferType = OFFER_TYPES.includes(body.type) ? body.type : "bogo";
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Offer name is required." }, { status: 400 });
    }

    const startsAt = normalizeDate(body.startsAt, "Offer start date");
    const expiresAt = normalizeDate(body.expiresAt, "Offer expiry date");
    if (startsAt && expiresAt && new Date(startsAt) >= new Date(expiresAt)) {
      return NextResponse.json(
        { error: "Offer expiry must be after the start date." },
        { status: 400 },
      );
    }

    const buyQuantity = Math.max(1, Number(body.buyQuantity) || 1);
    const freeQuantity = Math.max(0, Number(body.freeQuantity) || 0);
    const retryLimit = Math.max(0, Number(body.retryLimit) || 0);

    if (type === "bogo" && freeQuantity < 1) {
      return NextResponse.json(
        { error: "A BOGO offer must give away at least one free challenge." },
        { status: 400 },
      );
    }
    if (type === "free_retry" && retryLimit < 1) {
      return NextResponse.json(
        { error: "A free retry offer must grant at least one retry." },
        { status: 400 },
      );
    }

    const existingOffers = await db.getOffers();
    const id = String(body.id || "").trim() || `offer-${type}-${Date.now()}`;

    const previous = existingOffers.find((offer) => offer.id === id);
    const offer: DBOffer = {
      id,
      name,
      type,
      // Offers are never gated behind a code: a live offer applies to everyone in
      // its scope automatically. Codes belong to coupons, which only discount price.
      code: "",
      description: String(body.description || "").trim(),
      status: body.status === "paused" ? "paused" : "active",
      startsAt,
      expiresAt,
      accountSizes: toNumberList(body.accountSizes),
      models: toStringList(body.models),
      userIds: toStringList(body.userIds),
      accountIds: toStringList(body.accountIds),
      buyQuantity,
      freeQuantity: type === "bogo" ? freeQuantity : 0,
      retryLimit: type === "free_retry" ? retryLimit : 0,
      maxRedemptions: Math.max(0, Number(body.maxRedemptions) || 0),
      // Redemptions are owned by the checkout flow, never by the edit form.
      redeemedCount: previous?.redeemedCount ?? 0,
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.saveOffer(offer);
    invalidateCache(CACHE_KEYS.offers);
    return NextResponse.json({ success: true, offer });
  } catch (error: any) {
    console.error("POST /api/offers error:", error);
    return (
      schemaErrorResponse(error) ||
      NextResponse.json(
        { error: error.message || "Internal Server Error" },
        { status: 500 },
      )
    );
  }
}

/** Partial update — used by the ledger's pause / resume toggle. */
export async function PATCH(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Offer id is required." }, { status: 400 });
    }

    const offers = await db.getOffers();
    const existing = offers.find((offer) => offer.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    // `isExpired` / `isScheduled` are derived on read and are not columns.
    const { isExpired, isScheduled, ...stored } = existing;
    const offer: DBOffer = {
      ...stored,
      status: body.status === "paused" ? "paused" : "active",
      updatedAt: new Date().toISOString(),
    };

    await db.saveOffer(offer);
    invalidateCache(CACHE_KEYS.offers);
    return NextResponse.json({ success: true, offer });
  } catch (error: any) {
    console.error("PATCH /api/offers error:", error);
    return (
      schemaErrorResponse(error) ||
      NextResponse.json(
        { error: error.message || "Internal Server Error" },
        { status: 500 },
      )
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await requireAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Offer id is required." }, { status: 400 });
    }

    const deleted = await db.deleteOffer(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Offer not found or could not be deleted." },
        { status: 404 },
      );
    }

    invalidateCache(CACHE_KEYS.offers);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/offers error:", error);
    return (
      schemaErrorResponse(error) ||
      NextResponse.json(
        { error: error.message || "Internal Server Error" },
        { status: 500 },
      )
    );
  }
}
