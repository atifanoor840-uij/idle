"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/site.config";
import Globe from "./Globe";

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

export default function Hero() {
  const h = site.hero;
  const coupon = useCoupon(site.couponBar?.code);
  const left = useCountdown(coupon?.expiresAt ? new Date(coupon.expiresAt).getTime() : null);
  const users = site.numbers.stats[1].num;
  const stats = (site.heroStats || []).filter((s) => !/challenges/i.test(s.lbl)).slice(0, 4);

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

      <div className="bx-globe-wrap" aria-hidden="true">
        <Globe className="bx-globe" speed={0.045} tilt={22} arcs={false} />
      </div>

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
          <a href="/pricing" className="bx-ghost">
            See pricing
          </a>
        </div>

        <p className="bx-users bx-rise" style={{ "--d": "330ms" }}>
          <span className="bx-live" aria-hidden="true" />
          Trusted by <b>{users}</b> {h.usersLabel}
        </p>

        <dl className="bx-stats bx-rise" style={{ "--d": "420ms" }}>
          {stats.map((s) => (
            <div key={s.lbl} className="bx-stat">
              <dt>{s.lbl}</dt>
              <dd>{s.num}</dd>
            </div>
          ))}
        </dl>

      </div>
    </section>
  );
}

