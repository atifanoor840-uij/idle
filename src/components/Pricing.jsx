"use client";
import { useEffect, useState } from "react";
import { Rich } from "./ui";

const money = (n) => `$${Number(n).toLocaleString("en-US")}`;
const sizeLabel = (n) => (n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}K`);

/* Model tabs + size picker + plan card + full comparison table.
   `models` comes from the server: rule text from the rulebook, prices from the DB. */
export default function Pricing({ models, showHeader = false }) {
  const [mi, setMi] = useState(0);
  const [si, setSi] = useState(3);

  // Deep link: /pricing#1-step opens that model
  useEffect(() => {
    const pick = () => {
      const i = models.findIndex((x) => `#${x.id}` === window.location.hash);
      if (i >= 0) setMi(i);
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, [models]);

  if (!models.length) {
    return (
      <section className="section" id="plans">
        <div className="container center">
          <p className="note">Challenges are not on sale right now. Please check back soon.</p>
        </div>
      </section>
    );
  }

  const m = models[Math.min(mi, models.length - 1)];
  const s = m.sizes[Math.min(si, m.sizes.length - 1)];

  return (
    <section className="section" id="plans">
      <div className="container">
        {showHeader && (
          <div className="pricing-head center" data-reveal>
            <span className="eyebrow">Challenges &amp; Pricing</span>
            <h2 className="h2 pricing-title">
              <Rich text={"Pick Your **Challenge**.\nKeep Up To **90%**."} />
            </h2>
            <p className="pricing-sub">One-time fee, no subscriptions. Choose an evaluation model and an account size.</p>
          </div>
        )}
        <div className="pricing-controls">
          <div className="model-tabs" role="tablist" aria-label="Challenge type">
            {models.map((x, i) => (
              <button key={x.id} type="button" role="tab" aria-selected={x === m} className={`model-tab ${x === m ? "active" : ""}`} onClick={() => setMi(i)}>
                {x.name}
              </button>
            ))}
          </div>
          <div className="size-chips" role="radiogroup" aria-label="Account size">
            {m.sizes.map((x, i) => (
              <button key={x.planId} type="button" role="radio" aria-checked={x === s} className={`size-chip ${x === s ? "active" : ""}`} onClick={() => setSi(i)}>
                {sizeLabel(x.size)}
              </button>
            ))}
          </div>
        </div>

        <div className="plan">
          <div className="card plan-rules">
            <span className="plan-tag">{m.tag}</span>
            <h2 className="h2">
              {m.name} · {sizeLabel(s.size)}
            </h2>
            <p className="plan-blurb">{m.blurb}</p>
            <dl className="kv">
              {m.rules.map((r) => (
                <div key={r.k}>
                  <dt>{r.k}</dt>
                  <dd>{r.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="card card-dark plan-price">
            <div className="world-dots" aria-hidden="true" />
            <span className="plan-price-lbl">One-time fee</span>
            <div className="plan-price-num">{money(s.price)}</div>
            <span className="plan-price-sub">No subscription · no hidden fees</span>
            <a href="/challenges" className="btn btn-primary">
              Start {sizeLabel(s.size)} Challenge
            </a>
            <a href="/rules" className="btn btn-outline">
              Read the Rules
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
