"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Globe, LayoutGrid, LogOut, Menu, Moon, Sun, UserRound } from "lucide-react";
import { api } from "@/lib/propApi";
import { initialsOf, useSessionUser } from "./SessionContext";
import { btnPrimary, iconBtn } from "./ui";

function AccountMenu() {
  const user = useSessionUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const signOut = async () => {
    setBusy(true);
    try {
      await api.auth.signout();
    } finally {
      window.location.href = "/auth/signin";
    }
  };

  return (
    <div ref={ref} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex size-9 items-center justify-center rounded-full bg-[#111318] text-[13px] font-semibold text-white dark:bg-[#2a2f38]"
        aria-label="Account menu"
      >
        {initialsOf(user.name)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-64 max-w-[calc(100vw-2rem)] rounded-tile border border-line bg-surface p-2 shadow-lg">
          <div className="border-b border-line px-3 pb-3 pt-2">
            <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[12.5px] text-muted">{user.email}</p>
          </div>
          <Link role="menuitem" href="/profile" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] text-ink-2 hover:bg-surface-2">
            <UserRound size={16} /> Profile & KYC
          </Link>
          <button role="menuitem" type="button" onClick={signOut} disabled={busy} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] text-danger hover:bg-surface-2">
            <LogOut size={16} /> {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ onMenu }: { onMenu: () => void }) {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("portal-theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface px-4 md:px-6">
      <button type="button" className={iconBtn} aria-label="Toggle menu" onClick={onMenu}>
        <Menu size={20} strokeWidth={1.75} />
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <Link href="/challenges" className={`${btnPrimary} max-sm:hidden`}>
          Start a Challenge <ArrowRight size={16} />
        </Link>
        <button type="button" className={iconBtn} aria-label="Apps">
          <LayoutGrid size={19} strokeWidth={1.75} />
        </button>
        <button type="button" className={iconBtn} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggleTheme}>
          {dark ? <Sun size={19} strokeWidth={1.75} /> : <Moon size={19} strokeWidth={1.75} />}
        </button>
        <label className="relative hidden items-center md:flex">
          <Globe size={17} strokeWidth={1.75} className="pointer-events-none absolute left-3 text-muted" />
          <span className="sr-only">Language</span>
          <select className="h-10 appearance-none rounded-full border border-line bg-surface pl-9 pr-4 text-[14px] font-medium text-ink-2 outline-none">
            <option>English</option>
            <option>Español</option>
            <option>العربية</option>
            <option>اردو</option>
          </select>
        </label>
        <AccountMenu />
      </div>
    </header>
  );
}
