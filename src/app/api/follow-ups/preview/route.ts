import { NextResponse } from "next/server";
import { pickPlans, renderFollowUpPreview, type Recipient } from "@/lib/followUps";
import { getAdmin, str } from "../_admin";

/** Server-rendered preview so the admin sees the exact branded email. */
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const b = await request.json().catch(() => ({}));
    const sample: Recipient = {
      userId: "preview",
      name: "Ali Khan",
      email: "trader@example.com",
      createdAt: new Date().toISOString(),
      ...(b.withOrder ? { orderId: "o-10234", plan: "Two Step $10K", amount: 89 } : {}),
    };
    const preview = renderFollowUpPreview(
      sample,
      {
        subject: str(b.subject), title: str(b.title), message: str(b.message),
        ctaLabel: str(b.ctaLabel), ctaUrl: str(b.ctaUrl), coupon: str(b.coupon).toUpperCase(),
      },
      { couponPercent: Number(b.couponPercent) || undefined, plans: await pickPlans(b.planIds) },
    );
    return NextResponse.json(preview);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Preview failed." }, { status: 400 });
  }
}
