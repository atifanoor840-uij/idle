import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";

export async function getAdmin() {
  const cookieStore = await cookies();
  const userId = readSessionUserId(cookieStore);
  if (!userId) return null;
  const user = await db.getUserById(userId);
  return user?.role === "admin" ? user : null;
}

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
