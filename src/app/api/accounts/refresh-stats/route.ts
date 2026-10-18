import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { refreshAccountStatisticsIfNeeded } from "@/lib/accountStatistics";
import { applyAccountRuleCompliance } from "@/lib/accountCompliance";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

// Admin-only: pull ShowMyTrades statistics for one account right now instead of
// waiting out the 30 min refresh window.
export async function POST(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const { accountId } = await request.json();
    if (!accountId) {
      return NextResponse.json({ error: "Account ID is required." }, { status: 400 });
    }

    const stored = await db.getAccountById(String(accountId));
    if (!stored) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (!stored.externalStatisticsId && !stored.statisticsApiId) {
      return NextResponse.json({ error: "This account has no Graph ID assigned." }, { status: 400 });
    }

    const refreshed = await refreshAccountStatisticsIfNeeded(stored, { force: true });
    const [account] = await applyAccountRuleCompliance([refreshed]);
    const user = await db.getUserById(account.userId);
    const lastError = account.statisticsPayload?._statsSync?.lastError;

    return NextResponse.json({
      success: !lastError,
      error: lastError ? `ShowMyTrades: ${lastError}` : undefined,
      account: {
        ...account,
        userName: user?.name || "Unknown User",
        userEmail: user?.email || "N/A",
      },
    });
  } catch (error) {
    console.error("Statistics force refresh error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
