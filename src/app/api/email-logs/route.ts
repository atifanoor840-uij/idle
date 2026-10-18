import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

async function getSessionUser() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  return await db.getUserById(userId);
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userIdParam = searchParams.get("userId");

    if (user.role === "admin" || user.role === "support") {
      const [logs, users] = await Promise.all([
        userIdParam ? db.getEmailLogsByUserId(userIdParam) : db.getEmailLogs(),
        db.getUsers(),
      ]);
      const usersById = new Map(users.map((usr) => [usr.id, usr]));
      const enrichedLogs = logs.map((log) => {
        const u = usersById.get(log.userId);
        return {
          ...log,
          userName: u?.name || "Unknown User",
          userEmail: u?.email || log.toEmail,
        };
      });
      return NextResponse.json({ success: true, emailLogs: enrichedLogs });
    }

    const logs = await db.getEmailLogsByUserId(user.id);
    return NextResponse.json({ success: true, emailLogs: logs });
  } catch (error: any) {
    console.error("Email logs GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
