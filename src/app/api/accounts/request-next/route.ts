import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBTradingAccount } from "@/lib/db";
import { reserveInventoryAccount, saveNewAccount } from "@/lib/orderFulfillment";
import {
  PHASE_FUNDED,
  PHASE_TWO,
  getNextStagePhase,
  getOrderStatusForPhase,
  getStageAccountStatus,
  getStageProfitTarget,
} from "@/lib/challengeStages";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: "Account ID is required." }, { status: 400 });
    }

    const account = await db.getAccountById(accountId);
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (account.userId !== user.id) {
      return NextResponse.json({ error: "Access Denied: Account does not belong to you." }, { status: 403 });
    }

    if (account.status !== "Passed") {
      return NextResponse.json({ error: "Account has not passed the evaluation objectives." }, { status: 400 });
    }

    const order = await db.getOrderById(account.orderId);
    if (!order) {
      return NextResponse.json({ error: "Associated order not found." }, { status: 404 });
    }

    const plan = await db.getPlanById(order.planId);
    const size = plan ? plan.size : 100000;

    // One Step and Instant plans skip Phase 2 entirely: Evaluation goes straight to Funded (Live).
    const nextPhase = getNextStagePhase(plan?.name, account.phase);
    if (!nextPhase) {
      return NextResponse.json({ error: "Account phase is not eligible for upgrade request." }, { status: 400 });
    }

    const accountsList = await db.getAccounts();
    const alreadyExists = accountsList.some((a) => a.orderId === order.id && a.phase === nextPhase);
    if (alreadyExists) {
      return NextResponse.json(
        {
          error:
            nextPhase === PHASE_TWO
              ? "Phase 2 account has already been requested or provisioned."
              : "Funded Live account has already been requested or provisioned.",
        },
        { status: 400 },
      );
    }

    order.status = getOrderStatusForPhase(nextPhase) as any;
    order.updatedAt = new Date().toISOString();
    await db.saveOrder(order);

    const reservedAccount = await reserveInventoryAccount(order, account.platform, size);

    // Create the next stage account from inventory when available, otherwise queue admin delivery.
    const generatedId = Math.floor(100000 + Math.random() * 900000).toString();
    const reservedIdFree = reservedAccount && !accountsList.some((a) => a.id === reservedAccount.login);
    const pendingAccount: DBTradingAccount = {
      id: reservedIdFree && reservedAccount ? reservedAccount.login : generatedId,
      userId: order.userId,
      orderId: order.id,
      platform: account.platform,
      login: generatedId,
      passwordMaster: "GENERATED_MASTER_PASS",
      passwordInvestor: "GENERATED_INVEST_PASS",
      server: "Range4ex-PendingServer",
      profitTarget: getStageProfitTarget(plan?.name, nextPhase, size),
      balance: size, // start with initial size
      equity: size,
      todayPl: 0,
      totalPl: 0,
      status: getStageAccountStatus(nextPhase),
      phase: nextPhase,
      graphLink: "",
      externalStatisticsId: "",
      statisticsApiId: "",
      deliveryStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    const { account: newAccount, delivered } = await saveNewAccount(pendingAccount, reservedAccount, order);

    const stageLabel = nextPhase === PHASE_FUNDED ? "Live Funded" : "Phase 2 Verification";

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: order.userId,
      title: delivered ? `${stageLabel} Account Delivered` : `${stageLabel} Account Requested`,
      message: delivered
        ? `Congratulations! Your ${stageLabel} trading account has been delivered. Login: ${newAccount.login} | Server: ${newAccount.server} | Master Pass: ${newAccount.passwordMaster}.`
        : `Congratulations! Your ${stageLabel} trading account has been requested and is pending manual delivery.`,
      type: "success",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: delivered
        ? `${stageLabel} account delivered successfully.`
        : `${stageLabel} account requested successfully.`,
      accountId: newAccount.id,
    });
  } catch (error: any) {
    console.error("Account upgrade request error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
