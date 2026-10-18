import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { getRestrictedEvents, listNewsEvents, setNewsEventRestricted } from "@/lib/newsCalendar";
import { NEWS_RESTRICTED_MINUTES_EACH_SIDE } from "@/lib/rulebook";
import { readSessionUserId } from "@/lib/session";

const DAY_MS = 24 * 60 * 60 * 1000;

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/**
 * GET /api/news-calendar?from=&to=
 * Public: restricted high-impact events (default: now-1d … now+7d) for the
 * dashboard widget. Admins may pass `all=1` to include excluded events.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const now = Date.now();
  const from = parseDateParam(url.searchParams.get("from"), new Date(now - DAY_MS));
  const to = parseDateParam(url.searchParams.get("to"), new Date(now + 7 * DAY_MS));
  if (to.getTime() - from.getTime() > 400 * DAY_MS) {
    return NextResponse.json({ error: "Range too large (max 400 days)." }, { status: 400 });
  }

  let includeExcluded = false;
  if (url.searchParams.get("all") === "1") {
    const user = await getSessionUser();
    includeExcluded = user?.role === "admin";
  }

  const events = includeExcluded ? await listNewsEvents(from, to) : await getRestrictedEvents(from, to);
  if (events === null) {
    return NextResponse.json({ error: "News calendar is unavailable." }, { status: 503 });
  }
  return NextResponse.json(
    { success: true, windowMinutes: NEWS_RESTRICTED_MINUTES_EACH_SIDE, events },
    { headers: includeExcluded ? {} : { "Cache-Control": "public, max-age=60" } },
  );
}

/** PATCH /api/news-calendar — admin: { id, isRestricted } includes/excludes one event. */
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  if (!body?.id || typeof body.isRestricted !== "boolean") {
    return NextResponse.json({ error: "Required fields: id and isRestricted (boolean)." }, { status: 400 });
  }
  try {
    const event = await setNewsEventRestricted(String(body.id), body.isRestricted);
    if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
    await db.saveAuditLog({
      id: `log-${Math.random().toString(36).substring(2, 11)}`,
      userId: user.id,
      userName: user.name,
      targetId: event.id,
      targetType: "news_event",
      action: body.isRestricted ? "news_event_included" : "news_event_excluded",
      description: `${body.isRestricted ? "Included" : "Excluded"} ${event.currency} "${event.title}" (${event.eventTime}) ${body.isRestricted ? "in" : "from"} the News Trading Rule.`,
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, event });
  } catch (error: any) {
    console.error("News calendar PATCH error:", error);
    return NextResponse.json({ error: error?.message || "Could not update the event." }, { status: 500 });
  }
}
