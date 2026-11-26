"use client";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Clock, Copy, Menu, X } from "lucide-react";
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

// Scrolling offer ticker above the navbar (site.offerTicker). Coupon items are
// checked live against /api/coupons, so only active, unexpired codes ever show.
export function OfferTicker() {
  const cfg = site.offerTicker;
  const items = cfg?.items ?? [];
  const [coupons, setCoupons] = useState({});
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(null);

  // items is a static import, so this runs once per mount
  useEffect(() => {
    const codes = [...new Set(items.filter((i) => i.coupon).map((i) => i.coupon.toUpperCase()))];
    if (!codes.length) return;
    let off = false;
    Promise.all(
      codes.map((code) =>
        fetch(`/api/coupons?code=${encodeURIComponent(code)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => [code, j?.coupon ?? null])
          .catch(() => [code, null]),
      ),
    ).then((pairs) => !off && setCoupons(Object.fromEntries(pairs)));
    return () => {
      off = true;
    };
  }, [items]);

  const hasExpiry = Object.values(coupons).some((c) => c?.expiresAt);
  useEffect(() => {
    if (!hasExpiry) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasExpiry]);

  const live = items
    .map((it) => {
      if (!it.coupon) return it.value ? { ...it, key: `${it.label}-${it.value}` } : null;
      const c = coupons[it.coupon.toUpperCase()];
      if (!c) return null;
      const left = c.expiresAt ? timeLeft(new Date(c.expiresAt).getTime() - now) : "";
      if (left === null) return null; // expired since the page loaded
      return { ...it, key: `coupon-${c.code}`, code: c.code, value: c.code, extra: `${c.discountPercent}% off`, left };
    })
    .filter(Boolean);

  if (!live.length) return null;

  const copy = (code) => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1600);
    });
  };

  // The list is rendered twice so the -50% scroll loops seamlessly; the copy is aria-hidden.
  const group = (dup) =>
    live.map((it) => (
      <li key={`${dup ? "d" : "o"}-${it.key}`} className="ot-item">
        <Clock size={13} className="ot-ic" aria-hidden="true" />
        <span className="ot-label">{it.label}</span>
        {it.code ? (
          <button
            type="button"
            className="ot-value ot-code"
            onClick={() => copy(it.code)}
            tabIndex={dup ? -1 : 0}
            aria-label={`Copy coupon code ${it.code}`}
          >
            {it.code}
            {copied === it.code ? <Check size={12} /> : <Copy size={12} />}
          </button>
        ) : cfg.href ? (
          <a href={cfg.href} className="ot-value" tabIndex={dup ? -1 : 0}>
            {it.value}
          </a>
        ) : (
          <span className="ot-value">{it.value}</span>
        )}
        {it.extra && <span className="ot-value">{it.extra}</span>}
        {it.left && <span className="ot-left">ends {it.left}</span>}
      </li>
    ));

  return (
    <div className="offer-ticker" role="region" aria-label="Current offers">
      <div className="ot-track" style={{ "--ot-dur": `${Math.max(20, live.length * 7)}s` }}>
        <ul className="ot-group">{group(false)}</ul>
        <ul className="ot-group" aria-hidden="true">{group(true)}</ul>
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
