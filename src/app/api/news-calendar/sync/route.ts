import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { fetchHighImpactNews } from "@/lib/newsCalendar";
import { readSessionUserId } from "@/lib/session";

/**
 * Syncs high-impact events from the Forex Factory feeds into news_events.
 *
 * Allowed callers:
 *  - an admin session (CRM "Sync now" button), or
 *  - a scheduler presenting CRON_SECRET, either as `Authorization: Bearer <secret>`
 *    (what Vercel Cron sends, via GET) or as an `x-cron-secret` header.
 */
async function authorize(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const bearer = request.headers.get("authorization");
    if (bearer === `Bearer ${secret}` || request.headers.get("x-cron-secret") === secret) {
      return { ok: true as const, by: "cron" };
    }
  }
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  const user = userId ? await db.getUserById(userId) : null;
  if (user?.role === "admin") return { ok: true as const, by: user.name || user.id };
  return { ok: false as const };
}

async function sync(request: Request) {
  const auth = await authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: "Forbidden: admin session or CRON_SECRET required." }, { status: 403 });
  }
  // An admin pressing "Sync now" bypasses the 5-minute guard; the cron does not.
  const result = await fetchHighImpactNews({ force: auth.by !== "cron" });
  return NextResponse.json({ success: result.errors.length === 0 || result.fetchedFeeds > 0, ...result });
}

export async function POST(request: Request) {
  return sync(request);
}

export async function GET(request: Request) {
  return sync(request);
}
