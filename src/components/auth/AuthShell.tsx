import type { ReactNode } from "react";
import { site } from "@/site.config";
import { ChartBg } from "@/components/ui";

/* Dark full-page frame with a centered card, shared by sign-in / sign-up / verify. */
export default function AuthShell({
  title,
  sub,
  children,
  footer,
}: {
  title: string;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="auth dark-band">
      <ChartBg seed={21} />
      <div className="auth-in">
        <a href="/" className="auth-logo" aria-label={`${site.name} home`}>
          <img
            src="/logo.png"
            alt={site.name}
            className="auth-logo-img"
            width={160}
            height={36}
          />
        </a>

        <section className="auth-card">
          <h1 className="auth-h">{title}</h1>
          {sub && <p className="auth-sub">{sub}</p>}
          {children}
        </section>

        {footer && <div className="auth-foot">{footer}</div>}

        <div className="auth-trust" aria-label="Security guarantee">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>256-Bit SSL Encrypted · Simulated Trading</span>
        </div>
      </div>
    </main>
  );
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: unknown, fallback = "/dashboard") {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") && !v.startsWith("/auth") ? v : fallback;
}
