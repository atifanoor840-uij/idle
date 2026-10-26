import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBPayout, DBTradingAccount } from "@/lib/db";
import { refreshAccountStatisticsIfNeeded } from "@/lib/accountStatistics";
import { applyAccountRuleCompliance } from "@/lib/accountCompliance";
import { formatNewsViolation } from "@/lib/newsRule";
import {
  calculateMinimumWithdrawal,
  calculatePayoutEligibility,
  getFirstPayoutEligibleAt,
  getPayoutPeriodStart,
  MIN_DAYS_BEFORE_FIRST_PAYOUT,
  WITHDRAWAL_CAP_PERCENT,
} from "@/lib/payoutRules";
import {
  getAllMinimumHoldingViolationIds,
  getOpenStatisticsTrades,
  getOvernightHoldingViolations,
  getProfitConsistency,
  getWeekendHoldingViolations,
} from "@/lib/accountTradingRules";
import {
  getChallengeRule,
  getProfitSplitPercent,
  resolveRuleVersion,
  FLEX_CONSISTENCY_PERCENT,
  FLEX_PROFIT_SPLIT_PERCENT,
  FLEX_REDUCED_PROFIT_SPLIT_PERCENT,
  LEGACY_PROFIT_CONSISTENCY_PERCENT,
} from "@/lib/rulebook";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

async function resolveAccountPlan(account: DBTradingAccount) {
  const order = account.orderId ? await db.getOrderById(account.orderId) : undefined;
  const plan = order?.planId ? await db.getPlanById(order.planId) : undefined;
  const ruleVersion = resolveRuleVersion(order);
  return {
    ruleVersion,
    order,
    rule: getChallengeRule(plan?.name || order?.planId || account.phase, ruleVersion),
  };
}

function money(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const reject = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.role === "admin") {
      const [allPayouts, allUsers] = await Promise.all([db.getPayouts(), db.getUsers()]);
      const usersById = new Map(allUsers.map((item) => [item.id, item]));
      const enrichedPayouts = allPayouts.map((payout) => {
        const payoutUser = usersById.get(payout.userId);
        return {
          ...payout,
          userName: payoutUser?.name || "Unknown User",
          userEmail: payoutUser?.email || "N/A",
        };
      });
      return NextResponse.json({ success: true, payouts: enrichedPayouts });
    }

    return NextResponse.json({ success: true, payouts: await db.getPayoutsByUserId(user.id) });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Withdrawal eligibility (Help Center: When am I eligible to request a withdrawal?):
// 14 days since the funded account was received, the cycle's Winning Days, realized
// profit of at least 1% of the initial balance (Flex: $100), KYC approved and zero
// rule violations. Flex adds: every trade closed, balance above the start, and the
// 20% consistency rule. Every rule decision comes from the shared engine.
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const kyc = await db.getKycByUserId(user.id);
    if (!kyc || kyc.status !== "approved") {
      return reject(
        "Access Denied: your identity verification (KYC) must be approved and the Trader Agreement signed before requesting a payout.",
        403,
      );
    }

    const body = await request.json();
    const { accountId, paymentMethod, paymentDetails } = body;
    const requestedAmount = Number(body.amount);
    if (!accountId || !Number.isFinite(requestedAmount) || requestedAmount <= 0 || !paymentMethod || !paymentDetails) {
      return reject("Required fields: accountId, a positive amount, paymentMethod, and paymentDetails.");
    }

    const storedAccount = await db.getAccountById(accountId);
    if (!storedAccount || storedAccount.userId !== user.id) {
      return reject("Trading account not found or access denied.", 404);
    }

    const refreshed = await refreshAccountStatisticsIfNeeded(storedAccount);
    const { rule, ruleVersion } = await resolveAccountPlan(refreshed);
    // One compliance pass: persists breaches, news violations and notifications
    // exactly as the dashboard does, so the payout decision can never disagree with it.
    const [account] = await applyAccountRuleCompliance([refreshed]);
    const newRulesEnforced = ruleVersion === "current";
    const isFlex = rule.key === "flex";

    if (!account.fundedAccount || account.status === "Failed") {
      const reason = account.ruleAlerts.find((alert) => alert.type === "error");
      return reject(
        account.status === "Failed"
          ? `Account breached${reason ? `: ${reason.title}` : ""}. Payouts are not available on a closed account.`
          : "Payouts are only available on active Instant or Funded accounts.",
        account.status === "Failed" ? 409 : 400,
      );
    }

    const initialBalance = account.size;
    const userPayouts = await db.getPayoutsByUserId(user.id);
    const accountPayouts = userPayouts.filter((payout) => payout.accountId === account.id);
    if (accountPayouts.some((payout) => payout.status === "pending" || payout.status === "approved" || payout.status === "processing")) {
      return reject("A withdrawal request for this account is already being processed.");
    }

    // 14 days must pass after the funded account is received.
    const fundedAt = account.deliveredAt || account.createdAt;
    const eligibleAt = getFirstPayoutEligibleAt(fundedAt);
    if (newRulesEnforced && eligibleAt && eligibleAt.getTime() > Date.now()) {
      return reject(
        `Withdrawals open ${MIN_DAYS_BEFORE_FIRST_PAYOUT} days after the funded account is received. This account is eligible from ${eligibleAt.toISOString().slice(0, 10)}.`,
      );
    }

    // Winning Days in the current trading cycle (5 on Funded / Instant / Flex funded).
    if (account.currentTradingDays < account.minTradingDays) {
      return reject(
        `Payout requires ${account.minTradingDays} ${isFlex ? "profitable" : "Winning"} Days this cycle, each with at least ${money(account.winningDayThreshold)} (0.5% of the initial balance). Current progress: ${account.currentTradingDays}/${account.minTradingDays}.`,
      );
    }

    // Overnight holding is a soft breach that leads to withdrawal rejection.
    const overnightViolations = newRulesEnforced && !rule.overnightHolding && !account.overnightHoldingAddon
      ? getOvernightHoldingViolations(account.statisticsPayload, { weekendHoldingAddon: Boolean(account.weekendHoldingAddon) })
      : [];
    if (overnightViolations.length > 0) {
      return reject(
        `Withdrawal rejected: ${overnightViolations.length} position${overnightViolations.length === 1 ? "" : "s"} stayed open through the 00:00 UTC reset (overnight holding). Contact support if you believe this is wrong.`,
        409,
      );
    }

    const openTrades = getOpenStatisticsTrades(account.statisticsPayload);
    if (isFlex) {
      if (openTrades.length > 0) {
        return reject("Close every open trade before requesting a Flex payout.");
      }
      const consistency = getProfitConsistency(account.statisticsPayload, account.cycleStart);
      if (consistency.bestDay && consistency.ratioPercent > FLEX_CONSISTENCY_PERCENT) {
        return reject(
          `Payout delayed by the ${FLEX_CONSISTENCY_PERCENT}% consistency rule: your best day (${money(consistency.bestDay.profit)} on ${consistency.bestDay.date}) is ${consistency.ratioPercent}% of your ${money(consistency.totalProfit)} total profit. This is not a breach — request again once no single day is above ${FLEX_CONSISTENCY_PERCENT}%.`,
        );
      }
    }

    // Legacy rulebook: breaking the 30% profit consistency rule fails the account
    // (the compliance pass above already marks it Failed); this stops the payout.
    if (!newRulesEnforced) {
      const consistency = getProfitConsistency(account.statisticsPayload);
      if (consistency.bestDay && consistency.ratioPercent > LEGACY_PROFIT_CONSISTENCY_PERCENT) {
        return reject(
          `Payout not eligible: your best day is ${consistency.ratioPercent}% of total profit, above the ${LEGACY_PROFIT_CONSISTENCY_PERCENT}% consistency rule.`,
        );
      }
    }

    const periodStart = getPayoutPeriodStart(account.createdAt);
    const alreadyRequestedInPeriod = accountPayouts
      .filter((payout) => payout.status !== "rejected" && new Date(payout.createdAt).getTime() >= periodStart.getTime())
      .reduce((sum, payout) => sum + Number(payout.amount || 0), 0);

    // Profit split: 70% → 80% → 90% → 100%, stepping up only while every earlier
    // withdrawal was clean (a rejected withdrawal restarts the progression). Flex is
    // a flat 85%, cut to 50% after the first floating loss cap hit. Legacy-pinned
    // accounts keep the flat split from their rule set.
    const sorted = [...accountPayouts].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const lastRejectedIndex = sorted.map((payout) => payout.status).lastIndexOf("rejected");
    const cleanPaidPayouts = sorted.slice(lastRejectedIndex + 1).filter((payout) => payout.status === "paid").length;
    const profitSplitPercent = !newRulesEnforced
      ? rule.profitSplitPercent
      : isFlex
        ? account.flexReducedSplit
          ? FLEX_REDUCED_PROFIT_SPLIT_PERCENT
          : FLEX_PROFIT_SPLIT_PERCENT
        : getProfitSplitPercent(cleanPaidPayouts);

    const eligibility = calculatePayoutEligibility({
      initialBalance,
      currentBalance: account.balance,
      requestedAmount,
      alreadyRequestedInPeriod,
      profitSplitPercent,
      nonWithdrawableProfit: account.newsProfitToDeduct,
      uncapped: isFlex,
    });

    if (eligibility.availableProfit <= 0) {
      return reject(
        account.newsProfitToDeduct > 0 && eligibility.grossProfit > 0
          ? `No withdrawable profit is available: ${money(account.newsProfitToDeduct)} of profit came from trades opened or closed inside high-impact news windows and is not withdrawable.`
          : "No withdrawable profit is available. Only realized profit above the initial balance can be withdrawn.",
        400,
        { newsViolations: account.newsViolations, newsProfitToDeduct: account.newsProfitToDeduct },
      );
    }

    // Minimum realized profit: 1% of the initial balance (Flex: $100). Below it the
    // profit stays on the account and counts toward the next payout period.
    const minimumWithdrawal = newRulesEnforced ? calculateMinimumWithdrawal(initialBalance, isFlex) : 100;
    if (eligibility.availableProfit < minimumWithdrawal) {
      return reject(
        `Your realized profit (${money(eligibility.availableProfit)}) is below the ${money(minimumWithdrawal)} minimum${isFlex ? "" : " (1% of the initial balance)"}. It stays on the account and counts toward your next payout period.`,
      );
    }
    if (eligibility.maximumWithdrawal <= 0) {
      return reject(`The ${WITHDRAWAL_CAP_PERCENT}% withdrawal cap for this payout period has already been reached (${money(eligibility.withdrawalCap)}).`);
    }
    if (eligibility.adjustedAmount < minimumWithdrawal) {
      return reject(`The minimum withdrawal request is ${money(minimumWithdrawal)}.`);
    }

    // Flex: once the trailing floor has locked at the starting balance, a withdrawal
    // that takes the balance down to the floor leaves no room and closes the account.
    if (isFlex && account.lossFloor >= initialBalance && account.balance - eligibility.adjustedAmount <= account.lossFloor) {
      return reject(
        `This withdrawal would take the balance down to your ${money(account.lossFloor)} drawdown floor, which closes the account. Request less than ${money(Math.max(0, account.balance - account.lossFloor))}.`,
      );
    }

    const complianceFlags: string[] = [];
    const weekendViolations =
      !newRulesEnforced || rule.fundedWeekendHolding || account.weekendHoldingAddon
        ? []
        : getWeekendHoldingViolations(account.statisticsPayload);
    if (weekendViolations.length > 0) {
      complianceFlags.push(
        `Weekend holding without the add-on: ${weekendViolations.length} position${weekendViolations.length === 1 ? "" : "s"} (trade removal or profit adjustment).`,
      );
    }
    if (account.newsViolations.length > 0) {
      const tickets = new Set(account.newsViolations.map((violation) => violation.ticket)).size;
      complianceFlags.push(
        `News Trading Rule: ${tickets} trade${tickets === 1 ? "" : "s"} opened/closed within a high-impact news window; ${money(account.newsProfitToDeduct)} profit deducted from withdrawable profit. ${account.newsViolations.map(formatNewsViolation).join("; ")}`,
      );
    }
    if (isFlex) {
      const shortHolds = getAllMinimumHoldingViolationIds(account.statisticsPayload);
      if (shortHolds.length > 0) {
        complianceFlags.push(`Flex minimum holding review: ${shortHolds.length} trade${shortHolds.length === 1 ? "" : "s"} closed in under 3 minutes.`);
      }
    }
    // 1-Step / 2-Step: the account fee is returned with the first clean withdrawal.
    const firstPayout = !accountPayouts.some((payout) => payout.status === "paid");
    const feeReturnDue = newRulesEnforced && firstPayout && (rule.key === "one_step_pro" || rule.key === "two_step_standard");
    const adminNotes = [
      complianceFlags.length > 0 ? `Automated compliance flag: ${complianceFlags.join(" ")}` : "",
      feeReturnDue ? "First withdrawal: return the account fee with this payout if there are no rule violations." : "",
    ].filter(Boolean);

    const payoutId = "pay-" + Math.floor(1000 + Math.random() * 9000);
    const newPayout: DBPayout = {
      id: payoutId,
      accountId,
      userId: user.id,
      amount: eligibility.adjustedAmount,
      profitSplitAmount: eligibility.traderShare,
      firmShareAmount: eligibility.firmShare,
      paymentMethod,
      paymentDetails: typeof paymentDetails === "string" ? paymentDetails : JSON.stringify(paymentDetails),
      status: "pending",
      notes: adminNotes.length ? adminNotes.join(" ") : undefined,
      createdAt: new Date().toISOString(),
    };

    await db.savePayout(newPayout);

    const adjustmentText = eligibility.wasAdjusted
      ? ` Your requested amount was automatically adjusted to ${money(eligibility.adjustedAmount)} under the ${WITHDRAWAL_CAP_PERCENT}% per-period withdrawal cap.`
      : "";
    const complianceText = complianceFlags.length > 0 ? " The request includes a trading-rule compliance flag for review." : "";
    const tradingText = openTrades.length > 0
      ? " Close all open trades now and do not open new ones until the withdrawal is processed."
      : " Do not open new trades until the withdrawal is processed.";
    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "Payout Requested",
      message: `Your gross payout request of ${money(eligibility.adjustedAmount)} (${profitSplitPercent}% split: ${money(eligibility.traderShare)}) has been submitted.${adjustmentText}${complianceText}${tradingText}${feeReturnDue ? " Your account fee is returned with this first withdrawal if no rule was violated." : ""}`,
      type: complianceFlags.length > 0 ? "warning" : "info",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      payout: newPayout,
      withdrawal: {
        requestedAmount,
        adjustedAmount: eligibility.adjustedAmount,
        withdrawalCap: eligibility.withdrawalCap,
        remainingProfit: eligibility.excessProfitRemaining,
        wasAdjusted: eligibility.wasAdjusted,
        grossProfit: eligibility.grossProfit,
        nonWithdrawableProfit: eligibility.nonWithdrawableProfit,
        profitSplitPercent,
        feeReturnDue,
      },
      newsViolations: account.newsViolations,
      newsProfitToDeduct: account.newsProfitToDeduct,
      complianceReview: complianceFlags.length > 0,
    });
  } catch (error) {
    console.error("Payout POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const body = await request.json();
    const { payoutId, status, notes } = body;
    if (!payoutId || !status) {
      return NextResponse.json({ error: "Payout ID and status are required." }, { status: 400 });
    }

    const payout = await db.getPayoutById(payoutId);
    if (!payout) return NextResponse.json({ error: "Payout request not found." }, { status: 404 });

    const previousStatus = payout.status;
    payout.status = status;
    payout.notes = notes || payout.notes || "";
    payout.approvedBy = admin.id;
    payout.approvedAt = new Date().toISOString();
    await db.savePayout(payout);

    if (status === "paid" && previousStatus !== "paid") {
      const account = await db.getAccountById(payout.accountId);
      if (account) {
        account.balance = Number((account.balance - payout.amount).toFixed(2));
        account.equity = Number((account.equity - payout.amount).toFixed(2));
        await db.saveAccount(account);
      }

      const userObj = await db.getUserById(payout.userId);
      await db.saveCertificate({
        id: "cert-pay-" + Math.random().toString(36).substring(2, 7),
        userId: payout.userId,
        accountId: payout.accountId,
        traderName: userObj ? userObj.name : "Alex Mercer",
        accountSize: payout.amount,
        planName: "Profit Split Payout Completed",
        datePassed: new Date().toISOString(),
      });

      await db.saveNotification({
        id: "notif-" + Math.random().toString(36).substring(2, 11),
        userId: payout.userId,
        title: "Payout Dispatched",
        message: `Your gross payout of $${payout.amount} has been processed. Your trader share is $${payout.profitSplitAmount}.`,
        type: "success",
        channel: "in_app",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      });
    } else if (status === "rejected" && previousStatus !== "rejected") {
      await db.saveNotification({
        id: "notif-" + Math.random().toString(36).substring(2, 11),
        userId: payout.userId,
        title: "Payout Request Rejected",
        message: `Your payout request has been declined. Audit comments: ${notes || "No reason provided."}.`,
        type: "error",
        channel: "in_app",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, payout });
  } catch (error) {
    console.error("Payout PUT error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
