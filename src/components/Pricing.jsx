"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Lock } from "lucide-react";
import { site } from "@/site.config";

const money = (n) => `$${Number(n).toLocaleString("en-US")}`;
const sizeLabel = (n) => (n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}K`);

// Rule rows whose % values can be shown as dollar amounts of the account size.
const AMOUNT_ROW = /target|loss/i;
const MODEL_SUB = { "2-step": "Two phases", "1-step": "One phase", instant: "No evaluation" };
const ADDONS = [
  { key: "weekend", label: "Weekend holding", note: "Keep trades open over the weekend", pct: 20 },
  { key: "overnight", label: "Overnight holding", note: "Hold positions past 00:00 UTC", pct: 10 },
];

function toAmounts(value, size) {
  return value.replace(/(\d+(?:\.\d+)?)%/g, (_, p) => money(Math.round((size * Number(p)) / 100)));
}
// Big value + small note for a rule tile:
// "6% · qualified 6% (static)" → ["6%", "qualified 6% (static)"]
// "None (trade at least once every 30 days)" → ["None", "trade at least once every 30 days"]
function splitValue(v) {
  const [a, ...rest] = v.split(" · ");
  if (rest.length) return [a, rest.join(" · ")];
  const m = v.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? [m[1], m[2]] : [v, ""];
}

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

/* Challenge builder: pick evaluation → slide to a size → add-ons, with a live
   order ticket and the rule set as tiles. `models` comes from the server:
   rule text from the rulebook, prices from the DB. */
export default function Pricing({ models, showHeader = false, headingLevel = 2, page = false }) {
  const Heading = `h${headingLevel}`;
  const [mi, setMi] = useState(0);
  const [si, setSi] = useState(() => {
    const i = models[0]?.sizes.findIndex((x) => x.size === 100000);
    return i >= 0 ? i : 3;
  });
  const [unit, setUnit] = useState("pct");
  const [addons, setAddons] = useState({ weekend: false, overnight: false });
  const coupon = useCoupon(site.couponBar?.code);

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
  const sIdx = Math.min(si, m.sizes.length - 1);
  const s = m.sizes[sIdx];
  const pickModel = (i) => {
    setMi(i);
    const j = models[i].sizes.findIndex((x) => x.size === s.size);
    setSi(j >= 0 ? j : Math.min(sIdx, models[i].sizes.length - 1));
  };

  const addonPct = ADDONS.reduce((t, a) => t + (addons[a.key] ? a.pct : 0), 0);
  const factor = 1 + addonPct / 100;
  const total = Math.round(s.price * factor);
  const list = s.realPrice ? Math.round(s.realPrice * factor) : 0;
  const discount = list > total ? list - total : 0;
  const checkoutLink = `/challenges?size=${s.size}&weekend=${addons.weekend ? 1 : 0}&overnight=${addons.overnight ? 1 : 0}`;
  const fill = m.sizes.length > 1 ? (sIdx / (m.sizes.length - 1)) * 100 : 100;

  return (
    <section className={`section pz ${page ? "pz-page" : ""}`} id="plans">
      <div className="container">
        {showHeader && (
          <div className="pz-head" data-reveal>
            <div>
              <span className="pz-kicker">Pricing</span>
              <Heading className="pz-title">Build your challenge</Heading>
            </div>
            <p className="pz-lede">Pick an evaluation, slide to your account size and add what you need. One payment, no subscription.</p>
          </div>
        )}

        <div className="pz-grid">
          {/* builder */}
          <div className="pz-builder">
            <div className="pz-step">
              <div className="pz-step-h">
                <span className="pz-num">01</span>
                <span>Choose evaluation</span>
              </div>
              <div className="pz-seg" role="radiogroup" aria-label="Challenge type">
                {models.map((x, i) => (
                  <button key={x.id} type="button" role="radio" aria-checked={x === m} className={`pz-seg-btn ${x === m ? "on" : ""}`} onClick={() => pickModel(i)}>
                    <b>{x.name}</b>
                    <span>{MODEL_SUB[x.id] || x.tag}</span>
                  </button>
                ))}
              </div>
              <p className="pz-blurb">{m.blurb}</p>
            </div>

            <div className="pz-step">
              <div className="pz-step-h">
                <span className="pz-num">02</span>
                <span>Account size</span>
              </div>
              <div className="pz-size-read">
                <b>{sizeLabel(s.size)}</b>
                <span>virtual capital</span>
              </div>
              <div className="pz-slider" style={{ "--fill": `${fill}%` }}>
                <input
                  type="range"
                  min={0}
                  max={m.sizes.length - 1}
                  step={1}
                  value={sIdx}
                  onChange={(e) => setSi(Number(e.target.value))}
                  aria-label="Account size"
                  aria-valuetext={sizeLabel(s.size)}
                />
                <div className="pz-ticks">
                  {m.sizes.map((x, i) => (
                    <button key={x.planId} type="button" className={i === sIdx ? "on" : ""} onClick={() => setSi(i)} tabIndex={-1}>
                      {sizeLabel(x.size)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pz-step">
              <div className="pz-step-h">
                <span className="pz-num">03</span>
                <span>
                  Add-ons <em>optional</em>
                </span>
              </div>
              <div className="pz-addons">
                {ADDONS.map((a) => (
                  <label key={a.key} className={`pz-addon ${addons[a.key] ? "on" : ""}`}>
                    <span>
                      <b>{a.label}</b>
                      <small>{a.note}</small>
                    </span>
                    <span className="pz-addon-pct">+{a.pct}%</span>
                    <input type="checkbox" checked={addons[a.key]} onChange={(e) => setAddons((o) => ({ ...o, [a.key]: e.target.checked }))} />
                    <span className="pz-toggle" aria-hidden="true" />
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* order ticket */}
          <aside className="pz-ticket" aria-label="Order summary">
            <div className="pz-t-top">
              <span>Order ticket</span>
              <span className="pz-t-id">{m.id.toUpperCase()}-{s.size / 1000}K</span>
            </div>
            <dl className="pz-t-rows">
              <div>
                <dt>Evaluation</dt>
                <dd>{m.name}</dd>
              </div>
              <div>
                <dt>Virtual capital</dt>
                <dd>{money(s.size)}</dd>
              </div>
              {ADDONS.filter((a) => addons[a.key]).map((a) => (
                <div key={a.key}>
                  <dt>{a.label}</dt>
                  <dd>+{a.pct}%</dd>
                </div>
              ))}
            </dl>
            <div className="pz-t-cut" aria-hidden="true" />
            <dl className="pz-t-rows">
              {list > total && (
                <div>
                  <dt>List price</dt>
                  <dd className="strike">{money(list)}</dd>
                </div>
              )}
              {discount > 0 && (
                <div>
                  <dt>Discount</dt>
                  <dd className="good">−{money(discount)}</dd>
                </div>
              )}
            </dl>
            <div className="pz-total">
              <span>Total today</span>
              <b>{money(total)}</b>
            </div>
            {coupon && (
              <p className="pz-coupon">
                Code <b>{coupon.code}</b> takes another {coupon.discountPercent}% off at checkout
              </p>
            )}
            <a href={checkoutLink} className="pz-cta">
              Place order <ArrowRight size={18} />
            </a>
            <ul className="pz-t-notes">
              <li>
                <Check size={13} /> One-time fee, no subscription
              </li>
              <li>
                <Lock size={13} /> Secure checkout · Card, wallet &amp; crypto
              </li>
            </ul>
          </aside>
        </div>

        {/* rules as tiles */}
        <div className="pz-rules">
          <div className="pz-rules-h">
            <h3>
              Rules for <span>{m.name} · {sizeLabel(s.size)}</span>
            </h3>
            <div className="pz-unit" role="radiogroup" aria-label="Show values as">
              <button type="button" role="radio" aria-checked={unit === "pct"} className={unit === "pct" ? "on" : ""} onClick={() => setUnit("pct")}>
                %
              </button>
              <button type="button" role="radio" aria-checked={unit === "usd"} className={unit === "usd" ? "on" : ""} onClick={() => setUnit("usd")}>
                $
              </button>
            </div>
          </div>
          <div className="pz-tiles">
            {m.rules.map((r) => {
              const v = unit === "usd" && AMOUNT_ROW.test(r.k) ? toAmounts(r.v, s.size) : r.v;
              const [main, note] = splitValue(v);
              return (
                <div key={r.k} className="pz-tile">
                  <span className="pz-tile-k">{r.k}</span>
                  <b className="pz-tile-v">{main}</b>
                  {note && <span className="pz-tile-n">{note}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
