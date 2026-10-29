"use client";
import { useEffect, useState } from "react";
import { site } from "@/site.config";
import { Candles, Rich } from "./ui";

export default function Hero() {
  const slides = site.heroSlides;
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [active, slides.length]);

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true">
        <Candles seed={19} count={60} w={1400} h={600} trend={0.55} mono className="hero-candles" />
        <div className="hero-glow" />
        <div className="hero-overlay" />
      </div>

      <div className="hero-content container">
        <div className="hero-texts">
          {slides.map((s, i) => (
            <div key={i} className={`hero-text ${i === active ? "active" : ""}`} aria-hidden={i !== active}>
              <h1 className="hero-h1">
                <Rich text={s.title} />
              </h1>
              <p className="hero-sub">{s.sub}</p>
            </div>
          ))}
        </div>
        <a href={site.links.start} className="btn btn-primary">
          Start Trading Challenge
        </a>
        <div className="dots" role="tablist">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Slide ${i + 1}`}
              className={`dot ${i === active ? "active" : ""}`}
              onClick={() => setActive(i)}
            />
          ))}
        </div>
      </div>

      <div className="hero-stats">
        <div className="container hero-stats-grid">
          {site.heroStats.map((s) => (
            <div className="stat" key={s.lbl}>
              <div className="num">{s.num}</div>
              <div className="lbl">{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
