"use client";
import { useEffect, useState } from "react";
import { site } from "@/site.config";
import { ChartBg, Rich } from "./ui";
import { AssetIcon } from "./AssetIcon";

const START = [
  { sym: "EURUSD", name: "Euro / US Dollar", bid: 1.08452, open: 1.08321, dp: 5, spread: 0.00001 },
  { sym: "GBPUSD", name: "British Pound / US Dollar", bid: 1.27118, open: 1.27205, dp: 5, spread: 0.00003 },
  { sym: "XAUUSD", name: "Gold / US Dollar", bid: 2405.12, open: 2393.4, dp: 2, spread: 0.12 },
  { sym: "NAS100", name: "Nasdaq 100", bid: 18245.3, open: 18190.1, dp: 1, spread: 0.8 },
];

function Price({ value, dp, tick, dir }) {
  const s = value.toFixed(dp);
  return (
    <span key={tick} className={`ba-val ${dir ? `flash-${dir}` : ""}`}>
      {s.slice(0, -2)}
      <b>{s.slice(-2)}</b>
    </span>
  );
}

export default function QuoteBoard() {
  const [quotes, setQuotes] = useState(START.map((q) => ({ ...q, dir: null, tick: 0 })));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setQuotes((qs) =>
        qs.map((q) => {
          if (Math.random() < 0.4) return q;
          const move = (Math.random() - 0.5) * q.bid * 0.0004;
          const bid = Math.round((q.bid + move) * 10 ** q.dp) / 10 ** q.dp;
          return { ...q, bid, dir: bid >= q.bid ? "up" : "down", tick: q.tick + 1 };
        })
      );
    }, 1400);
    return () => clearInterval(t);
  }, []);

  const q = site.quoteBand;
  return (
    <section className="quote-band dark-band">
      <ChartBg seed={4} className="half-left" />
      <div className="container qb-grid">
        <div className="tiles" data-reveal>
          {quotes.map((x) => {
            const chg = ((x.bid - x.open) / x.open) * 100;
            const up = chg >= 0;
            const ask = x.bid + x.spread;
            const pts = Math.round(x.spread * 10 ** (x.dp - (x.dp >= 3 ? 1 : 0)) * 10) / 10;
            return (
              <div className="tile" key={x.sym}>
                <div className="tile-head">
                  <span className="tile-asset">
                    <AssetIcon symbol={x.sym} size={26} />
                    <span className="tile-asset-meta">
                      <span className="tile-sym">{x.sym}</span>
                      <span className="tile-name">{x.name}</span>
                    </span>
                  </span>
                  <span className={`chg ${up ? "up" : "down"}`}>
                    {up ? "+" : ""}
                    {chg.toFixed(2)}%
                  </span>
                </div>
                <div className="ba">
                  <div>
                    <div className="ba-lbl">Bid</div>
                    <Price value={x.bid} dp={x.dp} tick={x.tick} dir={x.dir} />
                  </div>
                  <div>
                    <div className="ba-lbl">Ask</div>
                    <Price value={ask} dp={x.dp} tick={x.tick} dir={x.dir} />
                  </div>
                </div>
                <div className="spread">
                  <span>Spread {pts}</span>
                  <span className="pills">
                    <span className="pill pill-sell">SELL</span>
                    <span className="pill pill-buy">BUY</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="qb-text" data-reveal>
          <h2 className="band-h1">
            <Rich text={q.title} />
          </h2>
          <p className="p-dark">{q.text}</p>
          <div className="btn-row">
            <a href={site.links.start} className="btn btn-primary">
              Start Challenge
            </a>
            <a href={site.links.trial || "/rules"} className="btn btn-outline">
              {site.links.trial ? "Free Trial" : "Read the Rules"}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
