import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userId = readSessionUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.getUserById(userId);
    if (!user) {
      // Clear cookie if user is not in database
      cookieStore.delete("prop_session");
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const { passwordHash, ...userResponse } = user;
    return NextResponse.json({ success: true, user: userResponse });
  } catch (error: any) {
    console.error("Auth me API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Self-service profile update. Only name/phone/country are writable here;
// role and status changes go through the admin-only PUT /api/users.
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    let userId = readSessionUserId(cookieStore);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, country } = body;

    const user = await db.getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (typeof name === "string" && name.trim()) user.name = name.trim().slice(0, 120);
    if (typeof phone === "string") user.phone = phone.trim().slice(0, 40);
    if (typeof country === "string" && country.trim()) user.country = country.trim().slice(0, 80);

    await db.saveUser(user);

    const { passwordHash, ...userResponse } = user;
    return NextResponse.json({ success: true, user: userResponse });
  } catch (error: any) {
    console.error("Auth update API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
