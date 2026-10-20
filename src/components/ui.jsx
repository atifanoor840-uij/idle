import { Fragment } from "react";
import { AssetIcon } from "./AssetIcon";

/* "Trade **Our Capital**\nKeep" → mixed-weight text with line breaks */
export function Rich({ text }) {
  return text.split("\n").map((line, li, lines) => (
    <Fragment key={li}>
      {line.split("**").map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>))}
      {li < lines.length - 1 && <br />}
    </Fragment>
  ));
}

export function Checklist({ items, bold = false, className = "" }) {
  return (
    <ul className={`checklist ${bold ? "bold" : ""} ${className}`}>
      {items.map((it) => (
        <li key={it}>
          <span className="check" aria-hidden="true" />
          {it}
        </li>
      ))}
    </ul>
  );
}

export function LogoMark({ className = "logo-mark" }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" fill="none">
      <rect width="40" height="40" rx="9" fill="#0a0910" />
      <rect x="18.5" y="4" width="3" height="32" rx="1.5" fill="#2efb0a" />
      <rect x="14" y="10" width="12" height="20" rx="2" fill="#2efb0a" />
    </svg>
  );
}

/* Deterministic PRNG so server and client render identical charts */
function rng(seed) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const r1 = (n) => Math.round(n * 10) / 10;

function makeCandles(seed, count, h, trend) {
  const r = rng(seed);
  const out = [];
  let p = h * 0.65;
  for (let i = 0; i < count; i++) {
    const target = h * 0.7 - (i / count) * h * trend;
    const o = p;
    const c = o + (r() - 0.5) * h * 0.09 + (target - o) * 0.12;
    const hi = Math.min(o, c) - r() * h * 0.04;
    const lo = Math.max(o, c) + r() * h * 0.04;
    out.push({ o: r1(o), c: r1(c), hi: r1(hi), lo: r1(lo) });
    p = c;
  }
  return out;
}

export function Candles({ seed = 3, count = 40, w = 800, h = 300, trend = 0.4, mono = false, line = true, className = "" }) {
  const data = makeCandles(seed, count, h, trend);
  const step = w / count;
  const bw = step * 0.55;
  const pts = data.map((d, i) => `${r1(i * step + step / 2)},${d.c}`).join(" ");
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {data.map((d, i) => {
        const x = r1(i * step + step / 2);
        const up = d.c <= d.o;
        const fill = mono ? "#34E834" : up ? "#34E834" : "#F65144";
        return (
          <g key={i} opacity={mono && !up ? 0.45 : 1}>
            <line x1={x} x2={x} y1={d.hi} y2={d.lo} stroke={fill} strokeWidth="1.2" />
            <rect x={r1(x - bw / 2)} y={Math.min(d.o, d.c)} width={r1(bw)} height={Math.max(1, r1(Math.abs(d.c - d.o)))} fill={fill} />
          </g>
        );
      })}
      {line && <polyline points={pts} fill="none" stroke="#34E834" strokeWidth="1.5" opacity=".55" />}
    </svg>
  );
}

export function Spark({ seed = 5, w = 200, h = 60, className = "", color = "#34E834" }) {
  const data = makeCandles(seed, 30, h, 0.5);
  const step = w / 29;
  const pts = data.map((d, i) => `${r1(i * step)},${d.c}`).join(" ");
  return (
    <svg className={className} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sg${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={`url(#sg${seed})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

/* Dim green trading-chart background for dark bands */
export function ChartBg({ seed = 7, className = "" }) {
  return (
    <div className={`chart-bg ${className}`} aria-hidden="true">
      <Candles seed={seed} count={44} w={900} h={400} trend={0.45} mono className="chart-bg-svg" />
    </div>
  );
}

/* ── Device mockups ───────────────────────────── */

export function PhoneScreen({ variant = "account" }) {
  if (variant === "quotes") {
    const rows = [
      ["EURUSD", "1.08452", "+0.12%", true],
      ["XAUUSD", "2405.12", "+0.48%", true],
      ["GBPUSD", "1.27118", "-0.07%", false],
      ["NAS100", "18245.3", "+0.31%", true],
      ["USDJPY", "151.842", "-0.15%", false],
    ];
    return (
      <div className="ps">
        <div className="ps-title">Watchlist</div>
        {rows.map(([s, p, c, up]) => (
          <div className="ps-row" key={s}>
            <span className="ps-sym">
              <AssetIcon symbol={s} size={14} />
              <span>{s}</span>
            </span>
            <span className="ps-price">{p}</span>
            <span className={up ? "up" : "down"}>{c}</span>
          </div>
        ))}
        <Spark seed={11} className="ps-spark" />
      </div>
    );
  }
  return (
    <div className="ps">
      <div className="ps-label">Funded account · $100K</div>
      <div className="ps-balance">$108,240.50</div>
      <div className="ps-gain up">+$8,240.50 (8.24%)</div>
      <Spark seed={variant === "alt" ? 21 : 5} className="ps-spark" />
      <div className="ps-bar">
        <span>Profit target</span>
        <span>82%</span>
      </div>
      <div className="ps-progress">
        <i style={{ width: "82%" }} />
      </div>
      <div className="ps-row">
        <span className="ps-sym">
          <AssetIcon symbol="EURUSD" size={14} />
          <span>EURUSD Buy</span>
        </span>
        <span className="up">+$420.00</span>
      </div>
      <div className="ps-row">
        <span className="ps-sym">
          <AssetIcon symbol="XAUUSD" size={14} />
          <span>XAUUSD Sell</span>
        </span>
        <span className="down">-$118.40</span>
      </div>
      <div className="ps-row">
        <span className="ps-sym">
          <AssetIcon symbol="NAS100" size={14} />
          <span>NAS100 Buy</span>
        </span>
        <span className="up">+$1,032.10</span>
      </div>
    </div>
  );
}

export function Phone({ variant, className = "" }) {
  return (
    <div className={`phone ${className}`}>
      <div className="phone-notch" />
      <div className="phone-screen">
        <PhoneScreen variant={variant} />
      </div>
    </div>
  );
}

function Terminal({ seed = 3 }) {
  return (
    <div className="term">
      <div className="term-top">
        <span className="term-dot" />
        <span className="term-dot" />
        <span className="term-dot" />
        <span className="term-sym">
          <AssetIcon symbol="XAUUSD" size={13} />
          <span>XAUUSD · H1</span>
        </span>
        <span className="term-px up">2405.12</span>
      </div>
      <div className="term-body">
        <Candles seed={seed} count={36} w={600} h={260} trend={0.5} className="term-chart" />
        <div className="term-side">
          {["EURUSD", "GBPUSD", "XAUUSD", "US30", "BTCUSD"].map((s, i) => (
            <div key={s} className="term-row">
              <span className="ps-sym">
                <AssetIcon symbol={s} size={11} />
                <span>{s}</span>
              </span>
              <span className={i % 3 === 2 ? "down" : "up"}>{i % 3 === 2 ? "-" : "+"}0.{i + 1}4%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Laptop({ seed, className = "" }) {
  return (
    <div className={`laptop ${className}`}>
      <div className="laptop-screen">
        <Terminal seed={seed} />
      </div>
      <div className="laptop-base" />
    </div>
  );
}

export function Monitor({ seed, className = "" }) {
  return (
    <div className={`monitor ${className}`}>
      <div className="monitor-screen">
        <Terminal seed={seed} />
      </div>
      <div className="monitor-neck" />
      <div className="monitor-foot" />
    </div>
  );
}
