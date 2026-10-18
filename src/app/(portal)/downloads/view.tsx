"use client";
import Link from "next/link";
import { Apple, BookOpen, FileText, Globe, KeyRound, Monitor, Smartphone } from "lucide-react";
import { downloads } from "@/lib/mock-pages";
import { Card, cx } from "@/components/portal/ui";
import { PageHeader } from "@/components/portal/kit";

const OS_ICON: Record<string, typeof Monitor> = { Windows: Monitor, macOS: Apple, Android: Smartphone, iOS: Smartphone, Web: Globe };

function PlatformMark({ name }: { name: string }) {
  const initials = name === "MT4" ? "4" : name === "cTrader" ? "cT" : "5";
  return (
    <span className="inline-flex size-12 items-center justify-center rounded-tile bg-[#111318] text-[17px] font-extrabold text-brand dark:bg-surface-2">{initials}</span>
  );
}

export default function DownloadsView() {
  return (
    <div className="space-y-5">
      <PageHeader title="Downloads" sub="Install your trading platform, then log in with the credentials from My Accounts." />

      <div className="grid gap-4 lg:grid-cols-3">
        {downloads.map((p) => (
          <Card key={p.name} className="flex flex-col">
            <div className="flex items-center gap-3">
              <PlatformMark name={p.name} />
              <div>
                <p className="text-[17px] font-semibold text-ink">{p.name === "MT5" ? "MetaTrader 5" : p.name}</p>
                <p className="text-[13px] text-muted">{p.os.length} platforms</p>
              </div>
            </div>
            <p className="mt-4 flex-1 text-[14px] text-ink-2">{p.desc}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {p.os.map((os) => {
                const Icon = OS_ICON[os] ?? Monitor;
                return (
                  <a
                    key={os}
                    href="#"
                    className={cx(
                      "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line text-[14px] font-medium text-ink transition hover:border-ink hover:bg-surface-2",
                      os === "Web" && "col-span-2 border-ink"
                    )}
                  >
                    <Icon size={16} strokeWidth={1.75} /> {os === "Web" ? "Open Web Terminal" : os}
                  </a>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Card title="Helpful resources">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: KeyRound, title: "Where are my login details?", text: "Open My Accounts and click Credentials on any account.", href: "/accounts" },
            { icon: BookOpen, title: "Platform setup guide", text: "Step-by-step setup for MT5, MT4 and cTrader.", href: "#" },
            { icon: FileText, title: "Trading rules (PDF)", text: "The full rulebook for every program on one page.", href: "#" },
          ].map((r) => (
            <Link key={r.title} href={r.href} className="flex items-start gap-3 rounded-tile bg-surface-2 p-4 transition hover:ring-1 hover:ring-line">
              <r.icon size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand-strong" />
              <span>
                <span className="block text-[14px] font-semibold text-ink">{r.title}</span>
                <span className="text-[13px] text-muted">{r.text}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
