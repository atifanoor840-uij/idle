"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { MailCheck, MessageCircle, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/propApi";
import { site } from "@/site.config";
import { SessionProvider, type SessionUser } from "./SessionContext";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { btnPrimary, btnSecondary, cx, iconBtn } from "./ui";

/* Nudges, in order: unverified email → KYC needed for payouts. */
function CompletionBanner({ user }: { user: SessionUser }) {
  const [hidden, setHidden] = useState(false);
  const [kycNeeded, setKycNeeded] = useState(false);
  const [resent, setResent] = useState<"" | "sending" | "sent" | "failed">("");

  useEffect(() => {
    if (!user.emailVerified) return;
    api.kyc
      .get()
      .then((r) => setKycNeeded(r.isEligible && r.kyc?.status !== "approved"))
      .catch(() => {});
  }, [user.emailVerified]);

  const resend = async () => {
    setResent("sending");
    try {
      await api.auth.resendVerification(user.email);
      setResent("sent");
    } catch {
      setResent("failed");
    }
  };

  if (hidden || (user.emailVerified && !kycNeeded)) return null;
  const email = !user.emailVerified;
  const Icon = email ? MailCheck : ShieldCheck;
  return (
    <div className="border-b border-brand/40 bg-brand-soft">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center md:px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-brand-strong">
            <Icon size={20} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-ink">{email ? "Verify your email address" : "Verify your identity"}</p>
            <p className="text-[13px] text-ink-2">
              {email
                ? resent === "sent"
                  ? `We sent a new link to ${user.email}.`
                  : resent === "failed"
                    ? "We couldn't send the email right now. Try again in a minute."
                    : `Click the link we sent to ${user.email} to secure your account.`
                : "KYC is required before you can request a payout from your funded account."}
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          {email ? (
            <button type="button" onClick={resend} disabled={resent === "sending" || resent === "sent"} className={btnSecondary}>
              {resent === "sending" ? "Sending…" : "Resend email"}
            </button>
          ) : (
            <Link href="/profile" className={btnPrimary}>
              Start verification
            </Link>
          )}
          <button type="button" className={iconBtn} aria-label="Dismiss" onClick={() => setHidden(true)}>
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Shell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const onMenu = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((c) => !c);
    else setDrawer(true);
  };

  return (
    <SessionProvider user={user}>
    <div className="min-h-dvh bg-canvas">
      <Sidebar open={drawer} collapsed={collapsed} onClose={() => setDrawer(false)} />
      <div className={cx("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")}>
        <Topbar onMenu={onMenu} />
        <CompletionBanner user={user} />
        <main className="mx-auto w-full max-w-[1280px] px-3.5 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6">
          {children}
          <footer className="mt-10 border-t border-line pb-16 pt-6 text-[12.5px] leading-relaxed text-muted sm:pb-6">
            <p>
              <strong className="text-ink-2">Educational &amp; Simulated Trading Disclaimer:</strong> All {site.name} accounts are simulated evaluation accounts using virtual funds. Nothing in this portal is investment advice or involves real client capital.
            </p>
            <p className="mt-2">
              © {site.year} {site.company}
            </p>
          </footer>
        </main>
      </div>
      <button
        type="button"
        aria-label="Open support chat"
        className="fixed bottom-4 right-4 z-30 inline-flex size-12 items-center justify-center rounded-full bg-[#111318] text-white shadow-lg transition hover:scale-105 sm:bottom-5 sm:right-5 sm:size-14 dark:bg-[#2a2f38]"
      >
        <MessageCircle size={22} strokeWidth={1.75} />
      </button>
    </div>
    </SessionProvider>
  );
}
