import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, type DBPixelEvent } from "@/lib/db";
import { META_PIXEL_ID } from "@/lib/metaConversionsApi";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

// Browser-fired Pixel events we accept from the public POST endpoint.
const ALLOWED_CLIENT_EVENTS = new Set([
  "Purchase",
  "InitiateCheckout",
  "AddToCart",
  "AddPaymentInfo",
  "CompleteRegistration",
  "Lead",
  "Subscribe",
  "StartTrial",
]);

const str = (value: unknown, max = 300): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
};

export async function GET() {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required." },
        { status: 403 },
      );
    }

    const events = await db.getPixelEvents();
    const sorted = [...events].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const summary = {
      total: sorted.length,
      sent: sorted.filter((e) => e.status === "sent").length,
      failed: sorted.filter((e) => e.status === "failed").length,
      purchases: sorted.filter((e) => e.eventName === "Purchase").length,
      purchaseValue: sorted
        .filter((e) => e.eventName === "Purchase" && e.status === "sent")
        .reduce((sum, e) => sum + Number(e.value || 0), 0),
    };

    return NextResponse.json({ success: true, events: sorted, summary });
  } catch (error: any) {
    console.error("Pixel events GET error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

// Beacon from the browser Pixel (src/lib/metaPixel.ts) so client-fired
// conversion events are visible alongside the server-side CAPI events.
// Best-effort: always answers { success: true } so tracking never sees an error.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const eventName = str(body?.eventName, 60);
    if (!eventName || !ALLOWED_CLIENT_EVENTS.has(eventName)) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const sessionUser = await getSessionUser().catch(() => null);
    const rawValue = Number(body?.value);

    const row: DBPixelEvent = {
      id: `px-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventName,
      eventId: str(body?.eventId, 120),
      source: "pixel",
      status: "sent",
      pixelId: META_PIXEL_ID,
      userId: sessionUser?.id,
      userEmail: sessionUser?.email,
      value: Number.isFinite(rawValue) && rawValue > 0 ? rawValue : undefined,
      currency: str(body?.currency, 10),
      contentName: str(body?.contentName),
      contentIds: str(body?.contentIds, 300),
      eventSourceUrl: str(body?.eventSourceUrl, 500),
      createdAt: new Date().toISOString(),
    };

    await db.savePixelEvent(row);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Pixel events POST error:", error);
    // Never surface an error to the tracking beacon.
    return NextResponse.json({ success: true });
  }
}
