import { NextResponse } from "next/server";
import { emailConfigured, emailProvider } from "@/lib/email";
import { activeCoupons, activePlans, computeSegments, PRESETS, SEGMENTS, type SegmentId } from "@/lib/followUps";
import { getAdmin } from "./_admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const [segments, coupons, plans] = await Promise.all([computeSegments(), activeCoupons(), activePlans()]);
    return NextResponse.json({
      segments: (Object.keys(SEGMENTS) as SegmentId[]).map((id) => ({ id, ...SEGMENTS[id], recipients: segments[id] })),
      presets: PRESETS,
      coupons,
      plans,
      emailConfigured: emailConfigured(),
      provider: emailProvider(),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load follow-ups." }, { status: 500 });
  }
}
