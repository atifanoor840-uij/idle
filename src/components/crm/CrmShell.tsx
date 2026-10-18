"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, LogOut, Menu, Moon, Sun } from "lucide-react";
import { crmNav } from "@/lib/crmNav";
import { api } from "@/lib/propApi";
import Sidebar from "@/components/portal/Sidebar";
import { initialsOf, SessionProvider, type SessionUser } from "@/components/portal/SessionContext";
import { cx, iconBtn } from "@/components/portal/ui";

export default function CrmShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const onMenu = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) setCollapsed((c) => !c);
    else setDrawer(true);
  };
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("portal-theme", next ? "dark" : "light");
    } catch {}
  };
  const signOut = async () => {
    try {
      await api.auth.signout();
    } finally {
      window.location.href = "/auth/admin";
    }
  };

  return (
    <SessionProvider user={user}>
      <div className="min-h-dvh bg-canvas">
        <Sidebar open={drawer} collapsed={collapsed} onClose={() => setDrawer(false)} groups={crmNav} homeHref="/admin" subtitle="Admin CRM" />
        <div className={cx("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[248px]")}>
          <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface px-4 md:px-6">
            <button type="button" className={iconBtn} aria-label="Toggle menu" onClick={onMenu}>
              <Menu size={20} strokeWidth={1.75} />
            </button>
            <span className="rounded-full bg-danger/10 px-2.5 py-1 text-[12px] font-semibold text-danger">Admin</span>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <Link href="/" target="_blank" className="hidden items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink sm:inline-flex">
                View site <ExternalLink size={14} />
              </Link>
              <button type="button" className={iconBtn} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>
                {dark ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
              </button>
              <span className="hidden text-right text-[13px] leading-tight md:block">
                <span className="block font-semibold text-ink">{user.name}</span>
                <span className="block text-muted">{user.email}</span>
              </span>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#111318] text-[13px] font-semibold text-white dark:bg-[#2a2f38]" aria-hidden="true">
                {initialsOf(user.name)}
              </span>
              <button type="button" onClick={signOut} className={iconBtn} aria-label="Sign out" title="Sign out">
                <LogOut size={18} />
              </button>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1400px] px-4 py-5 md:px-6 md:py-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
