import crypto from "crypto";
import { db, type DBPixelEvent } from "./db";

export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || "1821879545473321";

export const META_CONVERSIONS_API_ACCESS_TOKEN =
  process.env.META_CONVERSIONS_API_ACCESS_TOKEN ||
  "EAAkcarrZAac0BSfLKtAASJBkBJMDBqdwbF7eulDb85jRkRMQoVPHPrg7SDNX4UTM61ebOkHEg5i4hrZCl9YPXCk2RfrZCsDrf7Psoc9pkZB9YubruWxW9WIcYRC3DRwVYQCHELtlZB1t43gjhdZAHubbNkAobYavzA6jw1vfSOpahZCuRa6HGxACj1YwwjXjgZDZD";

function hashData(data?: string): string | undefined {
  if (!data) return undefined;
  const trimmed = data.trim().toLowerCase();
  if (!trimmed) return undefined;
  return crypto.createHash("sha256").update(trimmed).digest("hex");
}

export type MetaConversionEventPayload = {
  eventName: string;
  eventId?: string;
  eventSourceUrl?: string;
  userData?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    clientIpAddress?: string;
    clientUserAgent?: string;
  };
  customData?: Record<string, unknown>;
  /** Optional context, only used to enrich the admin pixel-events log. */
  orderId?: string;
  userId?: string;
};

/** Best-effort: mirror every delivery attempt into the admin pixel-events log. */
async function logPixelEvent(
  payload: MetaConversionEventPayload,
  status: "sent" | "failed",
  errorMessage?: string,
): Promise<void> {
  try {
    const custom = payload.customData || {};
    const contentIds = Array.isArray(custom.content_ids)
      ? (custom.content_ids as unknown[]).join(",")
      : undefined;
    const row: DBPixelEvent = {
      id: `px-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventName: payload.eventName,
      eventId: payload.eventId,
      source: "capi",
      status,
      pixelId: META_PIXEL_ID,
      orderId: payload.orderId,
      userId: payload.userId,
      userEmail: payload.userData?.email,
      value:
        typeof custom.value === "number" ? (custom.value as number) : undefined,
      currency:
        typeof custom.currency === "string"
          ? (custom.currency as string)
          : undefined,
      contentName:
        typeof custom.content_name === "string"
          ? (custom.content_name as string)
          : undefined,
      contentIds,
      eventSourceUrl: payload.eventSourceUrl,
      error: errorMessage,
      createdAt: new Date().toISOString(),
    };
    await db.savePixelEvent(row);
  } catch (error) {
    console.warn("[Meta Conversions API] Failed to log pixel event:", error);
  }
}

/**
  * Sends a server-side conversion event to Meta Conversions API (CAPI).
  */
export async function sendMetaConversionEvent(
  payload: MetaConversionEventPayload,
): Promise<boolean> {
  const token = META_CONVERSIONS_API_ACCESS_TOKEN;
  const pixelId = META_PIXEL_ID;

  if (!token || !pixelId) {
    console.warn("[Meta Conversions API] Missing Pixel ID or Access Token.");
    await logPixelEvent(payload, "failed", "Missing Pixel ID or Access Token");
    return false;
  }

  const endpoint = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`;

  const eventData = {
    event_name: payload.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: payload.eventId,
    action_source: "website",
    event_source_url: payload.eventSourceUrl,
    user_data: {
      em: payload.userData?.email ? [hashData(payload.userData.email)] : undefined,
      ph: payload.userData?.phone ? [hashData(payload.userData.phone)] : undefined,
      fn: payload.userData?.firstName ? [hashData(payload.userData.firstName)] : undefined,
      ln: payload.userData?.lastName ? [hashData(payload.userData.lastName)] : undefined,
      client_ip_address: payload.userData?.clientIpAddress,
      client_user_agent: payload.userData?.clientUserAgent,
    },
    custom_data: payload.customData,
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [eventData] }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error("[Meta Conversions API] Error response:", result);
      await logPixelEvent(
        payload,
        "failed",
        typeof result?.error?.message === "string"
          ? result.error.message
          : `HTTP ${response.status}`,
      );
      return false;
    }

    await logPixelEvent(payload, "sent");
    return true;
  } catch (error) {
    console.error("[Meta Conversions API] Failed to send event:", error);
    await logPixelEvent(
      payload,
      "failed",
      error instanceof Error ? error.message : "Network error",
    );
    return false;
  }
}
