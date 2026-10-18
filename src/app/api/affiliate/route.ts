import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBChallengePlan, DBOrder, DBReferral, DBUser } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Admin can view all affiliates and referrals
    if (user.role === "admin") {
      const [affiliates, referrals, users, orders] = await Promise.all([
        db.getAffiliates(),
        db.getReferrals(),
        db.getUsers(),
        db.getOrders(),
      ]);
      const usersById = new Map(users.map((u) => [u.id, u]));
      const ordersById = new Map(orders.map((o) => [o.id, o]));
      const affiliatesByUserId = new Map(affiliates.map((a) => [a.userId, a]));

      const enrichedReferrals = referrals.map((r) => {
        const referredUsr = usersById.get(r.referredUserId);
        const affiliateUsr = usersById.get(r.affiliateId);
        const orderObj = ordersById.get(r.orderId);
        const affiliateObj = affiliatesByUserId.get(r.affiliateId);
        return {
          ...r,
          referredName: referredUsr?.name || "Unknown User",
          referredEmail: referredUsr?.email || "N/A",
          affiliateName: affiliateUsr?.name || "Unknown Affiliate",
          referralCode: affiliateObj?.referralCode || "N/A",
          amountPaid: orderObj ? orderObj.amountPaid : 0,
        };
      });

      return NextResponse.json({
        success: true,
        affiliates: affiliates.map((a) => {
          const u = usersById.get(a.userId);
          return {
            ...a,
            name: u?.name || "Unknown User",
            email: u?.email || "N/A",
          };
        }),
        referrals: enrichedReferrals,
      });
    }

    // Normal user or affiliate gets their own dashboard.
    // The affiliate row and the referral list are both keyed off the session
    // user, so neither waits on the other. This read sits on the dashboard's
    // first paint and on the Buy Challenge tab, so every avoidable round trip
    // here is felt twice.
    const [existingAffiliate, referrals] = await Promise.all([
      db.getAffiliateByUserId(user.id),
      db.getReferralsByAffiliateId(user.id),
    ]);

    let affiliate = existingAffiliate;
    if (!affiliate) {
      // Auto-generate affiliate details for the user
      const generatedCode = user.name.replace(/\s+/g, "").toUpperCase().substring(0, 7) + Math.floor(100 + Math.random() * 900);
      affiliate = await db.saveAffiliate({
        userId: user.id,
        referralCode: generatedCode,
        commissionRate: 5, // Default 5%
      });
    }

    // A trader with no referrals - every freshly signed up account - needs
    // none of the joins below. Fetching them used to mean scanning the whole
    // `users` and `orders` tables to enrich an empty list.
    const [users, orders, plans]: [DBUser[], DBOrder[], DBChallengePlan[]] = referrals.length
      ? await Promise.all([
          db.getUsersByIds(referrals.map((r) => r.referredUserId)),
          db.getOrdersByIds(referrals.map((r) => r.orderId)),
          db.getPlans(),
        ])
      : [[], [], []];

    // Enrich referred user details and order details
    const enrichedReferrals = referrals.map((r) => {
      const refUser = users.find((u) => u.id === r.referredUserId);
      const orderObj = orders.find((o) => o.id === r.orderId);
      const planObj = orderObj ? plans.find((p) => p.id === orderObj.planId) : null;
      return {
        ...r,
        referredName: refUser?.name || "Ref User",
        referredEmail: refUser?.email || "N/A",
        amountPaid: orderObj ? orderObj.amountPaid : 0,
        planName: planObj ? `${planObj.name} $${(planObj.size / 1000).toFixed(0)}K` : "Challenge Account",
      };
    });

    // Calculate metrics
    const totalReferrals = enrichedReferrals.length;
    const totalEarned = enrichedReferrals
      .filter((r) => r.status === "approved" || r.status === "paid")
      .reduce((acc, curr) => acc + curr.commissionAmount, 0);
    const pendingEarned = enrichedReferrals
      .filter((r) => r.status === "pending")
      .reduce((acc, curr) => acc + curr.commissionAmount, 0);
    const paidEarned = enrichedReferrals
      .filter((r) => r.status === "paid")
      .reduce((acc, curr) => acc + curr.commissionAmount, 0);

    return NextResponse.json({
      success: true,
      affiliate,
      metrics: {
        totalReferrals,
        totalEarned,
        pendingEarned,
        paidEarned,
      },
      referrals: enrichedReferrals,
    });
  } catch (error: any) {
    console.error("Affiliate GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action, affiliateUserId, commissionRate, referredUserId, orderId, status } = body;

    // Action 1: Adjust commission rate per affiliate
    if (action === "update_rate") {
      if (!affiliateUserId || commissionRate === undefined) {
        return NextResponse.json({ error: "Required fields: affiliateUserId, commissionRate." }, { status: 400 });
      }
      const affiliate = await db.getAffiliateByUserId(affiliateUserId);
      if (!affiliate) {
        return NextResponse.json({ error: "Affiliate not found." }, { status: 404 });
      }
      affiliate.commissionRate = Number(commissionRate);
      await db.saveAffiliate(affiliate);
      return NextResponse.json({ success: true, affiliate });
    }

    // Action 2: Manually approve/pay a referral commission
    if (action === "update_referral") {
      if (!referredUserId || !orderId || !status) {
        return NextResponse.json({ error: "Required fields: referredUserId, orderId, status." }, { status: 400 });
      }
      const success = await db.updateReferralStatus(referredUserId, orderId, status);
      if (!success) {
        return NextResponse.json({ error: "Referral record not found." }, { status: 404 });
      }

      // If marked paid, trigger notification to affiliate
      if (status === "paid") {
        const referrals = await db.getReferrals();
        const ref = referrals.find((r) => r.referredUserId === referredUserId && r.orderId === orderId);
        if (ref) {
          await db.saveNotification({
            id: "notif-" + Math.random().toString(36).substring(2, 11),
            userId: ref.affiliateId,
            title: "Affiliate Commission Paid",
            message: `Great news! Your commission of $${ref.commissionAmount} has been processed and paid out to your withdrawal destination.`,
            type: "success",
            channel: "in_app",
            status: "sent",
            read: false,
            sentAt: new Date().toISOString(),
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("Affiliate PUT error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
