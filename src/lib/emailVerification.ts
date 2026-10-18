import crypto from "crypto";
import { supabase } from "./supabaseClient";
import { APP_URL } from "@/lib/brand";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createEmailVerificationToken(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const { error: deleteError } = await supabase
    .from("email_verification_tokens")
    .delete()
    .eq("userId", userId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from("email_verification_tokens")
    .insert({ tokenHash: hashToken(token), userId, expiresAt });
  if (insertError) throw insertError;

  return { token, expiresAt };
}

export type VerificationResult =
  | { status: "verified"; user: { id: string; name: string; email: string } }
  | { status: "invalid" | "expired" };

export async function consumeEmailVerificationToken(
  token: string,
): Promise<VerificationResult> {
  if (!/^[a-f0-9]{64}$/i.test(token)) return { status: "invalid" };

  // Delete-and-return makes the link one-time use, including concurrent clicks.
  const { data: record, error: tokenError } = await supabase
    .from("email_verification_tokens")
    .delete()
    .eq("tokenHash", hashToken(token))
    .select("userId,expiresAt")
    .maybeSingle();

  if (tokenError) throw tokenError;
  if (!record) return { status: "invalid" };
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    return { status: "expired" };
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .update({ emailVerified: true, emailVerifiedAt: new Date().toISOString() })
    .eq("id", record.userId)
    .select("id,name,email")
    .single();
  if (userError) throw userError;

  await supabase
    .from("email_verification_tokens")
    .delete()
    .eq("userId", record.userId);

  return { status: "verified", user };
}

export function getVerificationUrl(
  request: Request,
  token: string,
  locale: string,
  email?: string,
) {
  const url = new URL("/api/auth/verify-email", APP_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("locale", locale);
  if (email) url.searchParams.set("email", email);
  return url.toString();
}
