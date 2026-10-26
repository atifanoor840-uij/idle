import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { AccountStatus } from "@/lib/mock";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const btnPrimary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand px-4 text-[14px] font-medium text-brand-ink transition hover:brightness-[.94] disabled:opacity-50";
export const btnSecondary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-ink bg-transparent px-4 text-[14px] font-medium text-ink transition hover:bg-surface-2";
export const iconBtn =
  "inline-flex size-10 items-center justify-center rounded-full text-ink-2 transition hover:bg-surface-2 hover:text-ink";

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("min-w-0 rounded-card bg-surface p-4 sm:p-6 md:p-8", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 sm:mb-5 sm:gap-3">
          {title && <h2 className="text-[16px] font-semibold text-ink-2 sm:text-[17px]">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const STATUS: Record<AccountStatus, string> = {
  Active: "bg-success/12 text-success",
  Passed: "bg-brand-soft text-brand-strong",
  Breached: "bg-danger/10 text-danger",
  Pending: "bg-warning/15 text-warning-strong",
};

export function StatusBadge({ status }: { status: AccountStatus }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold", STATUS[status])}>{status}</span>;
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-semibold text-ink-2">
      {children}
    </span>
  );
}

export function StatTile({ label, value, delta, trend }: { label: string; value: string; delta: string; trend: "up" | "down" | "flat" }) {
  return (
    <div className="min-w-0 rounded-card bg-surface p-4 sm:p-5">
      <p className=" truncate text-[13px] font-medium text-muted">{label}</p>
      <p className="mt-1.5 truncate text-[20px] font-bold text-ink sm:mt-2 sm:text-[24px]">{value}</p>
      <p className={cx("mt-1 truncate text-[12.5px] font-medium", trend === "up" ? "text-success" : trend === "down" ? "text-danger" : "text-muted")}>
        {delta}
      </p>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon size={26} strokeWidth={1.75} />
      </span>
      <p className="text-[17px] font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-sm text-[14px] text-muted">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProgressRing({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand-strong)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span className="absolute text-[10.5px] font-bold text-ink">{value}%</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} />;
}

/* Loading / error placeholder for API-backed sections */
export function LoadState({ loading, error, onRetry, rows = 3 }: { loading: boolean; error?: string; onRetry?: () => void; rows?: number }) {
  if (error) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-danger/10 px-4 py-3 text-[14px] text-danger">
        <span>{error}</span>
        {onRetry && (
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Try again
          </button>
        )}
      </div>
    );
  }
  if (!loading) return null;
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 rounded-tile" />
      ))}
    </div>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  const cls =
    tone === "error"
      ? "bg-danger/10 text-danger"
      : tone === "success"
        ? "bg-success/12 text-success"
        : tone === "warning"
          ? "border border-warning/40 bg-warning/12 text-ink"
          : "bg-brand-soft text-ink";
  return (
    <p role={tone === "error" ? "alert" : "status"} className={cx("rounded-tile px-4 py-3 text-[14px]", cls)}>
      {children}
    </p>
  );
}
