"use client";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { site } from "@/site.config";
import { PROFIT_SPLIT_BY_WITHDRAWAL } from "@/lib/rulebook";

const SPLIT_MAX = PROFIT_SPLIT_BY_WITHDRAWAL.at(-1);

const pad = (n) => String(Math.max(0, n)).padStart(2, "0");

function split(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

// Live coupon from the CRM (same source as the old top bar). Returns null when the
// configured code is missing or expired, so the promo never shows a fake deal.
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

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function Laurel({ flip = false }) {
  return (
    <svg className="uc-laurel" viewBox="0 0 24 48" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M18 46C9 40 5 30 6 18 7 11 10 6 14 2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {[8, 15, 22, 29, 36].map((y, i) => (
        <g key={y}>
          <ellipse cx={4.5 + i * 0.6} cy={y} rx="2" ry="4.2" transform={`rotate(-28 ${4.5 + i * 0.6} ${y})`} fill="currentColor" />
          <ellipse cx={12 + i * 0.4} cy={y + 3} rx="1.7" ry="3.6" transform={`rotate(38 ${12 + i * 0.4} ${y + 3})`} fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

function Stopwatch() {
  return (
    <span className="uc-watch" aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <rect x="20" y="2" width="8" height="5" rx="1.5" fill="currentColor" />
        <circle cx="24" cy="27" r="17" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="24" cy="27" r="12" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="1" strokeDasharray="1 3" />
        <path className="uc-watch-hand" d="M24 27 L31 20" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" />
        <circle cx="24" cy="27" r="2.2" fill="currentColor" />
      </svg>
    </span>
  );
}

export default function Hero() {
  const h = site.hero;
  const coupon = useCoupon(site.couponBar?.code);
  const expiresAt = coupon?.expiresAt ? new Date(coupon.expiresAt).getTime() : null;
  const now = useNow(!!expiresAt);
  const left = expiresAt ? expiresAt - now : null;
  const showTimer = left !== null && left > 0;
  const t = split(left || 0);

  return (
    <section className="uc-hero">
      <div className="uc-hero-bg" aria-hidden="true">
        <div className="uc-hero-grid" />
        <div className="uc-hero-glow" />
      </div>

      <div className="container uc-hero-in">
        <h1 className="uc-hero-title">
          {h.titleLines.map((l) => (
            <span key={l} className="uc-hero-line">
              {l}
            </span>
          ))}
          <span className="uc-hero-tag">
            <small>{h.tag[0]}</small>
            {SPLIT_MAX}%
          </span>
        </h1>

        <div className="uc-award">
          <Laurel />
          <div>
            <b>{h.award[0]}</b>
            <span>{h.award[1]}</span>
          </div>
          <Laurel flip />
        </div>

        <p className="uc-hero-sub">{h.sub}</p>

        <a href={site.links.start} className="uc-btn uc-btn-white uc-hero-cta">
          {h.cta} <ArrowRight size={18} />
        </a>

        <a href={site.couponBar?.href || "/pricing"} className="uc-promo">
          <Stopwatch />
          <div className="uc-promo-txt">
            <div className="uc-promo-top">
              <span className="uc-promo-pill">{coupon ? `${coupon.discountPercent}% off` : `Up to ${SPLIT_MAX}%`}</span>
              <span>
                {coupon ? (
                  <>
                    {site.couponBar.text} with code <span className="uc-promo-code">{coupon.code}</span>
                  </>
                ) : (
                  <>
                    {h.promo.text} <span className="uc-promo-code">{h.promo.accent}</span>
                  </>
                )}
              </span>
            </div>
            <div className="uc-promo-sub">{h.promo.sub}</div>
          </div>
          {showTimer ? (
            <div className="uc-count" aria-label="Offer ends in">
              {[
                [t.d, "Days"],
                [t.h, "Hours"],
                [t.m, "Min"],
                [t.s, "Sec"],
              ].map(([v, l], i) => (
                <div key={l} className="uc-count-cell">
                  {i > 0 && <span className="uc-count-sep">:</span>}
                  <div>
                    <b className={i === 3 ? "sec" : ""}>{pad(v)}</b>
                    <span>{l}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="uc-promo-go">
              View plans <ArrowRight size={16} />
            </span>
          )}
        </a>

        <div className="uc-press">
          <span className="uc-press-lbl">Trade on</span>
          {site.platforms.map((p) => (
            <span key={p} className="uc-press-logo">
              {p}
            </span>
          ))}
          <span className="uc-press-logo">Web &amp; Mobile</span>
        </div>
      </div>
    </section>
  );
}
