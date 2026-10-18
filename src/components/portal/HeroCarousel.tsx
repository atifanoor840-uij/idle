"use client";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { Offer } from "@/lib/mock";
import { btnPrimary, cx } from "./ui";

/* Original geometric illustrations, drawn with the brand tokens */
function Art({ kind }: { kind: Offer["art"] }) {
  if (kind === "payout")
    return (
      <svg viewBox="0 0 260 200" className="h-full w-full" aria-hidden="true">
        <rect x="70" y="40" width="130" height="78" rx="10" fill="var(--brand)" opacity=".35" transform="rotate(-10 135 79)" />
        <rect x="58" y="56" width="140" height="80" rx="10" fill="var(--brand)" opacity=".6" transform="rotate(-4 128 96)" />
        <rect x="40" y="82" width="170" height="96" rx="16" fill="var(--ink)" />
        <rect x="150" y="112" width="72" height="36" rx="10" fill="var(--brand)" />
        <circle cx="168" cy="130" r="7" fill="var(--ink)" />
        <rect x="58" y="100" width="54" height="6" rx="3" fill="var(--surface)" opacity=".35" />
        <rect x="58" y="150" width="78" height="10" rx="5" fill="var(--surface)" opacity=".8" />
        <circle cx="218" cy="56" r="20" fill="var(--surface)" stroke="var(--brand-strong)" strokeWidth="3" />
        <path d="M209 56l6 6 12-12" stroke="var(--brand-strong)" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (kind === "trophy")
    return (
      <svg viewBox="0 0 260 200" className="h-full w-full" aria-hidden="true">
        <rect x="40" y="150" width="56" height="34" rx="6" fill="var(--line)" />
        <rect x="102" y="128" width="56" height="56" rx="6" fill="var(--brand)" />
        <rect x="164" y="160" width="56" height="24" rx="6" fill="var(--line)" />
        <path d="M100 30h60v34a30 30 0 0 1-60 0z" fill="var(--ink)" />
        <path d="M100 40H84a16 16 0 0 0 16 24M160 40h16a16 16 0 0 1-16 24" stroke="var(--ink)" strokeWidth="6" fill="none" />
        <rect x="124" y="92" width="12" height="20" fill="var(--ink)" />
        <rect x="110" y="110" width="40" height="10" rx="4" fill="var(--ink)" />
        <path d="M130 46l5 10 11 1.5-8 7.5 2 11-10-5.5-10 5.5 2-11-8-7.5 11-1.5z" fill="var(--brand)" />
        <text x="130" y="164" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--brand-ink)">1</text>
      </svg>
    );
  return (
    <svg viewBox="0 0 260 200" className="h-full w-full" aria-hidden="true">
      <rect x="30" y="30" width="190" height="140" rx="16" fill="var(--surface)" stroke="var(--line)" strokeWidth="2" />
      <rect x="48" y="48" width="70" height="8" rx="4" fill="var(--line)" />
      {[38, 56, 48, 74, 66, 92].map((h, i) => (
        <rect key={i} x={52 + i * 26} y={150 - h} width="16" height={h} rx="4" fill="var(--brand)" opacity={0.45 + i * 0.1} />
      ))}
      <polyline points="60,118 86,100 112,108 138,80 164,86 190,58" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="214" cy="150" r="30" fill="var(--ink)" />
      <text x="214" y="160" textAnchor="middle" fontSize="28" fontWeight="800" fill="var(--brand)">%</text>
    </svg>
  );
}

export default function HeroCarousel({ offers }: { offers: Offer[] }) {
  const [i, setI] = useState(0);
  const go = (d: number) => setI((x) => (x + d + offers.length) % offers.length);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => go(1), 7000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const o = offers[i];
  return (
    <section className="relative overflow-hidden rounded-card bg-linear-to-r from-brand-soft via-surface to-surface" aria-roledescription="carousel">
      <div className="plus-grid pointer-events-none absolute inset-y-0 right-0 w-1/2" aria-hidden="true" />
      <div className="relative grid min-h-[240px] items-center gap-6 px-5 pb-12 pt-7 sm:min-h-[260px] sm:grid-cols-[1fr_auto] sm:px-14 md:py-10">
        <div key={i} className="max-w-xl animate-[fadeIn_.4s_ease-out]">
          <span className="inline-flex rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-brand-strong ring-1 ring-line">{o.tag}</span>
          <h2 className="mt-3.5 text-[23px] font-extrabold leading-[1.12] tracking-tight text-ink sm:mt-4 sm:text-[26px] md:text-[35px]">
            {o.title.split("\n").map((l, k) => (
              <Fragment key={k}>
                {k > 0 && <br />}
                {l}
              </Fragment>
            ))}
          </h2>
          <p className="mt-2.5 text-[14px] text-ink-2 sm:mt-3 sm:text-[15px]">{o.sub}</p>
          <Link href={o.href} className={cx(btnPrimary, "mt-5 sm:mt-6")}>
            {o.cta} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="hidden h-[200px] w-[260px] sm:block">
          <Art kind={o.art} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous offer"
        className="absolute left-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-surface-2 sm:inline-flex"
      >
        <ChevronLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next offer"
        className="absolute right-3 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-surface-2 sm:inline-flex"
      >
        <ChevronRight size={18} />
      </button>
      <div className="absolute bottom-4 left-5 flex gap-1.5 sm:left-14">
        {offers.map((_, k) => (
          <button
            key={k}
            type="button"
            aria-label={`Offer ${k + 1}`}
            aria-current={k === i}
            onClick={() => setI(k)}
            className={cx("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-ink" : "w-1.5 bg-muted/40")}
          />
        ))}
      </div>
    </section>
  );
}
