"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CalendarClock,
  Clock,
  Headphones,
  MessageCircle,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { SiApplepay, SiBitcoin, SiGooglepay, SiMastercard, SiTether, SiVisa } from "react-icons/si";
import { site } from "@/site.config";
import { PAYOUTS, fmtDate } from "@/lib/payouts";
import { AssetIcon } from "./AssetIcon";
import { CHALLENGE_RULES, PROFIT_SPLIT_BY_WITHDRAWAL as SPLIT } from "@/lib/rulebook";

const R1 = CHALLENGE_RULES.one_step_pro;
const SPLIT_MAX = SPLIT.at(-1);
const ORD = ["1st", "2nd", "3rd", "4th"];
const TIERS = SPLIT.map((p, i) => [i === SPLIT.length - 1 ? `${ORD[i] || `${i + 1}th`} onward` : `${ORD[i] || `${i + 1}th`} reward`, `${p}%`]);

const PAY_ICONS = { VISA: SiVisa, Mastercard: SiMastercard, "Apple Pay": SiApplepay, "Google Pay": SiGooglepay, Bitcoin: SiBitcoin, USDT: SiTether };

function Title({ children, sub }) {
  return (
    <div className="uc-title-wrap" data-reveal>
      <h2 className="uc-title">{children}</h2>
      {sub && <p className="uc-title-sub">{sub}</p>}
    </div>
  );
}

function useTicker(start, every = 1500) {
  const [list, setList] = useState(start);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setList((xs) =>
        xs.map((a) => {
          if (Math.random() < 0.45) return a;
          const move = (Math.random() - 0.48) * a.px * 0.0005;
          return { ...a, px: a.px + move, chg: a.chg + (move / a.px) * 100, dir: move >= 0 ? "up" : "down", tick: (a.tick || 0) + 1 };
        })
      );
    }, every);
    return () => clearInterval(t);
  }, [every]);
  return list;
}

/* ───────── 1. Bento: everything you need ───────── */

const MARKET_ROWS = [
  [["EURUSD", "Euro"], ["XAUUSD", "Gold"], ["NAS100", "Nasdaq 100"], ["BTCUSD", "Bitcoin"], ["GBPUSD", "Pound"], ["US30", "Dow Jones"]],
  [["ETHUSD", "Ethereum"], ["USDJPY", "Yen"], ["GER40", "DAX 40"], ["XAGUSD", "Silver"], ["AUDUSD", "Aussie"], ["USDCAD", "Loonie"]],
  [["NZDUSD", "Kiwi"], ["SPX500", "S&P 500"], ["USOIL", "Crude Oil"], ["EURGBP", "EUR/GBP"], ["USDCHF", "Franc"], ["EURJPY", "EUR/JPY"]],
];

function RewardWidget() {
  return (
    <div className="uc-widget">
      <div className="uc-widget-head">
        <span className="uc-widget-sym">
          <Wallet size={16} /> Reward request
        </span>
        <span className="uc-chip-sm">Share {SPLIT_MAX}%</span>
      </div>
      <span className="uc-widget-lbl">Approved simulated reward</span>
      <b className="uc-widget-val">+$4,120.00</b>
      <dl className="uc-widget-kv">
        {TIERS.map(([k, v], i) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={i === TIERS.length - 1 ? "hl" : ""}>{v}</dd>
          </div>
        ))}
      </dl>
      <span className="uc-widget-foot">Every 14 days · reviewed &lt; 24h</span>
    </div>
  );
}

function PlatformStack() {
  const tiles = [...site.platforms, "Web Trader", "Mobile"];
  return (
    <div className="uc-plat-stack" aria-hidden="true">
      {tiles.map((p, i) => (
        <span key={p} className={`uc-plat-tile t${i}`}>
          {p}
        </span>
      ))}
    </div>
  );
}

export function Bento() {
  const proof = site.proof.stats;
  const nums = site.numbers.stats;
  return (
    <section className="uc-sec" id="challenges">
      <div className="container">
        <Title>Everything you need to trade with confidence</Title>

        <div className="uc-bento">
          <div className="uc-card uc-span-2" data-reveal>
            <h3 className="uc-card-h">Trusted by {nums[1].num} traders</h3>
            <p className="uc-card-p">Disciplined traders choose {site.name} for clear rules, fast reviews and real 24/7 support.</p>
            <div className="uc-review">
              <div className="uc-review-top">
                <span className="uc-avatar">
                  <Users size={15} />
                </span>
                <b>Average trader rating</b>
                <span className="uc-verified">
                  <ShieldCheck size={12} /> VERIFIED
                </span>
              </div>
              <div className="uc-review-score">
                <b>{proof[1].num}</b>
                <span className="uc-stars">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </span>
              </div>
              <div className="uc-review-stats">
                <div>
                  <b>{proof[0].num}</b>
                  <span>{proof[0].lbl}</span>
                </div>
                <div>
                  <b>{nums[0].num}</b>
                  <span>{nums[0].lbl}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="uc-card uc-span-3 uc-card-split" data-reveal>
            <div>
              <span className="uc-badge-new">
                <TrendingUp size={12} /> REWARD SHARE
              </span>
              <h3 className="uc-card-h">Performance rewards up to {SPLIT_MAX}%</h3>
              <p className="uc-card-p">
                Your reward share grows with every successful reward request: {TIERS.map(([k, v]) => `${v} ${k.replace(" reward", "")}`).join(", ")}.
              </p>
              <span className="uc-card-meta">Paid in USDT or bank transfer</span>
            </div>
            <RewardWidget />
          </div>

          <div className="uc-card uc-span-3 uc-markets" data-reveal>
            <div className="uc-marquee" aria-hidden="true">
              {MARKET_ROWS.map((row, ri) => (
                <div key={ri} className={`uc-marquee-row ${ri % 2 ? "rev" : ""}`}>
                  {[...row, ...row].map(([sym, name], i) => (
                    <span key={i} className="uc-asset-pill">
                      <AssetIcon symbol={sym} size={30} />
                      <b>{name}</b>
                      <em>{sym}</em>
                    </span>
                  ))}
                </div>
              ))}
            </div>
            <div className="uc-markets-txt">
              <h3 className="uc-card-h">One account. Every market.</h3>
              <p className="uc-card-p">
                Trade <b>{site.markets.slice(0, -1).join(", ").toLowerCase()}</b> and {site.markets.at(-1).toLowerCase()} from one simulated account with raw virtual spreads.
              </p>
            </div>
          </div>

          <div className="uc-card uc-span-2 uc-platforms" id="platforms" data-reveal>
            <h3 className="uc-card-h">Powered by pro platforms</h3>
            <p className="uc-card-p">{site.platforms.join(", ")}. Trade on {site.devices.join(", ")}.</p>
            <PlatformStack />
          </div>

          <div className="uc-card uc-mini uc-mini-wide" data-reveal>
            <span className="uc-mini-ic">
              <CalendarClock size={22} />
            </span>
            <h3 className="uc-card-h">Bi-weekly rewards</h3>
            <p className="uc-card-p">Request every 14 days, up to 6% of account size per period.</p>
          </div>
          <div className="uc-card uc-mini" data-reveal>
            <span className="uc-mini-ic">
              <Clock size={22} />
            </span>
            <h3 className="uc-card-h">No time limits</h3>
            <p className="uc-card-p">Take as long as you need. News trading allowed in evaluation.</p>
          </div>
          <a href={site.links.discord} className="uc-card uc-mini uc-mini-link uc-discord" data-reveal>
            <span className="uc-mini-kicker">20,000+ traders</span>
            <h3 className="uc-card-h">Join our Discord</h3>
            <span className="uc-round">
              <Users size={18} />
            </span>
          </a>
          <a href={site.links.contact} className="uc-card uc-mini uc-mini-link uc-support" data-reveal>
            <span className="uc-mini-kicker">Any questions?</span>
            <h3 className="uc-card-h">24/7 trader support</h3>
            <span className="uc-round">
              <MessageCircle size={18} />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────── 2. Choose your challenge (header + stats; Pricing renders below) ───────── */

export function ChallengeHead() {
  const s = [
    { ic: Clock, lbl: site.proof.stats[0].lbl, num: site.proof.stats[0].num },
    { ic: Wallet, lbl: site.numbers.stats[0].lbl, num: site.numbers.stats[0].num },
    { ic: Users, lbl: site.numbers.stats[1].lbl, num: site.numbers.stats[1].num },
  ];
  return (
    <div className="container uc-ch-head">
      <Title>Choose your challenge</Title>
      <div className="uc-ch-stats" data-reveal>
        {s.map(({ ic: Ic, lbl, num }) => (
          <div key={lbl} className="uc-ch-stat">
            <Ic size={20} />
            <div>
              <span>{lbl}</span>
              <b>{num}</b>
            </div>
          </div>
        ))}
        <div className="uc-ch-stat uc-ch-rating">
          <span className="uc-stars">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={14} fill="currentColor" />
            ))}
          </span>
          <b>{site.proof.stats[1].num}</b>
        </div>
      </div>
    </div>
  );
}

/* ───────── 3. Rewards: a real dashboard screen ───────── */

/* App-window chrome shared by the product screens below. */
function AppWindow({ path, children, className = "" }) {
  return (
    <div className={`aw ${className}`}>
      <div className="aw-bar">
        <span className="aw-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="aw-url">
          {site.name} <span className="aw-sep">/</span> {path}
        </span>
      </div>
      <div className="aw-body">{children}</div>
    </div>
  );
}

const fmtMoney = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REQUESTS = PAYOUTS.slice(0, 4).map((p, i) => ({
  date: fmtDate(p.date),
  acct: `#${(51842 + i * 317).toString()}`,
  amount: p.amount,
  method: i % 2 ? "Bank transfer" : "USDT · TRC20",
  status: i === 0 ? "review" : "paid",
}));

function RewardDashboard() {
  const [method, setMethod] = useState(0);
  const profit = 4580;
  const tier = 1; // 2nd reward
  const share = SPLIT[tier];
  const methods = site.payouts.items;
  return (
    <AppWindow path="rewards" className="rd">
      <div className="rd-grid">
        <div className="rd-card rd-request">
          <div className="rd-card-h">
            <span>Request reward</span>
            <span className="rd-acct">2-Step · $100K · #51842</span>
          </div>
          <div className="rd-kv">
            <span>Profit available</span>
            <b>{fmtMoney(profit)}</b>
          </div>
          <div className="rd-kv">
            <span>Your share</span>
            <b>{share}%</b>
          </div>
          <div className="rd-total">
            <span>You receive</span>
            <b>{fmtMoney((profit * share) / 100)}</b>
          </div>
          <div className="rd-label">Payout method</div>
          <div className="rd-methods">
            {methods.map((m, i) => (
              <button key={m} type="button" className={`rd-method ${i === method ? "on" : ""}`} onClick={() => setMethod(i)}>
                <span className="rd-radio" />
                {m}
              </button>
            ))}
          </div>
          <a href={site.links.start} className="rd-btn">
            Request reward
          </a>
          <p className="rd-note">{site.payouts.note}</p>
        </div>

        <div className="rd-side">
          <div className="rd-card">
            <div className="rd-card-h">
              <span>Reward split</span>
              <span className="rd-muted">grows with every paid request</span>
            </div>
            <ol className="rd-steps">
              {TIERS.map(([k, v], i) => (
                <li key={k} className={i < tier ? "done" : i === tier ? "now" : ""}>
                  <span className="rd-dot">{i < tier ? <Check size={12} strokeWidth={3} /> : null}</span>
                  <b>{v}</b>
                  <small>{k}</small>
                </li>
              ))}
            </ol>
          </div>

          <div className="rd-card">
            <div className="rd-card-h">
              <span>Recent requests</span>
              <a href="/payout-certificates" className="rd-link">
                View all
              </a>
            </div>
            <table className="rd-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="hide-sm">Method</th>
                  <th className="r">Amount</th>
                  <th className="r">Status</th>
                </tr>
              </thead>
              <tbody>
                {REQUESTS.map((r) => (
                  <tr key={r.acct}>
                    <td>{r.date}</td>
                    <td className="hide-sm rd-muted">{r.method}</td>
                    <td className="r num">{fmtMoney(r.amount)}</td>
                    <td className="r">
                      <span className={`rd-status ${r.status}`}>{r.status === "paid" ? "Paid" : "In review"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

export function Rewards() {
  return (
    <section className="uc-sec uc-rewards" id="rewards">
      <div className="container">
        <Title sub="Request your reward from the dashboard and pick how you get paid. Your share goes up every time.">Over {site.numbers.stats[0].num} in simulated rewards</Title>
        <div className="center" data-reveal>
          <a href="/payout-policy" className="uc-btn uc-btn-white">
            See reward policy
          </a>
        </div>
        <div className="rd-stage" data-reveal>
          <RewardDashboard />
        </div>
      </div>
    </section>
  );
}

/* ───────── 4. How it works: one product screen per step ───────── */

// Illustrative $100K 2-Step account; limits come from the live rulebook.
const R2 = CHALLENGE_RULES.two_step_standard;
const SIZE = 100000;
const TARGET = (SIZE * R2.phase1TargetPercent) / 100;
const DAILY = (SIZE * R2.dailyDrawdownPercent) / 100;
const MAXL = (SIZE * R2.overallDrawdownPercent) / 100;
const EQUITY = [0, 0.07, 0.03, 0.17, 0.26, 0.22, 0.41, 0.5, 0.46, 0.63, 0.72, 0.68, 0.8, 0.88, 0.85, 0.93, 0.97].map((k) => SIZE + Math.round(TARGET * k));
const BAL = EQUITY.at(-1);
const usd0 = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

function EquityChart() {
  const w = 320;
  const h = 90;
  const min = Math.min(...EQUITY) - TARGET * 0.08;
  const max = SIZE + TARGET * 1.08;
  const pts = EQUITY.map((v, i) => [(i / (EQUITY.length - 1)) * w, h - ((v - min) / (max - min)) * h]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const target = h - ((SIZE + TARGET - min) / (max - min)) * h;
  return (
    <svg className="hw-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="hwFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2563eb" stopOpacity=".28" />
          <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={w} y1={target} y2={target} className="hw-target" />
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill="url(#hwFill)" />
      <path d={line} className="hw-line" />
    </svg>
  );
}

function Objective({ label, value, pct, ok, warn }) {
  return (
    <div className="hw-obj">
      <span className={`hw-check ${ok ? "ok" : ""}`}>{ok ? <Check size={11} strokeWidth={3} /> : null}</span>
      <span className="hw-obj-l">{label}</span>
      <span className="hw-obj-v">{value}</span>
      <i className={warn ? "warn" : ""}>
        <em style={{ width: `${pct}%` }} />
      </i>
    </div>
  );
}

function StepScreen({ step }) {
  if (step === 0)
    return (
      <div className="hw-screen">
        <div className="hw-h">New challenge</div>
        <div className="hw-seg">
          <span>1-Step</span>
          <span className="on">2-Step</span>
          <span>Instant</span>
        </div>
        <div className="hw-label">Account size</div>
        <div className="hw-sizes">
          {["$10K", "$25K", "$50K", "$100K", "$200K"].map((v) => (
            <span key={v} className={v === "$100K" ? "on" : ""}>
              {v}
            </span>
          ))}
        </div>
        <div className="hw-label">Platform</div>
        <div className="hw-row">
          <span className="hw-plat">MT5</span>
          <span className="rd-muted">MetaTrader 5 · demo server</span>
        </div>
        <div className="hw-summary">
          <div>
            <span>Profit target</span>
            <b>{R2.phase1TargetPercent}% / {R2.phase2TargetPercent}%</b>
          </div>
          <div>
            <span>Max loss</span>
            <b>{R2.overallDrawdownPercent}%</b>
          </div>
          <div>
            <span>Time limit</span>
            <b>None</b>
          </div>
        </div>
      </div>
    );
  if (step === 1)
    return (
      <div className="hw-screen">
        <div className="hw-acct">
          <div>
            <span className="rd-muted">Phase 1 · #51842</span>
            <b>{fmtMoney(BAL)}</b>
          </div>
          <span className="rd-status review">Active</span>
        </div>
        <EquityChart />
        <Objective label="Profit target" value={`${usd0(BAL - SIZE)} / ${usd0(TARGET)}`} pct={((BAL - SIZE) / TARGET) * 100} />
        <Objective label="Daily loss" value={`$410 / ${usd0(DAILY)}`} pct={(410 / DAILY) * 100} ok warn />
        <Objective label="Max loss" value={`$0 / ${usd0(MAXL)}`} pct={0} ok warn />
        <Objective label="Winning days" value={`4 / ${R2.minTradingDaysEvaluation}`} pct={100} ok />
      </div>
    );
  if (step === 2)
    return (
      <div className="hw-screen">
        <div className="hw-h">Account status</div>
        <ol className="hw-timeline">
          {[
            ["Phase 1 passed", "Profit target reached in 11 days"],
            ["Phase 2 passed", "All objectives met"],
            ["KYC verified", "Identity check approved"],
            ["Qualified account issued", "$100K simulated account is live"],
          ].map(([t, s], i) => (
            <li key={t} className={i === 3 ? "now" : "done"}>
              <span className="rd-dot">
                <Check size={12} strokeWidth={3} />
              </span>
              <div>
                <b>{t}</b>
                <small>{s}</small>
              </div>
            </li>
          ))}
        </ol>
        <div className="hw-cred">
          <div>
            <span>Login</span>
            <b>7340 1129</b>
          </div>
          <div>
            <span>Server</span>
            <b>MT5 · Demo</b>
          </div>
          <div>
            <span>Password</span>
            <b>••••••••</b>
          </div>
        </div>
      </div>
    );
  return (
    <div className="hw-screen">
      <div className="hw-acct">
        <div>
          <span className="rd-muted">Reward #R-20931 · paid</span>
          <b>{fmtMoney(2936.4)}</b>
        </div>
        <span className="rd-status paid">Paid</span>
      </div>
      <div className="hw-summary col">
        <div>
          <span>Profit</span>
          <b>{fmtMoney(3262.67)}</b>
        </div>
        <div>
          <span>Your share</span>
          <b>90%</b>
        </div>
        <div>
          <span>Method</span>
          <b>USDT · TRC20</b>
        </div>
        <div>
          <span>Sent to</span>
          <b>TQ8x…f3Ka</b>
        </div>
        <div>
          <span>Next cycle</span>
          <b>in 14 days</b>
        </div>
      </div>
    </div>
  );
}

const STEP_PATHS = ["challenges/new", "accounts/51842", "accounts/51842/status", "rewards/R-20931"];

export function HowItWorks() {
  const [open, setOpen] = useState(0);
  const steps = site.steps;
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setOpen((o) => (o + 1) % steps.length), 6000);
    return () => clearInterval(t);
  }, [open, steps.length]);

  return (
    <section className="uc-sec" id="steps">
      <div className="container">
        <Title>How it works</Title>
        <div className="uc-how">
          <div className="hw-art" aria-hidden="true">
            <AppWindow path={STEP_PATHS[open]}>
              <div key={open} className="hw-fade">
                <StepScreen step={open} />
              </div>
            </AppWindow>
          </div>
          <div className="uc-how-list">
            {steps.map((s, i) => (
              <button key={s.title} type="button" className={`uc-how-item ${i === open ? "open" : ""}`} onClick={() => setOpen(i)} aria-expanded={i === open}>
                <span className="uc-how-h">
                  <span className="hw-num">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </span>
                <span className="uc-how-p">{s.text}</span>
                <span className="uc-how-bar">
                  <span key={open} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── 5. Trade your way ───────── */

const QUOTES = [
  { sym: "BTCUSD", name: "Bitcoin", cat: "BTC/USD", px: 67412.5, dp: 1, chg: 1.18 },
  { sym: "XAUUSD", name: "Gold", cat: "Metals", px: 2405.12, dp: 2, chg: 0.64 },
  { sym: "EURUSD", name: "EUR/USD", cat: "Currencies", px: 1.08452, dp: 5, chg: 0.15 },
  { sym: "NAS100", name: "Nasdaq", cat: "Indices", px: 18245.3, dp: 1, chg: -0.32 },
];

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const CANDLES = (() => {
  const r = rng(42);
  let p = 50;
  return Array.from({ length: 34 }, () => {
    const o = p;
    const c = o + (r() - 0.45) * 9;
    const hi = Math.max(o, c) + r() * 4;
    const lo = Math.min(o, c) - r() * 4;
    p = c;
    return { o, c, hi, lo };
  });
})();

function CandleChart() {
  const min = Math.min(...CANDLES.map((c) => c.lo));
  const max = Math.max(...CANDLES.map((c) => c.hi));
  const H = 220;
  const y = (v) => H - ((v - min) / (max - min)) * (H - 20) - 10;
  const last = CANDLES.at(-1).c;
  return (
    <svg className="uc-candles" viewBox="0 0 440 220" preserveAspectRatio="none" aria-hidden="true">
      {[0.25, 0.5, 0.75].map((g) => (
        <line key={g} x1="0" x2="440" y1={H * g} y2={H * g} stroke="currentColor" strokeOpacity=".08" />
      ))}
      <line x1="0" x2="440" y1={y(last)} y2={y(last)} stroke="#60a5fa" strokeOpacity=".5" strokeDasharray="3 3" />
      {CANDLES.map((c, i) => {
        const x = 8 + i * 12.6;
        const up = c.c >= c.o;
        const col = up ? "#60a5fa" : "#f87171";
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(c.hi)} y2={y(c.lo)} stroke={col} strokeWidth="1" />
            <rect x={x - 3.5} width="7" y={y(Math.max(c.o, c.c))} height={Math.max(1.5, Math.abs(y(c.o) - y(c.c)))} fill={col} rx="1" />
          </g>
        );
      })}
    </svg>
  );
}

export function TradeYourWay() {
  const quotes = useTicker(QUOTES);
  return (
    <section className="uc-sec" id="markets">
      <div className="container">
        <Title>Trade your way</Title>
        <div className="uc-tw">
          <div className="uc-card" data-reveal>
            <h3 className="uc-card-h lg">Global markets</h3>
            <p className="uc-card-p">Go long or short on {site.markets.join(", ").toLowerCase()}, priced from live feeds with raw virtual spreads.</p>
            <div className="uc-quotes">
              {quotes.map((q) => (
                <div key={q.sym} className="uc-quote">
                  <div className="uc-quote-top">
                    <span>
                      <AssetIcon symbol={q.sym} size={20} /> {q.name}
                    </span>
                    <em>{q.cat}</em>
                  </div>
                  <div className="uc-quote-mid">
                    <b key={q.tick} className={q.dir ? `flash-${q.dir}` : ""}>
                      {q.px.toLocaleString("en-US", { minimumFractionDigits: q.dp, maximumFractionDigits: q.dp })}
                    </b>
                    <span className={q.chg >= 0 ? "up" : "down"}>
                      {q.chg >= 0 ? "↑ +" : "↓ "}
                      {q.chg.toFixed(2)}%
                    </span>
                  </div>
                  <div className="uc-quote-btns">
                    <span className="long">Long</span>
                    <span className="short">Short</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="uc-card" data-reveal>
            <h3 className="uc-card-h lg">Pro-grade charting</h3>
            <p className="uc-card-p">Run your edge on {site.platforms.join(", ")} with the indicators, EAs and order types you already know.</p>
            <div className="uc-chart">
              <div className="uc-chart-head">
                <span className="uc-chart-sym">
                  <AssetIcon symbol="NAS100" size={20} /> NAS100
                </span>
                {["5m", "15m", "1h", "1d"].map((tf, i) => (
                  <span key={tf} className={`uc-tf ${i === 1 ? "on" : ""}`}>
                    {tf}
                  </span>
                ))}
                <span className="uc-chart-px">
                  {quotes[3].px.toFixed(1)}
                  <small className={quotes[3].chg >= 0 ? "up" : "down"}>
                    {quotes[3].chg >= 0 ? "+" : ""}
                    {quotes[3].chg.toFixed(2)}%
                  </small>
                </span>
              </div>
              <CandleChart />
            </div>
          </div>

          <div className="uc-card" data-reveal>
            <h3 className="uc-card-h lg">Rules you can track live</h3>
            <p className="uc-card-p">Every limit is visible on your dashboard in real time, so you always know where you stand.</p>
            <div className="uc-rules">
              {[
                ["Profit target", `${R1.phase1TargetPercent}%`, 72, "g"],
                ["Daily loss limit", `${R1.dailyDrawdownPercent}%`, 22, "r"],
                ["Max loss (static)", `${R1.overallDrawdownPercent}%`, 35, "r"],
                ["Minimum trading days", `${R1.minTradingDaysEvaluation} / ${R1.minTradingDaysEvaluation}`, 100, "p"],
              ].map(([k, v, w, c]) => (
                <div key={k} className="uc-rule">
                  <div>
                    <span>{k}</span>
                    <b>{v}</b>
                  </div>
                  <span className={`uc-rule-bar ${c}`}>
                    <span style={{ width: `${w}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="uc-card" data-reveal>
            <h3 className="uc-card-h lg">Pay and get paid your way</h3>
            <p className="uc-card-p">One-time program fee by card, wallet or crypto. Rewards out in USDT or by bank transfer.</p>
            <div className="uc-pay">
              {site.payments.map((p) => {
                const Ic = PAY_ICONS[p];
                return (
                  <span key={p} className="uc-pay-item">
                    {Ic && <Ic size={22} />}
                    {p}
                  </span>
                );
              })}
            </div>
            <span className="uc-card-meta">
              <Headphones size={14} /> {site.payouts.note}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── 6. Final CTA ───────── */

export function HomeCta() {
  const f = site.finalCta;
  return (
    <section className="uc-sec uc-final">
      <div className="uc-final-glow" aria-hidden="true" />
      <div className="container center" data-reveal>
        <h2 className="uc-title">{f.title}</h2>
        <p className="uc-title-sub">{f.sub}</p>
        <div className="uc-final-btns">
          <a href={site.links.start} className="uc-btn uc-btn-white">
            Start your challenge <ArrowRight size={18} />
          </a>
          <a href="/rules" className="uc-btn uc-btn-ghost">
            Read the rules
          </a>
        </div>
      </div>
    </section>
  );
}
