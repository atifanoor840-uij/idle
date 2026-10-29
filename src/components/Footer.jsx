import { Facebook, Instagram, Twitter } from "lucide-react";
import { site } from "@/site.config";
import { LogoMark } from "./ui";

const SOCIAL = { x: Twitter, instagram: Instagram, facebook: Facebook };

export default function Footer() {
  const f = site.footer;
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="/" className="logo" aria-label={site.name}>
              <img src="/logo.png" alt={site.name} className="logo-img" />
            </a>
            <p>{f.mission}</p>
            <div className="socials">
              {f.social.map((s) => {
                const Icon = SOCIAL[s.icon];
                return (
                  <a key={s.label} href={s.href} aria-label={s.label} className="social">
                    <Icon size={16} color="#fff" />
                  </a>
                );
              })}
            </div>
            <span className="platform-badge">{site.platforms[0]}</span>
          </div>
          {f.columns.map((c) => (
            <div key={c.title}>
              <h4 className="footer-h">{c.title}</h4>
              <ul className="footer-links">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="legal">
          {f.educationalDisclaimer && (
            <p>
              <strong>Educational &amp; Simulated Trading Disclaimer:</strong> {f.educationalDisclaimer}
            </p>
          )}
          <p>
            <strong>Risk &amp; Educational Disclosure:</strong> {f.riskWarning}
          </p>
          <p>
            <strong>Restricted Jurisdictions:</strong> {f.restricted}{" "}
            <a href="/terms">Terms of Service</a> · <a href="/privacy">Privacy Policy</a> ·{" "}
            <a href="/risk-disclosure">Risk Disclosure</a>
          </p>
        </div>

        <div className="footer-bottom">
          © {site.year} {site.company} ({site.name}) · Educational &amp; Simulated Trading Platform · All rights reserved
        </div>
      </div>
    </footer>
  );
}
