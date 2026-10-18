import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, DBCollaboratorSale, DBUser, hashPassword } from "@/lib/db";
import { COLLABORATOR_COMMISSION_RATE } from "@/lib/collaborators";
import { readSessionUserId } from "@/lib/session";

async function sessionUser() {
  const id = readSessionUserId((await cookies()));
  return id ? db.getUserById(id) : undefined;
}

function metrics(sales: DBCollaboratorSale[], registrations: number) {
  return {
    registrations,
    totalSales: sales.reduce((sum, sale) => sum + Number(sale.saleAmount), 0),
    commissions: sales.reduce((sum, sale) => sum + Number(sale.commissionAmount), 0),
    paidCommissions: sales.filter((sale) => sale.status === "paid").reduce((sum, sale) => sum + Number(sale.commissionAmount), 0),
  };
}

export async function GET() {
  try {
    const user = await sessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [collaborators, attributions, sales, users] = await Promise.all([
      db.getCollaborators(),
      db.getCollaboratorAttributions(),
      db.getCollaboratorSales(),
      db.getUsers(),
    ]);

    if (user.role === "admin") {
      const result = collaborators.map((collaborator) => {
        const collaboratorSales = sales.filter((sale) => sale.collaboratorId === collaborator.userId);
        const registrations = attributions.filter((attribution) => attribution.collaboratorId === collaborator.userId).length;
        const collaboratorUser = users.find((candidate) => candidate.id === collaborator.userId);
        return { ...collaborator, name: collaboratorUser?.name || "Unknown", email: collaboratorUser?.email || "", metrics: metrics(collaboratorSales, registrations), sales: collaboratorSales };
      });
      return NextResponse.json({ success: true, collaborators: result, sales });
    }

    if (user.role !== "collaborator") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const collaborator = collaborators.find((item) => item.userId === user.id);
    if (!collaborator) return NextResponse.json({ error: "Collaborator profile not found" }, { status: 404 });
    const collaboratorSales = sales.filter((sale) => sale.collaboratorId === user.id);
    const registrations = attributions.filter((attribution) => attribution.collaboratorId === user.id).length;
    return NextResponse.json({ success: true, collaborator, metrics: metrics(collaboratorSales, registrations), sales: collaboratorSales });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to load collaborator data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await sessionUser();
    if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Only admins can create collaborator accounts." }, { status: 403 });
    const { name, email, password, referralCode } = await request.json();
    if (!name || !email || !password) return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    if (await db.getUserByEmail(String(email).trim().toLowerCase())) return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
    const code = String(referralCode || name).replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 12) || `COL${Date.now().toString().slice(-6)}`;
    if (await db.getCollaboratorByCode(code)) return NextResponse.json({ error: "That collaborator code is already in use." }, { status: 400 });
    const userId = `u-col-${Math.random().toString(36).slice(2, 11)}`;
    const collaboratorUser: DBUser = { id: userId, name, email: String(email).trim().toLowerCase(), phone: "", country: "", passwordHash: await hashPassword(password), role: "collaborator", status: "active", emailVerified: true, createdAt: new Date().toISOString() };
    await db.saveUser(collaboratorUser);
    await db.saveCollaborator({ userId, referralCode: code, commissionRate: COLLABORATOR_COMMISSION_RATE, createdAt: new Date().toISOString() });
    return NextResponse.json({ success: true, collaborator: { userId, name, email: collaboratorUser.email, referralCode: code, commissionRate: COLLABORATOR_COMMISSION_RATE } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to create collaborator." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const admin = await sessionUser();
  if (!admin || admin.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { referredUserId, orderId, status } = await request.json();
  if (!referredUserId || !orderId || !["pending", "approved", "paid"].includes(status)) return NextResponse.json({ error: "Invalid payout update." }, { status: 400 });
  const updated = await db.updateCollaboratorSaleStatus(referredUserId, orderId, status);
  return NextResponse.json({ success: updated });
}
