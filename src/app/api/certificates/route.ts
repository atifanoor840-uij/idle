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
    const { searchParams } = new URL(request.url);
    const certId = searchParams.get("id");

    // PUBLIC VERIFICATION ROUTE - No authentication required if certificate ID is passed
    if (certId) {
      const cert = await db.getCertificateById(certId);
      if (!cert) {
        return NextResponse.json({ error: "Certificate not found or invalid." }, { status: 404 });
      }
      return NextResponse.json({ success: true, verified: true, certificate: cert });
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const myCerts = await db.getCertificatesByUserId(user.id);
    return NextResponse.json({ success: true, certificates: myCerts });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
