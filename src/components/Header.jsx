"use client";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Menu, X } from "lucide-react";
import { site } from "@/site.config";

function timeLeft(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

// Slim coupon bar. The code comes from site.couponBar; discount and expiry come
// from the live coupon, so a wrong or expired code never shows.
export function TopBar() {
  const cfg = site.couponBar;
  const [coupon, setCoupon] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!cfg?.code) return;
    let off = false;
    fetch(`/api/coupons?code=${encodeURIComponent(cfg.code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !off && j?.coupon && setCoupon(j.coupon))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [cfg?.code]);

  const expiresAt = coupon?.expiresAt ? new Date(coupon.expiresAt).getTime() : null;
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!coupon) return null;
  const left = expiresAt ? timeLeft(expiresAt - now) : "";
  if (left === null) return null;

  const copy = () => {
    navigator.clipboard?.writeText(coupon.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div className="topbar">
      <div className="container topbar-in">
        <span className="tb-text">
          {cfg.text && <span className="tb-label">{cfg.text}</span>}
          <b>{coupon.discountPercent}% off</b> all challenges with code
        </span>
        <button type="button" className="tb-code" onClick={copy} aria-label={`Copy coupon code ${coupon.code}`}>
          {coupon.code} {copied ? <Check size={12} /> : <Copy size={12} />}
        </button>
        {left && (
          <span className="tb-timer">
            Ends in <b>{left}</b>
          </span>
        )}
        {cfg.href && (
          <a href={cfg.href} className="tb-link">
            Claim →
          </a>
        )}
      </div>
    </div>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="nav">
      <div className="container nav-in">
        <a href="/" className="logo" aria-label={site.name}>
          <img src="/logo.png" alt={site.name} className="logo-img" />
        </a>

        <ul className="nav-links">
          {site.nav.map((l) => (
            <li key={l.label}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
          <li className="nav-more">
            <button type="button">
              More <ChevronDown size={16} />
            </button>
            <div className="nav-menu">
              {site.navMore.map((l) => (
                <a key={l.label} href={l.href}>
                  {l.label}
                </a>
              ))}
            </div>
          </li>
        </ul>

        <div className="nav-cta">
          <a href={site.links.login} className="nav-login">
            Log in
          </a>
          <a href={site.links.start} className="btn btn-primary btn-sm">
            Start Challenge
          </a>
          <button type="button" className="nav-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="nav-mobile">
          {[...site.nav, ...site.navMore].map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <div className="nav-mobile-actions">
            <a href={site.links.start} className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
              Start Challenge
            </a>
            <a href={site.links.login} className="btn btn-outline btn-sm" onClick={() => setOpen(false)}>
              Client Login
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
