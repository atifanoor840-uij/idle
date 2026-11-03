import { NextResponse } from "next/server";
import { detectCountry } from "@/lib/geo";
import { isNowPaymentsConfigured, isWhopConfigured } from "@/config/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reports the visitor's country so the client can hide region-restricted
// options. Card / digital-wallet (Paddle) checkout is not offered to visitors
// in Pakistan; crypto stays available everywhere.
export async function GET(request: Request) {
  const geo = await detectCountry(request);

  return NextResponse.json(
    {
      success: true,
      country: geo.country,
      isPakistan: geo.isPakistan,
      cardPaymentAvailable: !geo.isPakistan,
      cryptoGatewayAvailable: isNowPaymentsConfigured(),
      whopAvailable: isWhopConfigured(),
      source: geo.source,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
