"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { type Account, type Objective, money } from "@/lib/mock";
import { fmtDate, type UiAccount } from "@/lib/portal-data";
import { btnPrimary, btnSecondary, cx, StatusBadge, Tag } from "./ui";

function ObjectiveBar({ o }: { o: Objective }) {
  const pct = o.target ? Math.min(100, (o.current / o.target) * 100) : 0;
  const fmt = (n: number) => (o.unit === "$" ? money(n, 0) : `${n} days`);
  const breached = o.kind === "limit" && o.current >= o.target;
  const color =
    o.kind === "target" ? "bg-brand" : breached ? "bg-danger" : pct > 70 ? "bg-warning" : "bg-success";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="truncate font-medium text-muted">{o.label}</span>
        <span className={cx("shrink-0 font-semibold tabular-nums", breached ? "text-danger" : "text-ink")}>
          {fmt(o.current)} <span className="font-normal text-muted">/ {fmt(o.target)}</span>
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-label={o.label}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  secret = false,
}: {
  label: string;
  value?: string;
  secret?: boolean;
}) {
  const [visible, setVisible] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const val = value || "—";

  const copyValue = () => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="flex items-center justify-between gap-2 py-2.5 text-[13px]">
      <span className="shrink-0 font-medium text-muted">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <span className="truncate font-mono font-semibold text-ink">
          {visible ? val : value ? "••••••••••" : "—"}
        </span>
        {secret && value && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition hover:border-muted hover:text-ink"
            title={visible ? "Hide password" : "Show password"}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff size={13.5} /> : <Eye size={13.5} />}
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={copyValue}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition hover:border-muted hover:text-ink"
            title="Copy"
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check size={13.5} className="text-success" /> : <Copy size={13.5} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AccountCard({ a }: { a: Account | UiAccount }) {
  const [expanded, setExpanded] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  const ui = a as Partial<UiAccount>;
  const raw = ui.raw;
  const order = ui.order;
  const pnl = a.balance - a.size;
  const floating = a.equity - a.balance;
  const todayPl = raw?.todayPl !== undefined ? Number(raw.todayPl) : floating;
  const gainPct = a.size ? ((pnl / a.size) * 100).toFixed(2) : "0.00";
  const orderId = raw?.orderId || order?.id || "—";
  const createdDate = fmtDate(raw?.createdAt || order?.createdAt);
  const isPending = a.status === "Pending" || ui.pendingDelivery;

  const copyAllCreds = () => {
    if (!raw) return;
    const text = `Platform: ${a.platform}\nLogin: ${raw.login}\nMaster Password: ${raw.passwordMaster}\nInvestor Password: ${raw.passwordInvestor || "—"}\nServer: ${raw.server}`;
    navigator.clipboard?.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  return (
    <article
      className={cx(
        "group rounded-tile border border-line bg-surface p-4 transition-shadow hover:shadow-sm sm:p-5",
        a.status === "Breached" && "opacity-85"
      )}
    >
      {/* Top row: Account identity, badges, and action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 border-b border-line pb-4 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-muted">
                {a.program} · {a.platform}
              </span>
              <span className="text-line">•</span>
              <span className="text-[12.5px] font-medium text-muted">{money(a.size, 0)} account</span>
            </div>
            <p className="mt-0.5 text-[17px] font-bold tracking-tight text-ink sm:text-[18px]">
              {isPending ? "New account" : `#${a.login}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:ml-2">
            <Tag>{a.phase}</Tag>
            <StatusBadge status={a.status} />
          </div>
        </div>

        <div className="grid w-full grid-cols-[1fr_1fr_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-wrap">
          {isPending && (
            <span className="col-span-full inline-flex items-center justify-center gap-1.5 rounded-tile bg-warning/15 px-3 py-1.5 text-[12.5px] font-medium text-warning-strong sm:justify-start">
              <KeyRound size={14} /> Preparing login
            </span>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={cx(btnSecondary, "h-9 px-2.5 text-[12.5px] sm:px-3.5 sm:text-[13px]")}
          >
            <KeyRound size={14} className="shrink-0" />
            <span className="truncate">{expanded ? "Hide credentials" : "See credentials"}</span>
          </button>

          <Link
            href={`/accounts/${encodeURIComponent(a.id)}`}
            className={cx(
              isPending ? btnSecondary : btnPrimary,
              "h-9 px-2.5 text-[12.5px] sm:px-4 sm:text-[13.5px]"
            )}
          >
            <span className="truncate">View details</span> <ArrowRight size={15} className="shrink-0" />
          </Link>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse account details" : "Expand account details"}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition hover:border-muted hover:bg-surface-2 hover:text-ink"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Main row: Balance & Equity metrics + Objectives in one horizontal layout */}
      <div className="mt-4 grid items-center gap-4 sm:gap-5 lg:grid-cols-[320px_1fr]">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <div className="min-w-0 rounded-tile border border-line/60 bg-surface-2/70 p-3 sm:px-3.5 sm:py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted sm:text-[11.5px]">Balance</p>
            <p className="mt-0.5 truncate text-[15.5px] font-bold tabular-nums text-ink sm:text-[18px]">{money(a.balance)}</p>
            <p className={cx("truncate text-[11.5px] font-semibold tabular-nums sm:text-[12px]", pnl >= 0 ? "text-success" : "text-danger")}>
              {pnl >= 0 ? "+" : ""}
              {money(pnl)}
            </p>
          </div>
          <div className="min-w-0 rounded-tile border border-line/60 bg-surface-2/70 p-3 sm:px-3.5 sm:py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted sm:text-[11.5px]">Equity</p>
            <p className="mt-0.5 truncate text-[15.5px] font-bold tabular-nums text-ink sm:text-[18px]">{money(a.equity)}</p>
            <p className="truncate text-[11.5px] tabular-nums text-muted sm:text-[12px]">
              Floating {floating >= 0 ? "+" : ""}
              {money(floating)}
            </p>
          </div>
        </div>

        {a.objectives.length > 0 && (
          <div
            className={cx(
              "grid gap-3.5 sm:grid-cols-2 sm:gap-4",
              a.objectives.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"
            )}
          >
            {a.objectives.map((o) => (
              <ObjectiveBar key={o.label} o={o} />
            ))}
          </div>
        )}
      </div>

      {/* Expanded Drawer: Left = Row-wise Credentials | Right = Account Stats & Order Info */}
      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:mt-5 sm:gap-5 sm:pt-5 lg:grid-cols-2">
          {/* Left column: Row-wise Credentials */}
          <div className="min-w-0 rounded-tile border border-line bg-surface-2/50 p-3.5 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <KeyRound size={15} className="shrink-0 text-brand-strong" />
                <h4 className="text-[12.5px] font-bold uppercase tracking-wider text-ink sm:text-[13px]">
                  Trading Credentials
                </h4>
              </div>
              {!isPending && raw && (
                <button
                  type="button"
                  onClick={copyAllCreds}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:border-muted hover:text-ink"
                >
                  {copiedAll ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  {copiedAll ? "Copied all" : "Copy all"}
                </button>
              )}
            </div>

            {isPending ? (
              <p className="py-6 text-center text-[13px] text-muted">
                Your trading login credentials are being prepared and will appear here shortly.
              </p>
            ) : (
              <div className="divide-y divide-line/70">
                <CredentialRow label="Login ID" value={raw?.login || a.login} />
                <CredentialRow label="Master Password" value={raw?.passwordMaster} secret />
                <CredentialRow label="Investor Password" value={raw?.passwordInvestor} secret />
                <CredentialRow label="Server" value={raw?.server} />
                <CredentialRow label="Platform" value={a.platform} />
              </div>
            )}
          </div>

          {/* Right column: Account Stats, Size, Order ID, Status & Date */}
          <div className="min-w-0 rounded-tile border border-line bg-surface-2/50 p-3.5 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <h4 className="text-[12.5px] font-bold uppercase tracking-wider text-ink sm:text-[13px]">
                Account &amp; Order Details
              </h4>
              <Link
                href={`/accounts/${encodeURIComponent(a.id)}`}
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-strong hover:underline"
              >
                Full analytics <ArrowRight size={13} />
              </Link>
            </div>

            <div className="divide-y divide-line/70 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-muted">Account Size</span>
                <span className="font-semibold text-ink">
                  {money(a.size, 0)} <span className="font-normal text-muted">({a.program})</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-muted">Order ID</span>
                <span className="font-mono font-semibold text-ink">{orderId}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-muted">Status &amp; Phase</span>
                <span className="inline-flex items-center gap-1.5">
                  <Tag>{a.phase}</Tag>
                  <StatusBadge status={a.status} />
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-muted">Created Date</span>
                <span className="font-semibold text-ink">{createdDate}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium text-muted">Today&apos;s P&amp;L / Total Gain</span>
                <span className="font-semibold tabular-nums">
                  <span className={todayPl >= 0 ? "text-success" : "text-danger"}>
                    {todayPl >= 0 ? "+" : ""}
                    {money(todayPl)}
                  </span>
                  <span className="mx-1.5 text-line">·</span>
                  <span className={pnl >= 0 ? "text-success" : "text-danger"}>
                    {pnl >= 0 ? "+" : ""}
                    {gainPct}%
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
