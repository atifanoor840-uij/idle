import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { db, DBChallengeInventoryItem, DBTradingAccount } from "@/lib/db";
import { refreshAccountsStatistics } from "@/lib/accountStatistics";
import { applyAccountRuleCompliance } from "@/lib/accountCompliance";
import { withStoredBreachReason } from "@/lib/accountTradingRules";
import { grantBogoOffersForOrder } from "@/lib/offerGrants";
import {
  PHASE_FUNDED,
  getNextStagePhase,
  getOrderStatusForPhase,
  getPhaseRank,
  getStageAccountStatus,
  getStageProfitTarget,
} from "@/lib/challengeStages";
import { readSessionUserId } from "@/lib/session";

function credentialKey(platform: unknown, server: unknown, login: unknown) {
  return [platform, server, login]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}

function isRealCredential(platform: unknown, server: unknown, login: unknown) {
  const normalizedLogin = String(login || "").trim().toLowerCase();
  const normalizedServer = String(server || "").trim().toLowerCase();
  return Boolean(
    String(platform || "").trim() &&
      normalizedLogin &&
      !normalizedLogin.startsWith("generated_") &&
      normalizedServer &&
      normalizedServer !== "range4ex-pendingserver",
  );
}

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

// The admin list covers every account, so refreshing each one's statistics
// from the external feed and then running the rule engine (which saves rows,
// notifications and audit logs one by one) used to hold the whole CRM load
// hostage - the desk waited on dozens of third-party calls. The admin now gets
// the stored rows at once and the sweep runs after the response; its results
// show on the next load or refresh. Only one sweep runs per instance at a time
// so rapid refreshes do not pile up duplicate rule passes.
let adminSweep: Promise<unknown> | null = null;
function scheduleAdminComplianceSweep() {
  if (adminSweep) return;
  const sweep = (async () => {
    try {
      await applyAccountRuleCompliance(await refreshAccountsStatistics(await db.getAccounts()));
    } catch (error) {
      console.error("Admin account compliance sweep failed:", error);
    } finally {
      adminSweep = null;
    }
  })();
  adminSweep = sweep;
  // Keeps the serverless function alive until the sweep has finished.
  after(() => sweep);
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "admin") {
      const [allAccounts, allUsers] = await Promise.all([db.getAccounts(), db.getUsers()]);
      scheduleAdminComplianceSweep();
      // Join with user names for admin console convenience
      const usersById = new Map(allUsers.map((usr) => [usr.id, usr]));
      const enrichedAccounts = allAccounts.map((a) => {
        const u = usersById.get(a.userId);
        return {
          ...a,
          userName: u?.name || "Unknown User",
          userEmail: u?.email || "N/A",
        };
      });
      return NextResponse.json({ success: true, accounts: enrichedAccounts });
    }

    const myAccounts = await applyAccountRuleCompliance(await refreshAccountsStatistics(await db.getAccountsByUserId(user.id)));
    return NextResponse.json({ success: true, accounts: myAccounts });
  } catch (error: any) {
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
    const { id, platform, login, passwordMaster, passwordInvestor, server, profitTarget, graphLink, balance, equity, status, simulateObjectivePassed, externalStatisticsId, statisticsApiId, inventoryItemId } = body;

    if (!id || !platform || !login || !passwordMaster || !server) {
      return NextResponse.json({ error: "Required fields: id, platform, login, passwordMaster, server." }, { status: 400 });
    }

    let account = await db.getAccountById(id);
    let oldDeliveryStatus = "";
    let oldStatus = "";
    let selectedInventoryItem: DBChallengeInventoryItem | undefined;
    const normalizedCredentialKey = credentialKey(platform, server, login);

    if (isRealCredential(platform, server, login)) {
      const existingCredentialOwner = (await db.getAccounts()).find(
        (candidate) =>
          candidate.id !== id &&
          candidate.deliveryStatus === "delivered" &&
          isRealCredential(candidate.platform, candidate.server, candidate.login) &&
          credentialKey(candidate.platform, candidate.server, candidate.login) ===
            normalizedCredentialKey,
      );

      if (existingCredentialOwner) {
        return NextResponse.json(
          {
            error:
              "These platform credentials are already assigned to another trading account. Select a different inventory account.",
          },
          { status: 409 },
        );
      }
    }

    if (inventoryItemId) {
      selectedInventoryItem = await db.getChallengeInventoryById(inventoryItemId);
      if (!selectedInventoryItem) {
        return NextResponse.json(
          { error: "The selected inventory account no longer exists." },
          { status: 404 },
        );
      }

      const requestedOrderId = String(body.orderId || account?.orderId || "");
      const isSameExistingAssignment = Boolean(
        account &&
          selectedInventoryItem.status === "delivered" &&
          selectedInventoryItem.orderId === requestedOrderId &&
          account.id === id &&
          credentialKey(account.platform, account.server, account.login) ===
            normalizedCredentialKey,
      );

      if (selectedInventoryItem.status !== "available" && !isSameExistingAssignment) {
        return NextResponse.json(
          {
            error:
              "That inventory account has already been delivered. Refresh the list and select another account.",
          },
          { status: 409 },
        );
      }

      if (
        credentialKey(
          selectedInventoryItem.platform,
          selectedInventoryItem.server,
          selectedInventoryItem.login,
        ) !== normalizedCredentialKey
      ) {
        return NextResponse.json(
          { error: "The submitted credentials do not match the selected inventory account." },
          { status: 400 },
        );
      }
    }

    if (!account) {
      // Create new account record in DB since it was initiated from order ledger or delivery queue
      const newAccount: DBTradingAccount = {
        id: id,
        userId: body.userId || admin.id,
        orderId: body.orderId || "",
        platform: platform as any,
        login: login,
        passwordMaster: passwordMaster,
        passwordInvestor: passwordInvestor || "GENERATED_INVEST_PASS",
        server: server,
        profitTarget: profitTarget !== undefined ? Number(profitTarget) : 8000,
        balance: Number(balance) || 100000,
        equity: Number(balance) || 100000,
        todayPl: 0,
        totalPl: 0,
        status: (status as any) || "Active",
        phase: body.phase || "Phase 1 (Evaluation)",
        graphLink: graphLink || "",
        externalStatisticsId: externalStatisticsId || statisticsApiId || "",
        statisticsPayload: null,
        statisticsUpdatedAt: undefined,
        deliveryStatus: "delivered",
        createdAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
      };

      // Auto-activate the order if it's currently Pending
      if (body.orderId) {
        const order = await db.getOrderById(body.orderId);
        if (order && order.status === "Pending") {
          order.status = "Active";
          order.updatedAt = new Date().toISOString();
          await db.saveOrder(order);
          try {
            await grantBogoOffersForOrder(order, await db.getPlanById(order.planId));
          } catch (offerError) {
            console.warn("BOGO offer grant skipped:", offerError);
          }
        }
      }

      await db.saveAccount(newAccount);
      account = newAccount;
      oldDeliveryStatus = "pending";
      oldStatus = "Active";

      await db.saveAuditLog({
        id: "log-" + Math.random().toString(36).substring(2, 11),
        userId: admin.id,
        userName: admin.name,
        targetId: account.id,
        targetType: "account",
        action: "account_delivery",
        description: `Admin delivered credentials for newly created Account ${login} (Platform: ${platform}, Server: ${server}, Phase: ${account.phase})`,
        createdAt: new Date().toISOString(),
      });
    } else {
      oldDeliveryStatus = account.deliveryStatus;
      oldStatus = account.status;

      // Track changes for detailed audit logging
      const changes: string[] = [];
      if (platform !== undefined && platform !== account.platform) changes.push(`Platform: ${account.platform} -> ${platform}`);
      if (login !== undefined && login !== account.login) changes.push(`Login: ${account.login} -> ${login}`);
      if (passwordMaster !== undefined && passwordMaster !== account.passwordMaster) changes.push(`Password changed`);
      if (server !== undefined && server !== account.server) changes.push(`Server: ${account.server} -> ${server}`);
      if (profitTarget !== undefined && Number(profitTarget) !== account.profitTarget) changes.push(`Profit Target: ${account.profitTarget} -> ${profitTarget}`);
      if (graphLink !== undefined && graphLink !== account.graphLink) changes.push(`Graph Link: "${account.graphLink}" -> "${graphLink}"`);
      if ((externalStatisticsId || statisticsApiId || "") !== (account.externalStatisticsId || "")) changes.push(`Statistics API ID updated`);
      if (balance !== undefined && Number(balance) !== account.balance) changes.push(`Balance: ${account.balance} -> ${balance}`);
      if (body.phase !== undefined && body.phase !== account.phase) changes.push(`Phase: ${account.phase} -> ${body.phase}`);

      // Save fields
      account.platform = platform;
      account.login = login;
      account.passwordMaster = passwordMaster;
      account.passwordInvestor = passwordInvestor || "";
      account.server = server;
      if (profitTarget !== undefined) account.profitTarget = Number(profitTarget);
      if (graphLink !== undefined) account.graphLink = graphLink;
      if (balance !== undefined) account.balance = Number(balance);
      if (equity !== undefined) account.equity = Number(equity);
      if (body.phase !== undefined) account.phase = body.phase;
      if (externalStatisticsId !== undefined || statisticsApiId !== undefined) {
        account.externalStatisticsId = externalStatisticsId || statisticsApiId || "";
        account.statisticsPayload = null;
        account.statisticsUpdatedAt = undefined;
      }

      if (status !== undefined && status !== account.status) {
        // Record why the account was failed (and clear it when the account is reset)
        // so the trader's breach banner names an actual reason instead of the
        // generic "violated a hard account rule" fallback.
        account.statisticsPayload =
          status === "Failed"
            ? withStoredBreachReason(account.statisticsPayload, {
                id: "manual-status-override",
                title: "Account Failed by Compliance Review",
                message: `Account ${account.id} was failed manually by the compliance team after a review of its trading activity. Contact the support desk for the full breakdown of the rule that was broken.`,
              })
            : withStoredBreachReason(account.statisticsPayload, null);
      }
      if (status !== undefined) account.status = status;

      // Delivery activation
      if (oldDeliveryStatus !== "delivered") {
        account.deliveryStatus = "delivered";
        account.deliveredAt = new Date().toISOString();

        await db.saveAuditLog({
          id: "log-" + Math.random().toString(36).substring(2, 11),
          userId: admin.id,
          userName: admin.name,
          targetId: account.id,
          targetType: "account",
          action: "account_delivery",
          description: `Admin delivered credentials for Account ${login} (Platform: ${platform}, Server: ${server}, Phase: ${account.phase})`,
          createdAt: new Date().toISOString(),
        });
      } else if (changes.length > 0) {
        await db.saveAuditLog({
          id: "log-" + Math.random().toString(36).substring(2, 11),
          userId: admin.id,
          userName: admin.name,
          targetId: account.id,
          targetType: "account",
          action: "account_update",
          description: `Admin updated Account ${account.id} fields: ${changes.join(", ")}`,
          createdAt: new Date().toISOString(),
        });
      }

      // Check status override
      if (status !== undefined && status !== oldStatus) {
        await db.saveAuditLog({
          id: "log-" + Math.random().toString(36).substring(2, 11),
          userId: admin.id,
          userName: admin.name,
          targetId: account.id,
          targetType: "account",
          action: "account_status_override",
          description: `Admin changed Account ${account.id} status from "${oldStatus}" to "${status}"`,
          createdAt: new Date().toISOString(),
        });

        if (status === "Failed" || status === "Passed") {
          await db.saveNotification({
            id: "notif-" + Math.random().toString(36).substring(2, 11),
            userId: account.userId,
            title: status === "Passed" ? "Challenge Account Passed" : "Challenge Account Failed",
            message:
              status === "Passed"
                ? `Account ${account.id} has been marked as passed. Your next stage or certificate will be processed automatically where applicable.`
                : `Account ${account.id} has been marked as failed. Please review the rules and contact support if you believe this is incorrect.`,
            type: status === "Passed" ? "success" : "error",
            channel: "email",
            status: "sent",
            read: false,
            sentAt: new Date().toISOString(),
          });
        }

        // Keep the order in sync when an account is marked Failed directly from the
        // credentials/account editor, so it leaves the Active/Delivered lists and
        // shows up under the admin Orders "Failed" tab instead of staying stuck.
        if (status === "Failed" && oldStatus !== "Failed") {
          const order = await db.getOrderById(account.orderId);
          if (order && order.status !== "Failed") {
            const prevOrderStatus = order.status;
            order.status = "Failed";
            order.updatedAt = new Date().toISOString();
            await db.saveOrder(order);

            await db.saveAuditLog({
              id: "log-" + Math.random().toString(36).substring(2, 11),
              userId: admin.id,
              userName: admin.name,
              targetId: order.id,
              targetType: "order",
              action: "order_status_update",
              description: `System updated Order ${order.id} status from "${prevOrderStatus}" to "Failed" because linked Account ${account.id} was marked Failed`,
              createdAt: new Date().toISOString(),
            });
          }
        }

        // Mistaken fail override restore correction logic
        if (status === "Active" && oldStatus === "Failed") {
          const order = await db.getOrderById(account.orderId);
          if (order) {
            const nextOrderStatus = getOrderStatusForPhase(account.phase);

            if (order.status !== nextOrderStatus) {
              const prevOrderStr = order.status;
              order.status = nextOrderStatus;
              order.updatedAt = new Date().toISOString();
              await db.saveOrder(order);

              await db.saveAuditLog({
                id: "log-" + Math.random().toString(36).substring(2, 11),
                userId: admin.id,
                userName: admin.name,
                targetId: order.id,
                targetType: "order",
                action: "order_status_update",
                description: `System restored Order ${order.id} status to "${nextOrderStatus}" (previously "${prevOrderStr}") due to account fail override correction`,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      }

      await db.saveAccount(account);
    }


    if (selectedInventoryItem && selectedInventoryItem.status === "available") {
      selectedInventoryItem.status = "delivered";
      selectedInventoryItem.orderId = account.orderId;
      await db.saveChallengeInventoryItem(selectedInventoryItem);
    }
    // Auto-progress order if account status is marked as Passed.
    // One Step and Instant plans have no Phase 2, so the next stage is Funded (Live).
    if (status === "Passed" && oldStatus !== "Passed") {
      const order = await db.getOrderById(account.orderId);
      if (order) {
        const plan = await db.getPlanById(order.planId);
        const nextPhase = getNextStagePhase(plan?.name, account.phase);

        if (nextPhase) {
          order.status = getOrderStatusForPhase(nextPhase);
          order.updatedAt = new Date().toISOString();
          await db.saveOrder(order);

          const accountsList = await db.getAccounts();
          const nextExists = accountsList.some((a) => a.orderId === order.id && a.phase === nextPhase);
          if (!nextExists) {
            const accountId = Math.floor(100000 + Math.random() * 900000).toString();
            const newAccount: DBTradingAccount = {
              id: accountId,
              userId: order.userId,
              orderId: order.id,
              platform: account.platform,
              login: accountId,
              passwordMaster: "GENERATED_MASTER_PASS",
              passwordInvestor: "GENERATED_INVEST_PASS",
              server: "Range4ex-PendingServer",
              profitTarget: getStageProfitTarget(plan?.name, nextPhase, plan?.size ?? account.balance),
              balance: account.balance,
              equity: account.balance,
              todayPl: 0,
              totalPl: 0,
              status: getStageAccountStatus(nextPhase),
              phase: nextPhase,
              graphLink: "",
              deliveryStatus: "pending",
              createdAt: new Date().toISOString(),
            };
            await db.saveAccount(newAccount);

            await db.saveNotification({
              id: "notif-" + Math.random().toString(36).substring(2, 11),
              userId: order.userId,
              title:
                nextPhase === PHASE_FUNDED
                  ? "Funded Account Ready for Delivery"
                  : "Phase 2 Account Ready for Delivery",
              message:
                nextPhase === PHASE_FUNDED
                  ? `Congratulations on passing ${account.phase}! Your Live Funded trading account is ready to be delivered by the administrator.`
                  : `Congratulations on passing Phase 1! Your Phase 2 Verification trading account is ready to be delivered by the administrator.`,
              type: "success",
              channel: "in_app",
              status: "sent",
              read: false,
              sentAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    // If simulating an objective pass, generate certificate and funded notifications for testing
    if (simulateObjectivePassed && status === "Passed") {
      const certId = "cert-" + Math.random().toString(36).substring(2, 7) + account.id.substring(2);
      const userObj = await db.getUserById(account.userId);
      await db.saveCertificate({
        id: certId,
        userId: account.userId,
        accountId: account.id,
        traderName: userObj ? userObj.name : "Alex Mercer",
        accountSize: account.balance,
        planName: account.phase || "Passed Phase 2 (Evaluation)",
        datePassed: new Date().toISOString()
      });

      // Send pass notification
      await db.saveNotification({
        id: "notif-" + Math.random().toString(36).substring(2, 11),
        userId: account.userId,
        title: "Evaluation Challenge Passed!",
        message: `Congratulations! You have passed your challenge on Account ${account.id}. A certificate has been generated and you are now funded!`,
        type: "success",
        channel: "in_app",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      });
    }

    // Trigger credential delivery notifications
    if (oldDeliveryStatus !== "delivered") {
      await db.saveNotification({
        id: "notif-" + Math.random().toString(36).substring(2, 11),
        userId: account.userId,
        title: "Trading Credentials Delivered",
        message: `Your account credentials have been delivered for Account ${login}. Platform: ${platform} | Server: ${server} | Master Pass: ${passwordMaster}. You can now log in to your trading platform.`,
        type: "success",
        channel: "email",
        status: "sent",
        read: false,
        sentAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, account });
  } catch (error: any) {
    console.error("Account PUT error:", error);
    if (error?.code === "23505") {
      return NextResponse.json(
        {
          error:
            "These platform credentials are already assigned to another trading account. Select a different inventory account.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Account ID is required." }, { status: 400 });
    }

    const account = await db.getAccountById(id);
    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    // Release the inventory credentials this account was holding so they can be re-delivered.
    try {
      const inventory = await db.getChallengeInventory();
      const heldItem = inventory.find(
        (item) =>
          item.status === "delivered" &&
          credentialKey(item.platform, item.server, item.login) ===
            credentialKey(account.platform, account.server, account.login),
      );
      if (heldItem) {
        heldItem.status = "available";
        heldItem.orderId = undefined;
        await db.saveChallengeInventoryItem(heldItem);
      }
    } catch (inventoryError) {
      console.warn("Inventory release skipped during account deletion:", inventoryError);
    }

    const deleted = await db.deleteAccount(id);
    if (!deleted) {
      return NextResponse.json({ error: "Account could not be deleted." }, { status: 500 });
    }

    // Roll the order back to the stage of the newest remaining account.
    if (account.orderId) {
      const order = await db.getOrderById(account.orderId);
      if (order) {
        const remaining = (await db.getAccounts()).filter((a) => a.orderId === order.id);
        const latest = remaining.length
          ? remaining.reduce((prev, current) =>
              getPhaseRank(prev.phase) >= getPhaseRank(current.phase) ? prev : current,
            )
          : undefined;
        const nextOrderStatus = latest ? getOrderStatusForPhase(latest.phase) : "Pending";
        if (order.status !== nextOrderStatus) {
          order.status = nextOrderStatus;
          order.updatedAt = new Date().toISOString();
          await db.saveOrder(order);
        }
      }
    }

    await db.saveAuditLog({
      id: "log-" + Math.random().toString(36).substring(2, 11),
      userId: admin.id,
      userName: admin.name,
      targetId: id,
      targetType: "account",
      action: "account_delete",
      description: `Admin deleted account request ${id} (Order: ${account.orderId || "none"}, Phase: ${account.phase || "unknown"}, Delivery: ${account.deliveryStatus})`,
      createdAt: new Date().toISOString(),
    });

    await db.saveNotification({
      id: "notif-" + Math.random().toString(36).substring(2, 11),
      userId: account.userId,
      title: "Trading Account Removed",
      message: `Account ${id} (${account.phase || "Unknown stage"}) has been removed by the administration team. Contact support if you believe this is incorrect.`,
      type: "warning",
      channel: "in_app",
      status: "sent",
      read: false,
      sentAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Account DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
