import { NextResponse } from "next/server";
import { sendMetaConversionEvent } from "@/lib/metaConversionsApi";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.eventName) {
      return NextResponse.json(
        { error: "eventName is required." },
        { status: 400 },
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      undefined;
    const clientUserAgent = request.headers.get("user-agent") || undefined;

    const success = await sendMetaConversionEvent({
      eventName: body.eventName,
      eventId: body.eventId,
      eventSourceUrl:
        body.eventSourceUrl || request.headers.get("referer") || undefined,
      userData: {
        email: body.email,
        phone: body.phone,
        firstName: body.firstName,
        lastName: body.lastName,
        clientIpAddress: clientIp,
        clientUserAgent: clientUserAgent,
      },
      customData: body.customData,
    });

    return NextResponse.json({ success });
  } catch (error: any) {
    console.error("[Meta Conversions API Route Error]:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
