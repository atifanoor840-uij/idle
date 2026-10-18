import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, checkUserPassword } from "@/lib/db";
import { signSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });

    const user = await db.getUserByEmail(String(email).trim().toLowerCase());
    if (!user || user.role !== "collaborator" || !(await checkUserPassword(user, password))) {
      return NextResponse.json({ error: "Invalid collaborator credentials." }, { status: 400 });
    }
    if (user.status !== "active") return NextResponse.json({ error: "This collaborator account is not active." }, { status: 403 });
    if (!await db.getCollaboratorByUserId(user.id)) return NextResponse.json({ error: "Collaborator profile is unavailable." }, { status: 403 });

    const cookieStore = await cookies();
    cookieStore.set("prop_session", signSession(user.id), { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7, sameSite: "lax" });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unable to sign in." }, { status: 500 });
  }
}
