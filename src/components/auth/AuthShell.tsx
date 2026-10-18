import type { ReactNode } from "react";
import { site } from "@/site.config";
import { ChartBg, LogoMark } from "@/components/ui";

/* Dark full-page frame with a centered card, shared by sign-in / sign-up / verify. */
export default function AuthShell({ title, sub, children, footer }: { title: string; sub?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth dark-band">
      <ChartBg seed={21} />
      <div className="auth-in">
        <a href="/" className="logo auth-logo" aria-label={`${site.name} home`}>
          <LogoMark />
          <span className="logo-name">{site.wordmark}</span>
        </a>
        <section className="auth-card">
          <h1 className="auth-h">{title}</h1>
          {sub && <p className="auth-sub">{sub}</p>}
          {children}
        </section>
        {footer && <p className="auth-foot">{footer}</p>}
      </div>
    </main>
  );
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: unknown, fallback = "/dashboard") {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") && !v.startsWith("/auth") ? v : fallback;
}
