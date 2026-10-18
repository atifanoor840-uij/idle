import crypto from "crypto";
import { DBKyc } from "./db";

export type DiditLocalStatus = DBKyc["status"];

const APPROVED = new Set(["approved"]);
const PENDING = new Set(["not started", "in progress", "in review", "awaiting user", "resubmitted"]);
const REJECTED = new Set(["declined", "expired", "abandoned", "kyc expired"]);

function normalizeDiditStatus(status: unknown): string {
  return String(status || "Not Started")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
}

export function formatDiditStatus(status: unknown): string {
  const normalized = normalizeDiditStatus(status);
  if (!normalized) return "Not Started";
  return normalized
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function mapDiditStatus(status: unknown): DiditLocalStatus {
  const normalized = normalizeDiditStatus(status);
  if (APPROVED.has(normalized)) return "approved";
  if (REJECTED.has(normalized)) return "rejected";
  if (PENDING.has(normalized)) return "pending";
  return "pending";
}

export function getDiditRejectReason(payload: any, fallbackStatus: string): string {
  const warnings: string[] = [];
  const decision = payload?.decision || payload || {};
  const featureGroups = [
    "id_verifications",
    "nfc_verifications",
    "liveness_checks",
    "face_matches",
    "poa_verifications",
    "document_ai_documents",
    "phone_verifications",
    "email_verifications",
    "aml_screenings",
    "ip_analyses",
    "database_validations",
    "reviews",
  ];

  for (const group of featureGroups) {
    const entries = Array.isArray(decision[group]) ? decision[group] : [];
    for (const entry of entries) {
      if (entry?.status && mapDiditStatus(entry.status) === "rejected") {
        warnings.push(`${group.replace(/_/g, " ")}: ${formatDiditStatus(entry.status)}`);
      }
      if (Array.isArray(entry?.warnings)) {
        for (const warning of entry.warnings) {
          const detail = warning?.short_description || warning?.long_description || warning?.risk;
          if (detail) warnings.push(String(detail));
        }
      }
    }
  }

  return warnings[0] || `Didit automatic verification ended with status: ${fallbackStatus}.`;
}

function shortenFloats(data: any): any {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === "object") {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, shortenFloats(value)]));
  }
  if (typeof data === "number" && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

function sortKeys(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc: Record<string, any>, key) => {
        acc[key] = sortKeys(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

function timingSafeHexEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function timestampIsFresh(timestampHeader: string | null): boolean {
  if (!timestampHeader) return false;
  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - timestamp) <= 300;
}

export function verifyDiditWebhookSignature(body: any, headers: Headers, secret: string): boolean {
  const timestamp = headers.get("x-timestamp");
  if (!secret || !timestampIsFresh(timestamp)) return false;

  const signatureV2 = headers.get("x-signature-v2");
  if (signatureV2) {
    const canonical = JSON.stringify(sortKeys(shortenFloats(body)));
    const expected = crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
    if (timingSafeHexEqual(expected, signatureV2)) return true;
  }

  const signatureSimple = headers.get("x-signature-simple");
  if (signatureSimple) {
    const canonical = [body.timestamp ?? "", body.session_id ?? "", body.status ?? "", body.webhook_type ?? ""].join(":");
    const expected = crypto.createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
    if (timingSafeHexEqual(expected, signatureSimple)) return true;
  }

  return false;
}
