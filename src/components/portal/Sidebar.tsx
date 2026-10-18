"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import { navGroups as traderNav, type NavItem } from "@/lib/nav";
import { site } from "@/site.config";
import { LogoMark } from "@/components/ui";
import { cx, iconBtn } from "./ui";

export default function Sidebar({
  open,
  collapsed,
  onClose,
  groups = traderNav,
  homeHref = "/dashboard",
  subtitle = "Trader Portal",
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  groups?: { label: string; items: NavItem[] }[];
  homeHref?: string;
  subtitle?: string;
}) {
  const path = usePathname();
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-line bg-surface transition-[transform,width] duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          collapsed && "lg:w-[76px]"
        )}
        aria-label="Sidebar"
      >
        <div className={cx("flex h-16 shrink-0 items-center gap-3 px-5", collapsed && "lg:justify-center lg:px-0")}>
          <Link href={homeHref} className="flex items-center gap-2.5" aria-label={`${site.name} ${subtitle}`}>
            <LogoMark className="size-9 shrink-0" />
            <span className={cx("leading-tight", collapsed && "lg:hidden")}>
              <span className="block text-[15px] font-extrabold tracking-wide text-ink">{site.wordmark}</span>
              <span className="block text-[11px] font-medium text-muted">{subtitle}</span>
            </span>
          </Link>
          <button type="button" className={cx(iconBtn, "ml-auto lg:hidden")} aria-label="Close menu" onClick={onClose}>
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          {groups.map((g, gi) => (
            <div key={g.label} className={cx(gi > 0 && "mt-3 border-t border-line pt-1")}>
              <p className={cx("px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted", collapsed && "lg:hidden")}>
                {g.label}
              </p>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const active = !it.external && (path === it.href || (it.href !== homeHref && path.startsWith(it.href + "/")));
                  const Icon = it.icon;
                  return (
                    <li key={it.label}>
                      <Link
                        href={it.href}
                        onClick={onClose}
                        target={it.external ? "_blank" : undefined}
                        title={collapsed ? it.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition",
                          active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/70 hover:text-ink",
                          collapsed && "lg:justify-center lg:px-0"
                        )}
                      >
                        <Icon size={19} strokeWidth={1.75} className="shrink-0" />
                        <span className={cx("truncate", collapsed && "lg:hidden")}>{it.label}</span>
                        {it.external && <ArrowUpRight size={14} className={cx("ml-auto", collapsed && "lg:hidden")} />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
