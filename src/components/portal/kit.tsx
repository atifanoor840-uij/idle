"use client";
import { useState, type ReactNode } from "react";
import { Lock, X } from "lucide-react";
import { cx } from "./ui";

/* ── Form primitives ── */
export const inputCls =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none transition placeholder:text-muted focus:border-brand-strong focus:ring-2 focus:ring-brand/30";
export const labelCls = "mb-1.5 block text-[13px] font-medium text-ink-2";

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
    </label>
  );
}

/* ── Tables ── */
export const tableWrap = "overflow-auto rounded-tile border border-line";
export const thCls = "whitespace-nowrap px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide text-muted";
export const tdCls = "whitespace-nowrap px-4 py-3 text-[14px]";
export const trCls = "border-t border-line";

/* ── Badges ── */
export type Tone = "success" | "brand" | "danger" | "warning" | "neutral";
const TONES: Record<Tone, string> = {
  success: "bg-success/12 text-success",
  brand: "bg-brand-soft text-brand-strong",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/15 text-warning-strong",
  neutral: "bg-surface-2 text-ink-2 ring-1 ring-line",
};
export function toneFor(status: string): Tone {
  if (["Active", "Paid", "Completed", "Live", "Approved", "Available"].includes(status)) return "success";
  if (["Passed", "Upcoming", "Joined"].includes(status)) return "brand";
  if (["Breached", "Rejected", "Failed"].includes(status)) return "danger";
  if (["Pending", "Processing", "In review"].includes(status)) return "warning";
  return "neutral";
}
export function Badge({ children, tone }: { children: ReactNode; tone?: Tone }) {
  const t = tone ?? toneFor(String(children));
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold", TONES[t])}>{children}</span>;
}
export function LockedBadge() {
  return (
    <Badge tone="neutral">
      <Lock size={12} /> Locked
    </Badge>
  );
}

/* ── Tabs (2px brand underline) ── */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (k: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex gap-6 overflow-x-auto overflow-y-hidden border-b border-line", className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 pb-3 text-[14px] font-medium transition",
            value === t.key ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cx("rounded-full px-1.5 text-[11px] font-semibold", value === t.key ? "bg-brand-soft text-brand-strong" : "bg-surface-2 text-muted")}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Segmented selector (equal-width tiles) ── */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  render,
  cols,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => ReactNode;
  cols?: string;
  label?: string;
}) {
  return (
    <div className={cx("grid gap-2", cols ?? "grid-cols-3")} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={cx(
            "flex h-11 items-center justify-center gap-2 rounded-tile border px-2 text-center text-[13.5px] font-semibold leading-tight transition",
            value === o ? "border-ink bg-surface-2 text-ink" : "border-line bg-surface text-ink-2 hover:border-muted"
          )}
        >
          {render ? render(o) : String(o)}
        </button>
      ))}
    </div>
  );
}

/* ── Toggle switch ── */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative inline-flex h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-brand" : "bg-line")}
    >
      <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/* ── Notice strip ── */
export function NoticeStrip({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "warning" }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className={cx("flex items-center gap-3 rounded-card px-5 py-4", tone === "brand" ? "bg-brand-soft" : "bg-warning/15")}>
      <p className="flex-1 text-[14px] font-semibold text-ink">{children}</p>
      <button type="button" aria-label="Dismiss notice" onClick={() => setOpen(false)} className="inline-flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-black/5">
        <X size={16} />
      </button>
    </div>
  );
}

/* ── Key/value line, used in method tiles & summaries ── */
export function KV({ k, v, className }: { k: ReactNode; v: ReactNode; className?: string }) {
  return (
    <p className={cx("flex items-center justify-between gap-3 text-[14px]", className)}>
      <span className="text-muted">{k}</span>
      <span className="text-right font-semibold text-ink">{v}</span>
    </p>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold text-ink md:text-[24px]">{title}</h1>
        {sub && <p className="mt-0.5 text-[14px] text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* Escape user/server text before putting it into generated HTML or SVG */
export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/* Download helper used for CSV exports, invoices and certificates */
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toCSV(rows: Record<string, string | number | undefined>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}
