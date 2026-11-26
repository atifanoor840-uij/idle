import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailConfigured, sendDirectEmail } from "@/lib/email";
import {
  activeCoupons, buildFollowUp, computeSegments, FOLLOW_UP_TAG, isSegment, pickPlans, SEGMENTS,
} from "@/lib/followUps";
import { getAdmin, str } from "../_admin";

export const maxDuration = 300;

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

  try {
    const b = await request.json().catch(() => ({}));
    const segment = str(b.segment);
    if (!isSegment(segment)) return fail("Unknown audience segment.");
    const draft = {
      subject: str(b.subject), title: str(b.title), message: str(b.message),
      ctaLabel: str(b.ctaLabel), ctaUrl: str(b.ctaUrl), coupon: str(b.coupon).toUpperCase(),
    };
    if (!draft.subject || !draft.title || !draft.message) return fail("Subject, heading and message are required.");
    if (!emailConfigured()) return fail("Email delivery is not configured (RESEND_API_KEY is missing on the server).", 503);

    let couponPercent: number | undefined;
    if (draft.coupon) {
      const c = (await activeCoupons()).find((x) => x.code === draft.coupon);
      if (!c) return fail(`Coupon ${draft.coupon} is not active.`);
      couponPercent = c.discountPercent;
    }

    const plans = await pickPlans(b.planIds);
    if (segment === "pricing" && !plans.length) return fail("Pick at least one account for the price list.");

    const ids = new Set((Array.isArray(b.userIds) ? b.userIds : []).map((x: unknown) => str(x)));
    const recipients = (await computeSegments())[segment].filter((r) => ids.has(r.userId));
    if (!recipients.length) return fail("Select at least one recipient from this audience.");
    if (recipients.length > 200) return fail("Send at most 200 emails per batch.");

    // Two at a time keeps us under Resend's per-second rate limit.
    const failed: string[] = [];
    for (let i = 0; i < recipients.length; i += 2) {
      await Promise.all(
        recipients.slice(i, i + 2).map(async (r) => {
          const m = buildFollowUp(r, draft, { couponPercent, plans });
          const ok = await sendDirectEmail({
            toEmail: r.email,
            userId: r.userId,
            recipientName: (r.name || "").split(" ")[0] || "Trader",
            subject: m.subject,
            heading: m.heading,
            eyebrow: "Update",
            text: m.text,
            details: m.details,
            action: m.action,
            logTag: FOLLOW_UP_TAG,
          });
          if (!ok) failed.push(r.email);
        }),
      );
      if (i + 2 < recipients.length) await new Promise((res) => setTimeout(res, 600));
    }

    const sentCount = recipients.length - failed.length;
    await db
      .saveAuditLog({
        id: `audit-${crypto.randomUUID()}`,
        userId: admin.id,
        userName: admin.name,
        targetId: segment,
        targetType: "user",
        action: "follow_up_send",
        description: `${SEGMENTS[segment].label}: "${draft.subject}" → ${sentCount}/${recipients.length} sent`,
        createdAt: new Date().toISOString(),
      })
      .catch(() => {});

    return NextResponse.json({ sentCount, failedCount: failed.length, failed });
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Send failed.", 500);
  }
}
