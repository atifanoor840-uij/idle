import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBPayout, DBTradingAccount } from "@/lib/db";
import { refreshAccountStatisticsIfNeeded } from "@/lib/accountStatistics";
import { evaluateAccountRules, loadNewsEventsForAccounts } from "@/lib/accountCompliance";
import { formatNewsViolation, storedNewsViolationsChanged, withStoredNewsViolations } from "@/lib/newsRule";
import { calculatePayoutEligibility, getPayoutPeriodStart } from "@/lib/payoutRules";
import {
  detectStatisticsTradeLayering,
  formatConcurrentLayeringTrades,
  formatTradeLayeringViolations,
  getMaxConcurrentLayers,
  getStatisticsTrades,
} from "@/lib/tradeLayering";
import {
  calculateProfitableTradingDays,
  calculateTradingDays,
  getAllMinimumHoldingViolationIds,
  getOpenStatisticsTrades,
  storedMinimumHoldingViolationsChanged,
  withStoredBreachReason,
  getWeekendHoldingViolations,
  getTickScalpingViolations,
  getInactivityBreach,
  getProfitConsistency,
  MINIMUM_HOLDING_RELAXATIONS,
  withStoredMinimumHoldingViolations,
} from "@/lib/accountTradingRules";
import {
  getChallengeRule,
  getProfitSplitPercent,
  requiresQualifyingTradingDays,
  resolveRuleVersion,
  FUNDED_MIN_QUALIFYING_DAYS,
  INACTIVITY_LIMIT_DAYS,
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
  const payloadInitialBalance = Number(
    account.statisticsPayload?.account_info?.initial_balance ??
      account.statisticsPayload?.statistics?.account_stats?.initial_balance,
  );
  const balanceBeforeProfit = Number(account.balance) - Number(account.totalPl || 0);

  const initialBalance = Number(plan?.size) > 0
    ? Number(plan?.size)
    : Number.isFinite(payloadInitialBalance) && payloadInitialBalance > 0
      ? payloadInitialBalance
      : Number.isFinite(balanceBeforeProfit) && balanceBeforeProfit > 0
        ? balanceBeforeProfit
        : Number(account.balance);

  return {
    initialBalance,
    ruleVersion,
    order,
    plan,
    rule: getChallengeRule(plan?.name || order?.planId || account.phase, ruleVersion),
  };
}

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

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const kyc = await db.getKycByUserId(user.id);
    if (!kyc || kyc.status !== "approved") {
      return NextResponse.json(
        { error: "Access Denied: Your identity verification (KYC) must be approved before requesting a payout." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { accountId, paymentMethod, paymentDetails } = body;
    const requestedAmount = Number(body.amount);
    if (!accountId || !Number.isFinite(requestedAmount) || requestedAmount <= 0 || !paymentMethod || !paymentDetails) {
      return NextResponse.json(
        { error: "Required fields: accountId, a positive amount, paymentMethod, and paymentDetails." },
        { status: 400 },
      );
    }

    const storedAccount = await db.getAccountById(accountId);
    if (!storedAccount || storedAccount.userId !== user.id) {
      return NextResponse.json({ error: "Trading account not found or access denied." }, { status: 404 });
    }

    const account = await refreshAccountStatisticsIfNeeded(storedAccount);
    const isFunded = account.status === "Funded" || account.phase === "Funded (Live)" || account.server.includes("Live");
    if (!isFunded || account.status === "Failed") {
      return NextResponse.json({ error: "Payouts are only available on active Instant Funded or Funded accounts." }, { status: 400 });
    }

    const { initialBalance, rule, ruleVersion, order: accountOrder, plan: accountPlan } = await resolveAccountPlan(account);
    const newRulesEnforced = ruleVersion === "current";
    const profitableDays = calculateProfitableTradingDays(account.statisticsPayload, initialBalance);
    if (profitableDays.count < profitableDays.requiredDays) {
      return NextResponse.json(
        { error: `Payout requires 3 profitable trading days with at least $${profitableDays.threshold.toLocaleString()} (0.5% of initial balance) on each day. Current progress: ${profitableDays.count}/3.` },
        { status: 400 },
      );
    }

    // Instant and every Funded stage additionally need 5 qualifying days in total
    // (the 3 Profitable Days plus 2 more that can be plain Trading Days).
    if (requiresQualifyingTradingDays(rule, account.phase, account.status, ruleVersion)) {
      const qualifyingDays = Math.max(
        profitableDays.count,
        calculateTradingDays(account.statisticsPayload).count,
      );
      if (qualifyingDays < FUNDED_MIN_QUALIFYING_DAYS) {
        return NextResponse.json(
          { error: `Payout requires ${FUNDED_MIN_QUALIFYING_DAYS} qualifying days in total (3 profitable + 2 trading days). Current progress: ${qualifyingDays}/${FUNDED_MIN_QUALIFYING_DAYS}.` },
          { status: 400 },
        );
      }
    }

    // Legacy rulebook: breaking the 30% profit consistency rule fails the account.
    // The compliance run marks it Failed; this also stops a payout in the meantime.
    if (!newRulesEnforced) {
      const consistency = getProfitConsistency(account.statisticsPayload);
      if (consistency.bestDay && consistency.ratioPercent > LEGACY_PROFIT_CONSISTENCY_PERCENT) {
        return NextResponse.json(
          { error: `Payout not eligible yet: your best day ($${consistency.bestDay.profit.toLocaleString()} on ${consistency.bestDay.date}) is ${consistency.ratioPercent}% of your $${consistency.totalProfit.toLocaleString()} total profit. Under the ${LEGACY_PROFIT_CONSISTENCY_PERCENT}% consistency rule it must be ${LEGACY_PROFIT_CONSISTENCY_PERCENT}% or less. The account has breached the Profit Consistency Rule and is not eligible for a payout.` },
          { status: 400 },
        );
      }
    }

    if (newRulesEnforced && getTickScalpingViolations(account.statisticsPayload).length > 0) {
      return NextResponse.json(
        { error: "Account breached: 3 or more trades held under 10 seconds were closed within a single hour (tick scalping)." },
        { status: 409 },
      );
    }

    const inactivityBreach = newRulesEnforced ? getInactivityBreach(account.statisticsPayload) : null;
    if (inactivityBreach) {
      return NextResponse.json(
        { error: `Account breached: no trade has been executed for ${inactivityBreach.daysSinceLastTrade} days (limit is ${INACTIVITY_LIMIT_DAYS}).` },
        { status: 409 },
      );
    }

    // Trade layering is a hard breach on Live (Funded) and Instant accounts (both
    // already gated behind `isFunded` above): the very first trade opened inside the
    // 5-minute window — open or closed — fails the account, with no warning step.
    const layeringViolations = detectStatisticsTradeLayering(account.statisticsPayload);
    if (layeringViolations.length > 0) {
      return NextResponse.json(
        {
          error: `Account breached: ${layeringViolations.length} trade${layeringViolations.length === 1 ? "" : "s"} opened inside the 5-minute layering window from the previous trade's opening time. ${formatTradeLayeringViolations(layeringViolations)}`,
        },
        { status: 409 },
      );
    }

    // Instant Funded's additional cap: a maximum of 2 concurrent same-instrument,
    // same-direction positions. A 3rd fails the account even if entries were spaced
    // more than 5 minutes apart.
    if (rule.key === "instant_funding") {
      const concurrentLayering = getMaxConcurrentLayers(
        getStatisticsTrades(account.statisticsPayload),
        getOpenStatisticsTrades(account.statisticsPayload),
      );
      if (concurrentLayering.maxOverlap >= 3) {
        return NextResponse.json(
          {
            error: `Account breached: ${concurrentLayering.maxOverlap} same-instrument, same-direction positions were held open at once (Instant Funded cap is 2). ${formatConcurrentLayeringTrades(concurrentLayering.violatingTrades)}`,
          },
          { status: 409 },
        );
      }
    }

    const minimumHoldingViolationIds = getAllMinimumHoldingViolationIds(account.statisticsPayload);
    if (storedMinimumHoldingViolationsChanged(account.statisticsPayload, minimumHoldingViolationIds)) {
      account.statisticsPayload = withStoredMinimumHoldingViolations(account.statisticsPayload, minimumHoldingViolationIds);
      await db.saveAccount(account);
    }
    if (minimumHoldingViolationIds.length > MINIMUM_HOLDING_RELAXATIONS) {
      account.status = "Failed";
      // Pin the reason so the dashboard banner names this rule even if a later
      // statistics refresh stops reporting the violation.
      account.statisticsPayload = withStoredBreachReason(account.statisticsPayload, {
        id: "minimum-holding-time-breach",
        title: "Minimum Holding Time Breach",
        message: `Account ${account.id} failed because a trade was closed before the required 180 seconds (3 minutes).`,
      });
      await db.saveAccount(account);
      const order = account.orderId ? await db.getOrderById(account.orderId) : undefined;
      if (order) {
        order.status = "Failed";
        order.updatedAt = new Date().toISOString();
        await db.saveOrder(order);
      }
      await db.saveAuditLog({
        id: `log-${Math.random().toString(36).substring(2, 11)}`,
        userId: account.userId,
        userName: "Rule Engine",
        targetId: account.id,
        targetType: "account",
        action: "minimum_holding_time_breach",
        description: `Account ${account.id} failed after its second lifetime trade closed before 180 seconds.`,
        createdAt: new Date().toISOString(),
      });
      await db.saveNotification({
        id: `rule-${account.id}-minimum-holding-time-breach`,
        userId: account.userId,
        title: "Minimum Holding Time Breach",
        message: `Account ${account.id} failed because a second lifetime trade was closed before the required 180 seconds.`,
        type: "error",
        channel: "in_app",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "Account breached: a second trade was closed before the 3-minute minimum holding time." },
        { status: 409 },
      );
    }
    const weekendHoldingAllowed = rule.fundedWeekendHolding || Boolean(account.weekendHoldingAddon);
    const weekendHoldingViolations = weekendHoldingAllowed
      ? []
      : getWeekendHoldingViolations(account.statisticsPayload);
    // News Trading Rule (soft breach): never blocks the payout, but the positive
    // profit of every trade opened/closed inside a restricted news window is
    // removed from withdrawable profit and the request is flagged for review.
    const newsEvents = await loadNewsEventsForAccounts([account]);
    const newsEvaluation = evaluateAccountRules(account, { order: accountOrder, plan: accountPlan, newsEvents });
    const newsViolations = newsEvaluation.newsViolations;
    const newsProfitToDeduct = newsEvaluation.newsProfitToDeduct;
    if (newsEvents !== null && storedNewsViolationsChanged(account.statisticsPayload, newsViolations)) {
      account.statisticsPayload = withStoredNewsViolations(account.statisticsPayload, newsViolations);
      await db.saveAccount(account);
    }
    const periodStart = getPayoutPeriodStart(account.createdAt);
    const userPayouts = await db.getPayoutsByUserId(user.id);
    const accountPayouts = userPayouts.filter(
      (payout) =>
        payout.accountId === account.id &&
        payout.status !== "rejected" &&
        new Date(payout.createdAt).getTime() >= periodStart.getTime(),
    );
    const alreadyRequestedInPeriod = accountPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
    // Progressive performance-fee split: 80% on the first withdrawal, 85% on the
    // second, 90% on the third and every one after. Legacy-pinned accounts keep the
    // flat split from their rule set.
    const priorSuccessfulPayouts = userPayouts.filter(
      (payout) => payout.accountId === account.id && payout.status === "paid",
    ).length;
    const profitSplitPercent = newRulesEnforced
      ? getProfitSplitPercent(priorSuccessfulPayouts)
      : rule.profitSplitPercent;
    const eligibility = calculatePayoutEligibility({
      initialBalance,
      currentBalance: account.balance,
      requestedAmount,
      alreadyRequestedInPeriod,
      profitSplitPercent,
      nonWithdrawableProfit: newsProfitToDeduct,
    });

    if (eligibility.availableProfit <= 0) {
      return NextResponse.json(
        {
          error: newsProfitToDeduct > 0 && eligibility.grossProfit > 0
            ? `No withdrawable profit is available: $${newsProfitToDeduct.toLocaleString()} of profit came from trades opened or closed inside high-impact news windows and is not withdrawable.`
            : "No withdrawable profit is available. The account balance must exceed its initial balance.",
          newsViolations,
          newsProfitToDeduct,
        },
        { status: 400 },
      );
    }
    if (eligibility.maximumWithdrawal <= 0) {
      return NextResponse.json(
        { error: `The 6% withdrawal cap for this payout period has already been reached ($${eligibility.withdrawalCap.toLocaleString()}).` },
        { status: 400 },
      );
    }

    if (eligibility.adjustedAmount < 100) {
      return NextResponse.json({ error: "The minimum gross payout request is $100." }, { status: 400 });
    }

    const complianceFlags: string[] = [];
    if (weekendHoldingViolations.length > 0) {
      complianceFlags.push(`${weekendHoldingViolations.length} prohibited Instant Funded weekend-holding position${weekendHoldingViolations.length === 1 ? "" : "s"}.`);
    }
    if (newsViolations.length > 0) {
      const tickets = new Set(newsViolations.map((violation) => violation.ticket)).size;
      complianceFlags.push(
        `News Trading Rule: ${tickets} trade${tickets === 1 ? "" : "s"} opened/closed within a high-impact news window; $${newsProfitToDeduct.toLocaleString()} profit deducted from withdrawable profit. ${newsViolations.map(formatNewsViolation).join("; ")}`,
      );
    }
    const complianceNote = complianceFlags.length > 0
      ? `Automated compliance flag: ${complianceFlags.join(" ")}`
      : undefined;

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
      notes: complianceNote,
      createdAt: new Date().toISOString(),
    };

    await db.savePayout(newPayout);

    const adjustmentText = eligibility.wasAdjusted
      ? ` Your requested amount was automatically adjusted to $${eligibility.adjustedAmount.toLocaleString()} under the 6% per-period withdrawal cap.`
      : "";
    const complianceText = complianceFlags.length > 0
      ? " The request includes a trading-rule compliance flag for review."
      : "";
    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.id,
      title: "Payout Requested",
      message: `Your gross payout request of $${eligibility.adjustedAmount.toLocaleString()} has been submitted.${adjustmentText}${complianceText}`,
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
      },
      newsViolations,
      newsProfitToDeduct,
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
