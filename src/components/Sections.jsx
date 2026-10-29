import { BarChart3, Timer, TrendingUp, Wallet } from "lucide-react";
import { SiApplepay, SiBitcoin, SiGooglepay, SiMastercard, SiTether, SiVisa } from "react-icons/si";
import { site } from "@/site.config";
import { ChartBg, Checklist, Laptop, Monitor, Phone, Rich } from "./ui";

const GHOST_ICONS = { timer: Timer, wallet: Wallet };
const PAY_ICONS = {
  VISA: SiVisa,
  Mastercard: SiMastercard,
  "Apple Pay": SiApplepay,
  "Google Pay": SiGooglepay,
  Bitcoin: SiBitcoin,
  USDT: SiTether,
};

function Stats({ stats }) {
  return stats.map((s) => (
    <div className="stat stat-center" key={s.lbl} data-reveal>
      {s.pre && <div className="stat-pre">{s.pre}</div>}
      <div className="num">{s.num}</div>
      <div className="lbl">{s.lbl}</div>
    </div>
  ));
}

/* 4. Feature cards */
export function FeatureCards() {
  const f = site.feature;
  return (
    <section className="section" id="challenges">
      <div className="container stack">
        <div className="card card-wide" data-reveal>
          <span className="ghost ghost-num" aria-hidden="true">
            {f.ghost}
          </span>
          <div>
            <h2 className="h2">
              <Rich text={f.title} />
            </h2>
            <Checklist items={f.items} />
            <a href={site.links.start} className="btn btn-grey">
              {f.cta}
            </a>
          </div>
          <div className="phone-wrap">
            <Phone variant="account" />
            <div className="tooltip">
              <span className="tooltip-lbl">Payout approved</span>
              <span className="tooltip-val">$4,120.00</span>
              <span className="tooltip-sub">Split 90% · sent to USDT</span>
            </div>
          </div>
        </div>

        <div className="cards-2">
          {site.featureHalf.map((c) => {
            const Icon = GHOST_ICONS[c.icon];
            return (
              <div className="card" key={c.title} data-reveal>
                <Icon className="ghost" strokeWidth={1.25} aria-hidden="true" />
                <h2 className="h2">{c.title}</h2>
                <Checklist items={c.items} />
                <a href={c.href} className="btn btn-grey">
                  {c.cta}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* 5. Proof band — visual left, text right */
export function ProofBand() {
  const p = site.proof;
  return (
    <section className="split-band">
      <div className="split-visual">
        <ChartBg seed={12} />
        <Stats stats={p.stats} />
      </div>
      <div className="split-text" data-reveal>
        <h2 className="h2">
          <Rich text={p.title} />
        </h2>
        <p className="p-dark dim">{p.text}</p>
      </div>
    </section>
  );
}

/* 6. Platforms card */
export function PlatformsCard() {
  return (
    <section className="section section-tight" id="platforms">
      <div className="container">
        <div className="card card-2col" data-reveal>
          <div>
            <h2 className="h2">High-Performance Platforms for Your Trading Challenge</h2>
            <div className="platforms">
              {site.platforms.map((p) => (
                <span className="platform-chip" key={p}>
                  {p}
                </span>
              ))}
            </div>
            <Checklist items={site.devices} bold className="cols-2" />
            <a href={site.links.platform} className="btn btn-grey">
              Explore Platforms
            </a>
          </div>
          <div className="devices">
            <Monitor seed={8} className="dev-monitor" />
            <Laptop seed={3} className="dev-laptop" />
            <Phone variant="quotes" className="dev-phone" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* 7. Markets card */
export function MarketsCard() {
  return (
    <section className="section section-tight" id="markets">
      <div className="container">
        <div className="card card-2col" data-reveal>
          <div>
            <h2 className="h2">Trade Global Markets in a Simulated Environment</h2>
            <Checklist items={site.markets} bold className="cols-2" />
            <a href="/rules#instruments" className="btn btn-grey">
              View Instruments
            </a>
          </div>
          <div className="markets-visual">
            <Laptop seed={27} />
            <span className="float-circle fc-white">
              <TrendingUp size={30} color="#000" />
            </span>
            <span className="float-circle fc-green">
              <BarChart3 size={30} color="#000" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 8. Numbers band — text left, visual right */
export function NumbersBand() {
  const n = site.numbers;
  return (
    <section className="split-band reverse">
      <div className="split-text left" data-reveal>
        <h2 className="h2">
          <Rich text={n.title} />
        </h2>
        <p className="p-dark dim">{n.text}</p>
        <div className="btn-row">
          <a href={site.links.start} className="btn btn-primary">
            Start Trading Challenge
          </a>
          <a href={site.links.trial || "/rules"} className="btn btn-outline">
            {site.links.trial ? "Free Trial" : "Read Evaluation Rules"}
          </a>
        </div>
      </div>
      <div className="split-visual">
        <ChartBg seed={31} />
        <Stats stats={n.stats} />
      </div>
    </section>
  );
}

/* 9. Payouts card + payment strip */
export function Payouts() {
  const p = site.payouts;
  const logos = site.payments;
  return (
    <section className="section" id="payouts">
      <div className="container">
        <div className="card card-center" data-reveal>
          <h2 className="h2">{p.title}</h2>
          <Checklist items={p.items} bold className="inline" />
          <a href="/payout-policy" className="btn btn-grey">
            Payout Methods
          </a>
          <p className="note">
            {p.note}{" "}
            <a href="/payout-policy">
              <strong>{p.noteLink}</strong>
            </a>
          </p>
        </div>
      </div>
      <div className="logo-strip">
        <div className="logo-track">
          {[...logos, ...logos].map((l, i) => {
            const PayIcon = PAY_ICONS[l];
            return (
              <span className={`pay-logo ${i >= logos.length ? "dupe" : ""}`} key={i} aria-hidden={i >= logos.length}>
                {PayIcon && <PayIcon size={22} />}
                <span>{l}</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* 10. Steps */
export function Steps() {
  return (
    <section className="section section-top0" id="steps">
      <div className="container center">
        <h2 className="h2" data-reveal>
          Get Funded as a Trader in 4 Evaluation Steps
        </h2>
        <div className="steps">
          {site.steps.map((s, i) => (
            <div className="step" key={s.title} data-reveal>
              <span className="step-num">{i + 1}</span>
              <h3 className="step-title">{s.title}</h3>
              <p className="step-text">{s.text}</p>
            </div>
          ))}
        </div>
        <a href={site.links.start} className="btn btn-primary" data-reveal>
          Start Trading Challenge
        </a>
      </div>
    </section>
  );
}

/* 11. App card */
export function AppCard() {
  const a = site.app;
  return (
    <section className="section section-top0">
      <div className="container">
        <div className="card card-dark card-2col app-card" data-reveal>
          <div className="world-dots" aria-hidden="true" />
          <div>
            <h2 className="h2">
              <Rich text={a.title} />
            </h2>
            <Checklist items={a.items} />
          </div>
          <div className="app-phones">
            <Phone variant="account" className="tilt-l" />
            <Phone variant="quotes" className="tilt-r" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* 12. Discord / webinar banner */
export function Banner() {
  return (
    <section className="section section-top0">
      <div className="container">
        <div className="banner" data-reveal>
          <p>{site.banner.text}</p>
          <a href={site.links.discord} className="btn btn-outline">
            {site.banner.cta}
          </a>
        </div>
      </div>
    </section>
  );
}

/* 13. Final CTA */
export function FinalCta() {
  const f = site.finalCta;
  return (
    <section className="final dark-band">
      <ChartBg seed={44} className="top" />
      <div className="container center final-in" data-reveal>
        <h2 className="h2">{f.title}</h2>
        <p className="final-sub">{f.sub}</p>
        <div className="btn-row center">
          <a href={site.links.start} className="btn btn-primary">
            Start Trading Challenge
          </a>
          <a href={site.links.trial || "/rules"} className="btn btn-outline">
            {site.links.trial ? "Try a Free Trial" : "Read Evaluation Rules"}
          </a>
        </div>
      </div>
    </section>
  );
}
