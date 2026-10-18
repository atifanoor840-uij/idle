// Direct wallet transfers ("Scan & Pay"): the trader sends crypto straight to
// one of these addresses, then submits the TXID + a screenshot for admin review.
// Addresses come only from NEXT_PUBLIC_WALLET_* env vars (no hard-coded fallbacks).
// A wallet with no address is hidden from checkout.

export type ManualWalletId = "USDT_BEP20" | "USDT_TRC20" | "USDT_POLYGON" | "USDT_ERC20" | "BTC" | "SOL";

export interface ManualWallet {
  id: ManualWalletId;
  /** Short label shown on the wallet button. */
  label: string;
  /** Network name shown next to the address — sending on the wrong chain loses funds. */
  network: string;
  asset: string;
  color: string;
  /** Official coin logo (public/crypto-icons, CC0 from cryptocurrency-icons). */
  logo: string;
  /** Chain logo shown as a badge / QR centre when the coin is a token on another chain. */
  networkLogo?: string;
  address: string;
}

// NEXT_PUBLIC_* values must be read with literal keys so Next inlines them on the client.
const ADDRESSES: Record<ManualWalletId, string> = {
  USDT_BEP20: process.env.NEXT_PUBLIC_WALLET_USDT_BEP20 || "",
  USDT_TRC20: process.env.NEXT_PUBLIC_WALLET_USDT_TRC20 || "",
  USDT_POLYGON: process.env.NEXT_PUBLIC_WALLET_USDT_POLYGON || "",
  USDT_ERC20: process.env.NEXT_PUBLIC_WALLET_USDT_ERC20 || "",
  BTC: process.env.NEXT_PUBLIC_WALLET_BTC || "",
  SOL: process.env.NEXT_PUBLIC_WALLET_SOL || "",
};

const WALLETS: Omit<ManualWallet, "address">[] = [
  { id: "USDT_BEP20", label: "USDT BEP20", network: "BNB Smart Chain (BEP20)", asset: "USDT", color: "#f3ba2f", logo: "/crypto-icons/usdt.svg", networkLogo: "/crypto-icons/bnb.svg" },
  { id: "USDT_TRC20", label: "USDT TRC20", network: "TRON (TRC20)", asset: "USDT", color: "#ef0027", logo: "/crypto-icons/usdt.svg", networkLogo: "/crypto-icons/trx.svg" },
  { id: "USDT_POLYGON", label: "USDT Polygon", network: "Polygon (POS)", asset: "USDT", color: "#8247e5", logo: "/crypto-icons/usdt.svg", networkLogo: "/crypto-icons/matic.svg" },
  { id: "USDT_ERC20", label: "USDT ERC20", network: "Ethereum (ERC20)", asset: "USDT", color: "#627eea", logo: "/crypto-icons/usdt.svg", networkLogo: "/crypto-icons/eth.svg" },
  { id: "BTC", label: "Bitcoin", network: "Bitcoin", asset: "BTC", color: "#f7931a", logo: "/crypto-icons/btc.svg" },
  { id: "SOL", label: "Solana", network: "Solana", asset: "SOL", color: "#14f195", logo: "/crypto-icons/sol.svg" },
];

export const MANUAL_WALLETS: ManualWallet[] = WALLETS.map((wallet) => ({
  ...wallet,
  address: ADDRESSES[wallet.id].trim(),
})).filter((wallet) => wallet.address);

export function getManualWallet(id: string | null | undefined): ManualWallet | undefined {
  return MANUAL_WALLETS.find((wallet) => wallet.id === id);
}

/** Stored as the order's paymentMethod. */
export const MANUAL_CRYPTO_PAYMENT_METHOD = "Crypto QR";

export function isManualCryptoMethod(method: unknown): boolean {
  return String(method || "").toLowerCase() === MANUAL_CRYPTO_PAYMENT_METHOD.toLowerCase();
}

/**
 * Proof is kept in the order's gatewayRef so no schema migration is needed:
 * `manual:<walletId>:<txid>:<storagePath>`. TX hashes and our storage paths never contain ":".
 */
export function buildManualGatewayRef(walletId: string, txid: string, proofPath: string) {
  return `manual:${walletId}:${txid}:${proofPath}`;
}

export function parseManualGatewayRef(gatewayRef: unknown) {
  const parts = String(gatewayRef || "").split(":");
  if (parts[0] !== "manual" || parts.length < 4) return null;
  return { walletId: parts[1], txid: parts[2], proofPath: parts.slice(3).join(":") };
}

// Hex hashes (EVM chains, TRON, Bitcoin) are 64 hex chars; the 0x prefix is optional.
const HEX_TXID = /^(0x)?[0-9a-fA-F]{64}$/;
// Solana signatures are base58, usually 87-88 chars.
const SOLANA_TXID = /^[1-9A-HJ-NP-Za-km-z]{80,90}$/;

/** Returns an error message for a bad TXID on the given wallet's network, or "" when it looks valid. */
export function getTxidError(walletId: string, txid: string): string {
  const value = txid.trim();
  if (!value) return "Enter the transaction ID (TXID / hash).";
  if (walletId === "SOL") {
    return SOLANA_TXID.test(value) ? "" : "A Solana transaction signature is 87–88 letters and numbers.";
  }
  if (HEX_TXID.test(value)) return "";
  const example = walletId.startsWith("USDT_") && walletId !== "USDT_TRC20" ? "0x followed by 64 characters (0-9, a-f)" : "64 characters (0-9, a-f)";
  return `Invalid transaction ID. It should be ${example}.`;
}
