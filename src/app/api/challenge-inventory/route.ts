import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBChallengeInventoryItem } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}


function credentialKey(platform: unknown, server: unknown, login: unknown) {
  return [platform, server, login]
    .map((value) => String(value || "").trim().toLowerCase())
    .join("|");
}
// Only plain http(s) URLs are accepted: the link is rendered as an <a href>.
function normalizeGraphLink(value: unknown): string | null {
  const link = String(value ?? "").trim();
  if (!link) return "";
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:" ? link : null;
  } catch {
    return null;
  }
}
const INVALID_GRAPH_LINK = "Graph link must be a full http(s) URL.";

function inventoryTableMissing(error: any) {
  return error?.code === "PGRST205" || error?.code === "42P01" || String(error?.message || "").includes("challenge_inventory");
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const items = await db.getChallengeInventory();
    return NextResponse.json({ success: true, plans: items });
  } catch (error: any) {
    console.error("GET /api/challenge-inventory error:", error);
    if (inventoryTableMissing(error)) {
      return NextResponse.json({ success: true, plans: [] });
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { platform, size, login, password, server, externalStatisticsId } = body;

    if (!platform || !size || !login || !password || !server) {
      return NextResponse.json({ error: "Platform, account size, platform login, password, and server are required." }, { status: 400 });
    }
    const graphLink = normalizeGraphLink(body.graphLink);
    if (graphLink === null) {
      return NextResponse.json({ error: INVALID_GRAPH_LINK }, { status: 400 });
    }


    const duplicateInventoryItem = (await db.getChallengeInventory()).find(
      (candidate) =>
        credentialKey(candidate.platform, candidate.server, candidate.login) ===
        credentialKey(platform, server, login),
    );
    if (duplicateInventoryItem) {
      return NextResponse.json(
        { error: "Those inventory credentials already exist." },
        { status: 409 },
      );
    }
    const item: DBChallengeInventoryItem = {
      id: "inv-" + platform.toLowerCase().replace(/[^a-z0-9]/g, "") + "-" + String(login).replace(/[^a-z0-9]/gi, ""),
      platform,
      size: Number(size),
      login,
      password,
      server,
      externalStatisticsId: externalStatisticsId || "",
      ...(graphLink ? { graphLink } : {}),
      status: "available",
      orderId: "",
      createdAt: new Date().toISOString(),
    };

    await db.saveChallengeInventoryItem(item);
    return NextResponse.json({ success: true, plan: item });
  } catch (error: any) {
    console.error("POST /api/challenge-inventory error:", error);
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Those inventory credentials already exist." }, { status: 409 });
    }
    if (inventoryTableMissing(error)) {
      return NextResponse.json(
        { error: "Challenge inventory table does not exist. Apply src/lib/challenge_inventory_migration.sql in Supabase." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, platform, size, login, password, server, externalStatisticsId, status, orderId } = body;
    const graphLink =
      body.graphLink === undefined ? undefined : normalizeGraphLink(body.graphLink);
    if (graphLink === null) {
      return NextResponse.json({ error: INVALID_GRAPH_LINK }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: "Inventory item ID is required." }, { status: 400 });
    }

    const item = await db.getChallengeInventoryById(id);
    if (!item) {
      return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
    }
    const assignedAccounts = (await db.getAccounts()).filter(
      (account) =>
        account.deliveryStatus === "delivered" &&
        credentialKey(account.platform, account.server, account.login) ===
          credentialKey(item.platform, item.server, item.login),
    );
    const credentialsAreAssigned = assignedAccounts.length > 0;
    const credentialsAreChanging =
      platform !== undefined || login !== undefined || server !== undefined;

    if (
      credentialsAreAssigned &&
      (status === "available" || credentialsAreChanging)
    ) {
      return NextResponse.json(
        {
          error:
            "Delivered inventory credentials cannot be reopened or changed while assigned to a trader account.",
        },
        { status: 409 },
      );
    }


    const nextCredentialKey = credentialKey(
      platform ?? item.platform,
      server ?? item.server,
      login ?? item.login,
    );
    const duplicateInventoryItem = (await db.getChallengeInventory()).find(
      (candidate) =>
        candidate.id !== item.id &&
        credentialKey(candidate.platform, candidate.server, candidate.login) ===
          nextCredentialKey,
    );
    if (duplicateInventoryItem) {
      return NextResponse.json(
        { error: "Those inventory credentials already exist." },
        { status: 409 },
      );
    }
    if (platform !== undefined) item.platform = platform;
    if (size !== undefined) item.size = Number(size);
    if (login !== undefined) item.login = login;
    if (password !== undefined) item.password = password;
    if (server !== undefined) item.server = server;
    if (externalStatisticsId !== undefined) item.externalStatisticsId = externalStatisticsId;
    if (graphLink !== undefined) item.graphLink = graphLink;
    if (status !== undefined) item.status = status;
    if (orderId !== undefined) item.orderId = orderId;

    await db.saveChallengeInventoryItem(item);

    // Graph details edited on a delivered container follow it to the trader's
    // account, so the trader and admin always see the same graph.
    if (graphLink !== undefined || externalStatisticsId !== undefined) {
      for (const account of assignedAccounts) {
        await db.saveAccount({
          ...account,
          ...(graphLink !== undefined ? { graphLink } : {}),
          ...(externalStatisticsId !== undefined ? { externalStatisticsId } : {}),
        });
      }
    }
    return NextResponse.json({ success: true, plan: item });
  } catch (error: any) {
    console.error("PUT /api/challenge-inventory error:", error);
    if (error?.code === "23505") {
      return NextResponse.json({ error: "Those inventory credentials already exist." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Inventory item ID is required." }, { status: 400 });
    }

    const item = await db.getChallengeInventoryById(id);
    if (!item) {
      return NextResponse.json({ error: "Inventory item not found." }, { status: 404 });
    }
    if (item.status === "delivered") {
      return NextResponse.json(
        { error: "Delivered inventory credentials cannot be deleted." },
        { status: 409 },
      );
    }
    const deleted = await db.deleteChallengeInventoryItem(id);
    if (!deleted) {
      return NextResponse.json({ error: "Inventory item not found or could not be deleted." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/challenge-inventory error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}


