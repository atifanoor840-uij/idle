// Signed session cookie for `prop_session`.
// Value format: v1.<base64url(userId)>.<expiresAtSeconds>.<base64url(HMAC-SHA256)>
// The old format (raw user id) fails verification, so anyone holding one is simply signed out.
import crypto from "crypto";

export const SESSION_COOKIE = "prop_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matches cookie maxAge

function secret(): Buffer {
  const value = process.env.SESSION_SECRET;
  // Fail closed: without a strong secret nobody can be authenticated.
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters.");
  }
  return Buffer.from(value, "utf8");
}

function mac(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload, "utf8").digest("base64url");
}

export function signSession(userId: string, maxAgeSeconds = SESSION_MAX_AGE): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = `v1.${Buffer.from(userId, "utf8").toString("base64url")}.${exp}`;
  return `${payload}.${mac(payload)}`;
}

export function verifySession(token: string | undefined | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const payload = parts.slice(0, 3).join(".");
  const given = Buffer.from(parts[3], "utf8");
  const expected = Buffer.from(mac(payload), "utf8");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  if (Number(parts[2]) * 1000 < Date.now()) return null;
  const userId = Buffer.from(parts[1], "base64url").toString("utf8");
  return userId || null;
}

/** Reads and verifies the session from a Next.js cookie store; null when absent, forged or expired. */
export function readSessionUserId(store: { get(name: string): { value: string } | undefined }): string | null {
  return verifySession(store.get(SESSION_COOKIE)?.value);
}
