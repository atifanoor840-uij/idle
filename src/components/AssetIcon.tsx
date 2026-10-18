import React from "react";
import { AU, CA, CH, DE, EU, GB, JP, NZ, US } from "country-flag-icons/react/1x1";
import { GiGoldBar } from "react-icons/gi";
import { SiBitcoin, SiEthereum } from "react-icons/si";
import { TbChartCandle } from "react-icons/tb";

const FLAG_MAP: Record<string, React.ComponentType<{ title?: string; className?: string; style?: React.CSSProperties }>> = {
  EUR: EU,
  USD: US,
  GBP: GB,
  JPY: JP,
  AUD: AU,
  CAD: CA,
  CHF: CH,
  NZD: NZ,
  GER: DE,
  DE: DE,
  US: US,
};

function CircleFlag({ code, size }: { code: string; size: number }) {
  const Flag = FLAG_MAP[code];
  if (!Flag) return null;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 0 0 1.5px rgba(0,0,0,0.45)",
        flexShrink: 0,
      }}
    >
      <Flag title={code} className="asset-flag-svg" style={{ width: "100%", height: "100%", display: "block" }} />
    </span>
  );
}

export function AssetIcon({
  symbol,
  size = 24,
  className = "",
}: {
  symbol: string;
  size?: number;
  className?: string;
}) {
  const clean = symbol.trim().toUpperCase().split(/\s+/)[0];
  const subSize = Math.round(size * 0.68);
  const pairSize = Math.round(size * 0.82);

  // Single 3-letter currency (e.g. Economic Calendar: USD, EUR, GBP, JPY, AUD)
  if (clean.length === 3 && FLAG_MAP[clean]) {
    return (
      <span
        className={`asset-icon-wrap ${className}`}
        style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
      >
        <CircleFlag code={clean} size={size} />
      </span>
    );
  }

  // Gold / Silver vs USD (XAUUSD, XAGUSD)
  if (clean.startsWith("XAU") || clean.startsWith("XAG")) {
    const isGold = clean.startsWith("XAU");
    const quote = clean.slice(3, 6) || "USD";
    return (
      <span
        className={`asset-icon-pair ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          position: "relative",
          width: Math.round(size * 1.35),
          height: size,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: pairSize,
            height: pairSize,
            borderRadius: "50%",
            background: isGold
              ? "linear-gradient(135deg, #FFE066 0%, #F59F00 55%, #B45309 100%)"
              : "linear-gradient(135deg, #F1F5F9 0%, #94A3B8 55%, #475569 100%)",
            color: "#111",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 1.5px rgba(0,0,0,0.45)",
            zIndex: 2,
          }}
          title={isGold ? "Gold (XAU)" : "Silver (XAG)"}
        >
          <GiGoldBar size={Math.round(pairSize * 0.62)} />
        </span>
        {FLAG_MAP[quote] && (
          <span style={{ position: "absolute", right: 0, bottom: 0, zIndex: 1 }}>
            <CircleFlag code={quote} size={subSize} />
          </span>
        )}
      </span>
    );
  }

  // Crypto pairs (BTCUSD, ETHUSD)
  if (clean.startsWith("BTC") || clean.startsWith("ETH")) {
    const isBtc = clean.startsWith("BTC");
    const quote = clean.slice(3, 6) || "USD";
    const Icon = isBtc ? SiBitcoin : SiEthereum;
    return (
      <span
        className={`asset-icon-pair ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          position: "relative",
          width: Math.round(size * 1.35),
          height: size,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: pairSize,
            height: pairSize,
            borderRadius: "50%",
            background: isBtc ? "#F7931A" : "#627EEA",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 1.5px rgba(0,0,0,0.45)",
            zIndex: 2,
          }}
          title={isBtc ? "Bitcoin" : "Ethereum"}
        >
          <Icon size={Math.round(pairSize * 0.62)} />
        </span>
        {FLAG_MAP[quote] && (
          <span style={{ position: "absolute", right: 0, bottom: 0, zIndex: 1 }}>
            <CircleFlag code={quote} size={subSize} />
          </span>
        )}
      </span>
    );
  }

  // Indices (NAS100, US30, GER40)
  if (clean === "NAS100" || clean === "US30" || clean === "GER40") {
    const flagCode = clean === "GER40" ? "DE" : "US";
    const badgeText = clean === "NAS100" ? "100" : clean === "US30" ? "30" : "40";
    const bg =
      clean === "NAS100"
        ? "linear-gradient(135deg, #0EA5E9 0%, #0369A1 100%)"
        : clean === "US30"
          ? "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)"
          : "linear-gradient(135deg, #EAB308 0%, #CA8A04 100%)";
    return (
      <span
        className={`asset-icon-pair ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          position: "relative",
          width: Math.round(size * 1.35),
          height: size,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            width: pairSize,
            height: pairSize,
            borderRadius: "50%",
            background: bg,
            color: "#fff",
            fontSize: Math.max(8, Math.round(pairSize * 0.42)),
            fontWeight: 800,
            letterSpacing: "-0.03em",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 1.5px rgba(0,0,0,0.45)",
            zIndex: 2,
          }}
          title={clean}
        >
          {badgeText}
        </span>
        <span style={{ position: "absolute", right: 0, bottom: 0, zIndex: 1 }}>
          <CircleFlag code={flagCode} size={subSize} />
        </span>
      </span>
    );
  }

  // Standard 6-letter Forex pair (e.g. EURUSD, GBPUSD, USDJPY, AUDUSD)
  if (clean.length === 6) {
    const base = clean.slice(0, 3);
    const quote = clean.slice(3, 6);
    if (FLAG_MAP[base] && FLAG_MAP[quote]) {
      return (
        <span
          className={`asset-icon-pair ${className}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            position: "relative",
            width: Math.round(size * 1.35),
            height: size,
            flexShrink: 0,
          }}
        >
          <span style={{ position: "relative", zIndex: 2, display: "inline-flex" }}>
            <CircleFlag code={base} size={pairSize} />
          </span>
          <span style={{ position: "absolute", right: 0, bottom: 0, zIndex: 1, display: "inline-flex" }}>
            <CircleFlag code={quote} size={pairSize} />
          </span>
        </span>
      );
    }
  }

  // Fallback icon
  return (
    <span
      className={`asset-icon-wrap ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(52, 232, 52, 0.16)",
        color: "#34E834",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <TbChartCandle size={Math.round(size * 0.65)} />
    </span>
  );
}
export default AssetIcon;
