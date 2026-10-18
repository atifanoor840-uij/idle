import { DBTradingAccount } from "./db";

export interface AccountLike {
  id: string;
  status: string;
  phase?: string;
  type?: string;
  deliveryStatus?: "pending" | "delivered" | string;
}

/**
 * Determines whether a specific trading account makes a user eligible for KYC verification.
 * An account qualifies if:
 * 1. It is delivered (deliveryStatus === "delivered" or omitted on legacy records).
 * 2. Its status is active/passed/funded (status !== "Failed").
 * 3. It is a Funded Account, Instant Account, or Funded Phase Account.
 */
export function isKycEligibleAccount(account: AccountLike | DBTradingAccount): boolean {
  if (!account) return false;

  // 1. Check delivery status (must be delivered, or undefined for legacy/mock objects)
  const isDelivered = account.deliveryStatus === "delivered" || account.deliveryStatus === undefined;
  if (!isDelivered) return false;

  // 2. Check account status (must be Active, Funded, or Passed; not Failed)
  const statusUpper = (account.status || "").toUpperCase();
  if (statusUpper === "FAILED") return false;

  const phaseLower = (account.phase || "").toLowerCase();
  const typeLower = ((account as any).type || "").toLowerCase();

  // 3. Qualifying criteria:
  // - Status is Funded
  // - Phase or type contains "funded" (e.g. "Funded (Live)", "Funded Phase", "Funded")
  // - Phase or type contains "instant" (e.g. "Instant", "Instant Funded")
  const isFunded = statusUpper === "FUNDED" || phaseLower.includes("funded") || typeLower.includes("funded");
  const isInstant = phaseLower.includes("instant") || typeLower.includes("instant");

  return isFunded || isInstant;
}

/**
 * Checks whether a collection of user accounts contains at least one account eligible for KYC.
 */
export function userIsKycEligible(accounts: (AccountLike | DBTradingAccount)[]): boolean {
  if (!Array.isArray(accounts) || accounts.length === 0) return false;
  return accounts.some(isKycEligibleAccount);
}
