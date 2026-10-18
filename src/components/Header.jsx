"use client";
import { useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { site } from "@/site.config";
import { LogoMark } from "./ui";

export function TopBar() {
  return (
    <div className="topbar">
      <div className="container topbar-in">
        <div className="tb-left">
          <a href={site.links.login}>Client</a>
          <span>|</span>
          <a href="/affiliates">Partners</a>
          <span>|</span>
          <a href="/faq">FAQ</a>
        </div>
        <div className="tb-right">
          <a href={site.promo.href} className="tb-promo">
            <span className="badge">NEW</span>
            {site.promo.text}
          </a>
          <a href="#">Social</a>
          <a href={site.links.platform}>Web Platform</a>
          <a href={site.links.start}>Start Challenge</a>
          {site.links.trial && <a href={site.links.trial}>Free Trial</a>}
          <a href={site.links.contact}>Contact Us</a>
          <a href="#" className="tb-lang">
            EN <ChevronDown size={12} />
          </a>
        </div>
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
          <LogoMark />
          <span>
            <span className="logo-name">{site.wordmark}</span>
            <span className="logo-tag">
              {site.tagline[0]}
              <br />
              {site.tagline[1]}
            </span>
          </span>
        </a>

        {site.sponsorship && (
          <a href={site.sponsorship.href} className="nav-sponsor">
            {site.sponsorship.text} <span className="badge">NEW</span>
          </a>
        )}

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
          <a href={site.links.start} className="btn btn-primary btn-sm">
            Start Challenge
          </a>
          <a href={site.links.login} className="btn btn-outline btn-sm nav-login">
            Client Login
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
