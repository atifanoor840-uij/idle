"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { PAYOUTS, fmtDate, fmtUsd } from "@/lib/payouts";

function Lightbox({ item, onClose }) {
  useEffect(() => {
    if (!item) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [item, onClose]);
  if (!item) return null;
  return (
    <div className="po-lb" role="dialog" aria-modal="true" aria-label={`${item.name} payout certificate`} onClick={onClose}>
      <button className="po-lb-x" onClick={onClose} aria-label="Close">
        <X size={22} />
      </button>
      <img src={item.img} alt={`${item.name} payout certificate, ${fmtUsd(item.amount)}`} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function Cert({ p, onOpen }) {
  return (
    <button type="button" className="po-card" onClick={() => onOpen(p)} aria-label={`View ${p.name}'s certificate`}>
      <span className="po-img">
        <img src={p.img} alt={`${p.name} payout certificate`} loading="lazy" width="1600" height="2000" />
      </span>
      <span className="po-meta">
        <span>
          <b>{p.name}</b>
          <small>{p.country}</small>
        </span>
        <span className="po-amt">
          {fmtUsd(p.amount)}
          <small>{fmtDate(p.date)}</small>
        </span>
      </span>
    </button>
  );
}

/* Home page: auto-scrolling strip of certificates right under the hero */
export function PayoutStrip() {
  const [open, setOpen] = useState(null);
  const total = PAYOUTS.reduce((s, p) => s + p.amount, 0);
  const loop = [...PAYOUTS, ...PAYOUTS];
  return (
    <section className="po-strip" id="payouts">
      <div className="container po-strip-head" data-reveal>
        <div>
          <span className="eyebrow">Recent payouts</span>
          <h2 className="uc-title po-strip-title">Real traders. Real rewards.</h2>
        </div>
        <div className="po-strip-side">
          <span className="po-total">
            <b>{fmtUsd(total)}</b> paid to {PAYOUTS.length} traders this week
          </span>
          <a href="/payout-certificates" className="po-link">
            View all payouts <ArrowUpRight size={16} />
          </a>
        </div>
      </div>
      <div className="po-marquee">
        <div className="po-track">
          {loop.map((p, i) => (
            <div className="po-slide" key={i} aria-hidden={i >= PAYOUTS.length || undefined}>
              <Cert p={p} onOpen={setOpen} />
            </div>
          ))}
        </div>
      </div>
      <Lightbox item={open} onClose={() => setOpen(null)} />
    </section>
  );
}

/* /payouts page: full grid */
export function PayoutGrid() {
  const [open, setOpen] = useState(null);
  return (
    <section className="section po-page">
      <div className="container">
        <div className="po-grid">
          {PAYOUTS.map((p) => (
            <div key={p.img} data-reveal>
              <Cert p={p} onOpen={setOpen} />
            </div>
          ))}
        </div>
      </div>
      <Lightbox item={open} onClose={() => setOpen(null)} />
    </section>
  );
}
