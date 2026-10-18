import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { supabase } from "@/lib/supabaseClient";
import { buildPromotionTemplatePresets } from "@/lib/promotionTemplatePresets";
import { readSessionUserId } from "@/lib/session";

const templateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required.").max(100),
  subject: z.string().trim().min(1, "Email subject is required.").max(200),
  html: z.string().trim().min(1, "HTML template is required.").max(25000, "Keep promotion HTML under 25 KB for better deliverability."),
});

const updateTemplateSchema = templateSchema.extend({
  id: z.string().uuid("Invalid template ID."),
});

async function getAdmin() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  const user = await db.getUserById(userId);
  return user?.role === "admin" ? user : null;
}

function databaseError(error: { code?: string; message?: string } | null) {
  if (error?.code === "42P01") {
    return NextResponse.json(
      {
        error:
          "Promotion template storage is not configured. Apply promotion_email_templates_migration.sql in Supabase.",
      },
      { status: 503 },
    );
  }
  if (error?.code === "23505") {
    return NextResponse.json(
      { error: "A promotion template with this name already exists." },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { error: error?.message || "Unable to access promotion templates." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [templateResult, pricingResult, couponResult] = await Promise.all([
    supabase
      .from("promotion_email_templates")
      .select("id,name,subject,html,createdBy,createdAt,updatedAt")
      .order("updatedAt", { ascending: false }),
    supabase
      .from("pricing_plans")
      .select("model,size,price,status")
      .eq("status", "active"),
    supabase
      .from("coupons")
      .select("code,discountPercent,status,expiresAt,createdAt")
      .eq("status", "active")
      .order("createdAt", { ascending: false }),
  ]);

  const templateTableMissing =
    templateResult.error?.code === "42P01" ||
    templateResult.error?.code === "PGRST205";
  if (templateResult.error && !templateTableMissing) {
    return databaseError(templateResult.error);
  }
  if (pricingResult.error) return databaseError(pricingResult.error);

  const now = Date.now();
  const activeCoupon = (couponResult.data || []).find(
    (coupon) =>
      !coupon.expiresAt || new Date(coupon.expiresAt).getTime() > now,
  );
  const promoCode = activeCoupon?.code || "ADD-CODE";
  const discountPercent = Number(activeCoupon?.discountPercent || 60);
  const availableAccountSizes = Array.from(
    new Set((pricingResult.data || []).map((plan) => Number(plan.size)).filter(Number.isFinite)),
  ).sort((a, b) => a - b);
  const requestedSizes = new URL(request.url).searchParams
    .get("accountSizes")
    ?.split(",")
    .map(Number)
    .filter(Number.isFinite)
    .slice(0, 3) || [];
  const promotionPlans = (pricingResult.data || [])
    .filter((plan) => requestedSizes.length === 0 || requestedSizes.includes(Number(plan.size)))
    .map((plan) => ({
      model: String(plan.model),
      size: Number(plan.size),
      price: Number(plan.price),
    }));
  const presets = buildPromotionTemplatePresets(
    promotionPlans,
    promoCode,
    discountPercent,
  );

  const warnings = [
    ...(templateTableMissing
      ? [
          "Saved-template storage is not configured yet. Built-in presets are still available.",
        ]
      : []),
    ...(!activeCoupon
      ? [
          "No active coupon was found. Replace ADD-CODE and verify the discount before sending.",
        ]
      : []),
  ];

  return NextResponse.json({
    success: true,
    templates: templateResult.data || [],
    presets,
    availableAccountSizes,
    warnings,
  });
}

export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = templateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid template." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("promotion_email_templates")
    .insert({
      ...parsed.data,
      createdBy: admin.id,
      updatedAt: new Date().toISOString(),
    })
    .select("id,name,subject,html,createdBy,createdAt,updatedAt")
    .single();

  if (error) return databaseError(error);
  return NextResponse.json({ success: true, template: data }, { status: 201 });
}

export async function PUT(request: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateTemplateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid template." },
      { status: 400 },
    );
  }

  const { id, ...updates } = parsed.data;
  const { data, error } = await supabase
    .from("promotion_email_templates")
    .update({ ...updates, updatedAt: new Date().toISOString() })
    .eq("id", id)
    .select("id,name,subject,html,createdBy,createdAt,updatedAt")
    .single();

  if (error) return databaseError(error);
  return NextResponse.json({ success: true, template: data });
}

export async function DELETE(request: Request) {
  const admin = await getAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Invalid template ID." }, { status: 400 });
  }

  const { error } = await supabase
    .from("promotion_email_templates")
    .delete()
    .eq("id", parsedId.data);

  if (error) return databaseError(error);
  return NextResponse.json({ success: true });
}
