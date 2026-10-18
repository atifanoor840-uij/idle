import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("prop_session");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Sign-out API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
