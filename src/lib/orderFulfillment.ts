import { db, DBChallengeInventoryItem, DBOrder, DBTradingAccount, DBUser } from "./db";
import { getChallengeRule } from "./rulebook";
import { recordCollaboratorSale } from "./collaborators";
import { sendMetaConversionEvent } from "./metaConversionsApi";
import { grantBogoOffersForOrder } from "./offerGrants";

function normalizePlatform(platform?: string) {
  return String(platform || "MT5").trim().toLowerCase();
}

function credentialKey(platform: unknown, server: unknown, login: unknown) {
  return [platform, server, login].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

// Mirrors the partial unique index in account_credential_uniqueness_migration.sql.
function isRealCredential(server: unknown, login: unknown) {
  const normalizedLogin = String(login || "").trim().toLowerCase();
  const normalizedServer = String(server || "").trim().toLowerCase();
  return Boolean(normalizedLogin) && !normalizedLogin.startsWith("generated_") && normalizedServer !== "range4ex-pendingserver";
}

/**
 * Claim a ready container for a paid order: same platform and size, oldest
 * first, skipping any whose credentials already sit on a delivered account
 * (the admin's manual picker hides those too, and saving them would trip the
 * credential uniqueness index). The claim is atomic, so two payments landing
 * at once never share a container. Undefined means "nothing ready - leave the
 * account for manual delivery".
 */
export async function reserveInventoryAccount(order: DBOrder, platform: string, size: number) {
  let inventory: DBChallengeInventoryItem[];
  let accounts: DBTradingAccount[];
  try {
    [inventory, accounts] = await Promise.all([db.getChallengeInventory(), db.getAccounts()]);
  } catch (error) {
    console.warn("Challenge inventory lookup failed; falling back to manual delivery.", error);
    return undefined;
  }

  const credentialsInUse = new Set(
    accounts
      .filter((account) => account.deliveryStatus === "delivered" && isRealCredential(account.server, account.login))
      .map((account) => credentialKey(account.platform, account.server, account.login)),
  );

  const candidates = inventory
    .filter(
      (item) =>
        item.status === "available" &&
        normalizePlatform(item.platform) === normalizePlatform(platform) &&
        Number(item.size) === Number(size) &&
        !credentialsInUse.has(credentialKey(item.platform, item.server, item.login)),
    )
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

  for (const candidate of candidates) {
    try {
      const claimed = await db.claimChallengeInventoryItem(candidate.id, order.id);
      if (claimed) return claimed;
    } catch (error) {
      console.warn("Challenge inventory reservation failed; falling back to manual delivery.", error);
      return undefined;
    }
  }
  return undefined;
}

/**
 * The platform the trader picked at checkout. Orders do not store it on their
 * own; the pay route encodes it in `gatewayRef` (e.g. `whop:<id>:MT5`).
 */
export function getOrderPlatform(order: DBOrder) {
  const segment = String(order.gatewayRef || "")
    .split(":")
    .find((part) => /^(mt4|mt5|ctrader)$/i.test(part.trim()));
  return segment ? segment.trim() : "MT5";
}

/** Copy a claimed container's credentials onto an account and mark it delivered. */
export function applyInventoryCredentials(account: DBTradingAccount, item: DBChallengeInventoryItem): DBTradingAccount {
  return {
    ...account,
    platform: (item.platform || account.platform) as DBTradingAccount["platform"],
    login: item.login,
    passwordMaster: item.password,
    passwordInvestor: item.password,
    server: item.server,
    externalStatisticsId: item.externalStatisticsId || account.externalStatisticsId || "",
    statisticsApiId: item.externalStatisticsId || account.statisticsApiId || "",
    graphLink: item.graphLink || account.graphLink || "",
    deliveryStatus: "delivered",
    deliveredAt: new Date().toISOString(),
  };
}

/**
 * Save a new account, delivered from `reserved` when there is one. If the
 * delivered save fails, the container goes back to the shelf and the account
 * is saved as pending instead - the order has already been marked paid by
 * then, and a webhook retry will not run this again, so failing here would
 * leave a paid order with no account at all.
 */
export async function saveNewAccount(
  pending: DBTradingAccount,
  reserved: DBChallengeInventoryItem | undefined,
  order: DBOrder,
): Promise<{ account: DBTradingAccount; delivered: boolean }> {
  if (reserved) {
    try {
      const account = await db.saveAccount(applyInventoryCredentials(pending, reserved));
      return { account, delivered: true };
    } catch (error) {
      console.warn(`Auto-delivery of container ${reserved.id} for order ${order.id} failed; queuing manual delivery.`, error);
      try {
        await db.releaseChallengeInventoryItem(reserved.id, order.id);
      } catch (releaseError) {
        console.warn(`Could not release container ${reserved.id}.`, releaseError);
      }
    }
  }
  return { account: await db.saveAccount(pending), delivered: false };
}

/** The trader email the admin's manual delivery sends, reused for auto-delivery. */
export async function notifyCredentialsDelivered(account: DBTradingAccount) {
  await db.saveNotification({
    id: "notif-" + Math.random().toString(36).substring(2, 11),
    userId: account.userId,
    title: "Trading Credentials Delivered",
    message: `Your account credentials have been delivered for Account ${account.login}. Platform: ${account.platform} | Server: ${account.server} | Master Pass: ${account.passwordMaster}. You can now log in to your trading platform.`,
    type: "success",
    channel: "email",
    status: "sent",
    read: false,
    sentAt: new Date().toISOString(),
  });
}

export async function fulfillPaidOrder(order: DBOrder, user: DBUser, platform = "MT5", gatewayRef?: string): Promise<DBTradingAccount | undefined> {
  const plan = await db.getPlanById(order.planId);
  if (!plan) {
    throw new Error("Challenge plan not found for this order.");
  }

  const accounts = await db.getAccounts();
  const existingAccount = accounts.find((a) => a.orderId === order.id && a.phase === "Phase 1 (Evaluation)");
  if (existingAccount) return existingAccount;

  if (order.status.toLowerCase() !== "pending") {
    return undefined;
  }

  order.status = "Paid";
  order.gatewayRef = gatewayRef || order.gatewayRef;
  order.updatedAt = new Date().toISOString();
  await db.saveOrder(order);

  await db.saveAuditLog({
    id: "log-" + Math.random().toString(36).substring(2, 11),
    userId: user.id,
    userName: user.name,
    targetId: order.id,
    targetType: "order",
    action: "order_payment",
    description: `Trader completed payment of $${order.amountPaid} for Order ${order.id} (${plan.name})`,
    createdAt: new Date().toISOString(),
  });

  const accountId = Math.floor(100000 + Math.random() * 900000).toString();
  const challengeRule = getChallengeRule(plan.name);
  const isInstant = challengeRule.key === "instant_funding";
  // Instant delivery: a matching container goes straight onto the account.
  // With none ready the account is queued for the admin's manual delivery.
  const reservedAccount = await reserveInventoryAccount(order, platform, plan.size);
  const reservedIdFree = reservedAccount && !accounts.some((a) => a.id === reservedAccount.login);
  const pendingAccount: DBTradingAccount = {
    id: reservedIdFree && reservedAccount ? reservedAccount.login : accountId,
    userId: order.userId,
    orderId: order.id,
    platform: (platform || "MT5") as any,
    login: accountId,
    passwordMaster: "GENERATED_MASTER_PASS",
    passwordInvestor: "GENERATED_INVEST_PASS",
    server: "Range4ex-PendingServer",
    profitTarget: plan.size * (challengeRule.phase1TargetPercent / 100),
    balance: plan.size,
    equity: plan.size,
    todayPl: 0,
    totalPl: 0,
    status: isInstant ? "Funded" : "Active",
    phase: isInstant ? "Funded (Live)" : "Phase 1 (Evaluation)",
    graphLink: "",
    weekendHoldingAddon: Boolean(order.weekendHoldingAddon),
    externalStatisticsId: "",
    statisticsApiId: "",
    deliveryStatus: "pending",
    createdAt: new Date().toISOString(),
  };

  const { account: newAccount, delivered } = await saveNewAccount(pendingAccount, reservedAccount, order);

  // Live BOGO offers apply automatically (no code); never block the paid account.
  try {
    await grantBogoOffersForOrder(order, plan);
  } catch (offerError) {
    console.warn("BOGO offer grant skipped:", offerError);
  }

  // This runs alongside, but independently of, the existing affiliate program.
  await recordCollaboratorSale(order, user);

  if (order.referralBalanceApplied && order.referralBalanceApplied > 0) {
    const userReferrals = (await db.getReferrals()).filter((r) => r.affiliateId === order.userId && r.status === "approved");
    let remainingToPay = order.referralBalanceApplied;
    for (const ref of userReferrals) {
      if (remainingToPay <= 0) break;
      await db.updateReferralStatus(ref.referredUserId, ref.orderId, "paid");
      remainingToPay -= ref.commissionAmount;
    }
  }

  const referrals = await db.getReferrals();
  const linkedRef = referrals.find((r) => r.orderId === order.id);
  if (linkedRef) {
    await db.updateReferralStatus(order.userId, order.id, "approved");
    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: linkedRef.affiliateId,
      title: "Referral Commission Earned",
      message: `Your referral link generated a new sale! $${linkedRef.commissionAmount} has been credited to your balance (pending payout).`,
      type: "success",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });
  } else if (user.referredBy) {
    const commissionAmount = Number((order.amountPaid * 0.05).toFixed(2));
    await db.saveReferral({
      referredUserId: order.userId,
      affiliateId: user.referredBy,
      orderId: order.id,
      commissionAmount,
      status: "approved",
      createdAt: new Date().toISOString(),
    });
    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: user.referredBy,
      title: "Referral Commission Earned",
      message: `Your referral link generated a new sale! $${commissionAmount} has been credited to your balance (pending payout).`,
      type: "success",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });
  }

  await db.saveNotification({
    id: "notif-" + Math.random().toString(36).substring(2, 11),
    userId: user.id,
    title: "Payment Received",
    message: delivered
      ? `Your purchase is complete and your trading account is ready. Order ID: ${order.id} | Plan: ${plan.name} | Amount: $${Number(order.amountPaid).toFixed(2)} | Status: Paid and delivered | Platform: ${newAccount.platform} | Login: ${newAccount.login} | Server: ${newAccount.server} | Master Password: ${newAccount.passwordMaster}.`
      : `Thank you! Your purchase is complete. Order ID: ${order.id} | Plan: ${plan.name} | Amount: $${Number(order.amountPaid).toFixed(2)} | Status: Paid — account provisioning in progress. Your credentials will be sent in a separate delivery email.`,
    type: "success",
    channel: delivered ? "email" : "in_app",
    status: "sent",
    read: false,
    sentAt: new Date().toISOString(),
  });

  await db.saveNotification({
    id: "notif-" + Math.random().toString(36).substring(2, 11),
    userId: user.id,
    title: delivered ? "Challenge Account Delivered" : "Account Provisioning Queued",
    message: delivered
      ? `Your ${plan.name} ${newAccount.platform} account for $${Number(plan.size).toLocaleString()} is ready inside your dashboard.`
      : `Your ${plan.name} trading account is currently being provisioned. Credentials will be delivered shortly.`,
    type: delivered ? "success" : "info",
    channel: "in_app",
    status: "sent",
    read: false,
    sentAt: new Date().toISOString(),
  });

  return newAccount;
}
