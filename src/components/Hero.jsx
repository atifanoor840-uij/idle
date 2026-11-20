"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/site.config";

const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

// Live coupon from the CRM. Returns null when the configured code is missing or
// expired, so the badge never advertises a deal that doesn't exist.
function useCoupon(code) {
  const [coupon, setCoupon] = useState(null);
  useEffect(() => {
    if (!code) return;
    let off = false;
    fetch(`/api/coupons?code=${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !off && j?.coupon && setCoupon(j.coupon))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [code]);
  return coupon;
}

function useCountdown(expiresAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const s = Math.floor((expiresAt - now) / 1000);
  if (s <= 0) return null;
  const d = Math.floor(s / 86400);
  const hms = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/* Glass candlestick crystal — original artwork drawn in SVG, tinted with the brand green. */
function Crystal({ className, id }) {
  return (
    <svg className={className} viewBox="0 0 120 300" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#d9fbe6" stopOpacity=".55" />
          <stop offset=".18" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset=".42" stopColor="#7ef0ad" stopOpacity=".35" />
          <stop offset=".7" stopColor="#0f5132" stopOpacity=".55" />
          <stop offset="1" stopColor="#c8f7da" stopOpacity=".7" />
        </linearGradient>
        <linearGradient id={`${id}-core`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#bbf7d0" />
          <stop offset=".5" stopColor="#22c55e" />
          <stop offset="1" stopColor="#15803d" />
        </linearGradient>
        <linearGradient id={`${id}-wick`} x1="0" x2="1">
          <stop offset="0" stopColor="#e7fdf0" stopOpacity=".9" />
          <stop offset="1" stopColor="#7ef0ad" stopOpacity=".5" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      {/* wicks */}
      <rect x="55" y="6" width="10" height="64" rx="5" fill={`url(#${id}-wick)`} stroke="#ffffff" strokeOpacity=".6" />
      <rect x="55" y="228" width="10" height="66" rx="5" fill={`url(#${id}-wick)`} stroke="#ffffff" strokeOpacity=".6" />
      {/* inner glow */}
      <rect x="40" y="78" width="40" height="144" rx="12" fill="#22c55e" opacity=".75" filter={`url(#${id}-blur)`} />
      {/* glass body */}
      <rect x="22" y="62" width="76" height="176" rx="10" fill={`url(#${id}-glass)`} stroke="#ffffff" strokeOpacity=".75" strokeWidth="1.5" />
      {/* glowing core bar */}
      <rect x="46" y="76" width="16" height="148" rx="6" fill={`url(#${id}-core)`} />
      <rect x="49" y="80" width="5" height="140" rx="2.5" fill="#ffffff" opacity=".85" />
      {/* facets & highlights */}
      <path d="M22 72 L98 72" stroke="#ffffff" strokeOpacity=".5" />
      <path d="M22 228 L98 228" stroke="#ffffff" strokeOpacity=".35" />
      <path d="M34 66 L34 234" stroke="#ffffff" strokeOpacity=".7" strokeWidth="2" />
      <path d="M86 66 L86 234" stroke="#ffffff" strokeOpacity=".25" />
      <rect x="26" y="66" width="6" height="168" rx="3" fill="#ffffff" opacity=".35" />
    </svg>
  );
}

export default function Hero() {
  const h = site.hero;
  const coupon = useCoupon(site.couponBar?.code);
  const left = useCountdown(coupon?.expiresAt ? new Date(coupon.expiresAt).getTime() : null);
  const users = site.numbers.stats[1].num;

  const badge = coupon
    ? { tag: coupon.code, text: `${coupon.discountPercent}% off all challenges${left ? ` · ends in ${left}` : ""}`, href: site.couponBar.href || "/pricing" }
    : h.badge;

  return (
    <section className="bx-hero">
      <div className="bx-bg" aria-hidden="true">
        <div className="bx-beams" />
        <div className="bx-dots" />
        <div className="bx-glow" />
        <div className="bx-fade" />
      </div>

      <Crystal className="bx-crystal bx-crystal-l" id="cl" />
      <Crystal className="bx-crystal bx-crystal-r" id="cr" />

      <div className="container bx-in">
        <a href={badge.href} className="bx-badge bx-rise" style={{ "--d": "0ms" }}>
          <span className="bx-badge-tag">{badge.tag}</span>
          <span className="bx-badge-txt">{badge.text}</span>
          <ArrowUpRight size={15} />
        </a>

        <h1 className="bx-title bx-rise" style={{ "--d": "90ms" }}>
          {h.titleLines.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </h1>

        <p className="bx-sub bx-rise" style={{ "--d": "180ms" }}>
          {h.sub}
        </p>

        <div className="bx-actions bx-rise" style={{ "--d": "270ms" }}>
          <a href={site.links.start} className="bx-cta">
            {h.cta}
            <span className="bx-cta-ic">
              <ArrowUpRight size={20} />
            </span>
          </a>
          <span className="bx-users">
            <b>{users}</b> {h.usersLabel}
          </span>
        </div>
      </div>
    </section>
  );
}
