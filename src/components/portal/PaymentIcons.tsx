// Small inline badges for the payment-method picker: card networks / wallets and crypto coins.
// Inline SVG so checkout needs no external image requests.

type Badge = { title: string; svg: React.ReactNode };

const box = (title: string, bg: string, children: React.ReactNode, border = bg): Badge => ({
  title,
  svg: (
    <svg viewBox="0 0 38 24" width="38" height="24" role="img" aria-label={title}>
      <rect x="0.5" y="0.5" width="37" height="23" rx="3.5" fill={bg} stroke={border} />
      {children}
    </svg>
  ),
});

const CARD_BADGES: Record<string, Badge> = {
  visa: box("Visa", "#fff",
    <text x="19" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="11" fill="#1a1f71">VISA</text>, "#d9dce3"),
  mastercard: box("Mastercard", "#fff", (
    <>
      <circle cx="15" cy="12" r="7" fill="#eb001b" />
      <circle cx="23" cy="12" r="7" fill="#f79e1b" />
      <path d="M19 6.4a7 7 0 0 1 0 11.2 7 7 0 0 1 0-11.2z" fill="#ff5f00" />
    </>
  ), "#d9dce3"),
  amex: box("American Express", "#1f72cd",
    <text x="19" y="15.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="9" fill="#fff">AMEX</text>),
  applepay: box("Apple Pay", "#000", (
    <>
      <path d="M11.2 9.1c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.8.7 0 1.3-.3 1.7-.8zm.6 1c-.9-.1-1.7.5-2.2.5-.4 0-1.1-.5-1.9-.5-1 0-1.9.6-2.4 1.5-1 1.8-.3 4.4.7 5.8.5.7 1 1.5 1.8 1.4.7 0 1-.5 1.8-.5.9 0 1.1.5 1.9.5s1.3-.7 1.7-1.4c.5-.8.8-1.6.8-1.6s-1.5-.6-1.5-2.3c0-1.4 1.1-2.1 1.2-2.2-.7-1-1.7-1.1-2-1.2z" fill="#fff" />
      <text x="25" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="9" fill="#fff">Pay</text>
    </>
  )),
  googlepay: box("Google Pay", "#fff", (
    <>
      <text x="6" y="16.5" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="11">
        <tspan fill="#4285f4">G</tspan>
      </text>
      <text x="25" y="16" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="9" fill="#5f6368">Pay</text>
    </>
  ), "#d9dce3"),
  amazonpay: box("Amazon Pay", "#232f3e", (
    <>
      <text x="19" y="13" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="8" fill="#fff">amazon</text>
      <path d="M11 15.5q8 3.5 16 0" stroke="#ff9900" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <text x="19" y="21.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="5" fill="#ff9900">pay</text>
    </>
  )),
  paypal: box("PayPal", "#fff", (
    <text x="19" y="15.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="9">
      <tspan fill="#003087">Pay</tspan><tspan fill="#009cde">Pal</tspan>
    </text>
  ), "#d9dce3"),
};

const coin = (title: string, bg: string, children: React.ReactNode): Badge => ({
  title,
  svg: (
    <svg viewBox="0 0 24 24" width="24" height="24" role="img" aria-label={title}>
      <circle cx="12" cy="12" r="12" fill={bg} />
      {children}
    </svg>
  ),
});

const glyph = (char: string, size = 13) => (
  <text x="12" y="12" dy="0.35em" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize={size} fill="#fff">{char}</text>
);

const COIN_BADGES: Record<string, Badge> = {
  btc: coin("Bitcoin", "#f7931a", glyph("₿", 14)),
  eth: coin("Ethereum", "#627eea", (
    <>
      <path d="M12 4l-4.6 7.8L12 14.5l4.6-2.7z" fill="#fff" />
      <path d="M12 15.4l-4.6-2.7L12 20l4.6-7.3z" fill="#fff" fillOpacity="0.75" />
    </>
  )),
  usdt: coin("Tether (USDT)", "#26a17b", glyph("₮", 14)),
  usdc: coin("USD Coin", "#2775ca", glyph("$", 13)),
  bnb: coin("BNB", "#f3ba2f", <path d="M12 6l2 2-2 2-2-2zm-4 4l2 2-2 2-2-2zm8 0l2 2-2 2-2-2zm-4 4l2 2-2 2-2-2z" fill="#fff" />),
  sol: coin("Solana", "#000", (
    <>
      <path d="M8 8h9l-1.5 1.6H6.5z" fill="#14f195" />
      <path d="M6.5 11.2h9l1.5 1.6H8z" fill="#9945ff" />
      <path d="M8 14.4h9l-1.5 1.6H6.5z" fill="#14f195" />
    </>
  )),
  trx: coin("TRON", "#ef0027", <path d="M6.5 7l11 2.2-6.2 8.3zm1.4 1l3.3 7.7 1-6zm5.3 1.9l-1 6 4.1-5.4z" fill="#fff" />),
  ltc: coin("Litecoin", "#345d9d", glyph("Ł", 13)),
};

export const CARD_ICONS = ["visa", "mastercard", "amex", "applepay", "googlepay", "amazonpay"];
export const WHOP_ICONS = ["visa", "mastercard", "amex", "paypal", "applepay", "googlepay"];
export const CRYPTO_ICONS = ["btc", "eth", "usdt", "usdc", "bnb", "sol", "trx", "ltc"];

export function PaymentIcons({ icons }: { icons: string[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {icons.map((id) => {
        const badge = CARD_BADGES[id] ?? COIN_BADGES[id];
        return badge ? <span key={id} title={badge.title} className="inline-flex shrink-0">{badge.svg}</span> : null;
      })}
    </span>
  );
}
