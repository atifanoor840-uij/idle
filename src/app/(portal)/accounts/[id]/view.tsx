"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  Layers,
  Lock,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { money } from "@/lib/mock";
import { api, ApiError } from "@/lib/propApi";
import { fmtDate, toUiAccount, useApi } from "@/lib/portal-data";
import { buildPerformanceSeries, getStatisticsTrades } from "@/lib/tradingStatistics";
import PnlChart from "@/components/portal/PnlChart";
import { btnPrimary, Card, cx, EmptyState, FormMessage, LoadState } from "@/components/portal/ui";

/* ── Shared look (purple dashboard layout, mapped onto the portal's brand tokens) ── */
const card = "rounded-card border border-line bg-surface shadow-[0_2px_10px_0_rgba(0,0,0,0.06)] dark:shadow-[0_2px_10px_0_rgba(0,0,0,0.3)]";
const chip =
  "inline-flex min-h-7 items-center gap-1.5 rounded-[4px] border border-line px-2.5 py-1.5 text-[12px] leading-[14px] font-medium text-ink transition hover:bg-brand-soft hover:text-brand-strong [&_svg]:size-3.5";
const btnOutlineAccent =
  "inline-flex h-[30px] items-center justify-center gap-1 whitespace-nowrap rounded-md border border-line px-3.5 text-[14px] font-semibold text-brand-strong transition hover:bg-surface-2 [&_svg]:size-4";
const btnSecondaryXs =
  "inline-flex h-[26px] items-center justify-center gap-1 whitespace-nowrap rounded-md border border-line bg-surface-2 px-3 text-[12px] font-semibold text-ink transition hover:brightness-95 [&_svg]:size-3.5";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type DayPnl = { date: string; pnl: number };
type TabKey = "overview" | "calendar" | "history" | "platform";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "calendar", label: "Calendar" },
  { key: "history", label: "History" },
  { key: "platform", label: "Platform" },
];

/* ShowMyTrades rows use a few different field names; normalise them. */
const num = (...v: unknown[]) => {
  for (const x of v) {
    const n = Number(x);
    if (x !== undefined && x !== null && x !== "" && Number.isFinite(n)) return n;
  }
  return undefined;
};
function normTrade(t: any, i: number) {
  return {
    id: String(t?.ticket ?? t?.id ?? i),
    symbol: String(t?.symbol ?? "—"),
    side: String(t?.direction ?? t?.type ?? t?.side ?? "—"),
    lots: num(t?.lots, t?.volume) ?? 0,
    openTime: String(t?.open_time ?? t?.opened_at ?? "—"),
    closeTime: String(t?.close_time ?? t?.closed_at ?? "—"),
    openPrice: num(t?.open_price, t?.entry_price),
    closePrice: num(t?.close_price, t?.exit_price),
    sl: num(t?.sl, t?.stop_loss),
    tp: num(t?.tp, t?.take_profit),
    commission: num(t?.commission),
    swap: num(t?.swap),
    pnl: num(t?.profit, t?.pnl, t?.net_profit) ?? 0,
  };
}
type Trade = ReturnType<typeof normTrade>;
const signed = (v: number) => `${v >= 0 ? "+" : "-"}${money(Math.abs(v))}`;
const shortMoney = (v: number) => (Math.abs(v) >= 1000 ? `$${+(v / 1000).toFixed(1)}K` : money(v, 0));

/* ── Plan badge ── */
function PlanBadge({ phase, size, program }: { phase: string; size: number; program: string }) {
  return (
    <div className="w-[125px] shrink-0 overflow-hidden rounded-[6px] border border-brand-strong/60 bg-linear-to-b from-brand-soft to-surface shadow-[0_15px_20px_0_rgba(0,0,0,0.08)] md:w-[140px] dark:shadow-[0_15px_20px_0_rgba(0,0,0,0.3)]">
      <div className="p-3 pb-2 text-brand-strong">
        <p className="truncate text-[12px] font-medium">{phase}</p>
        <p className="text-[20px] font-semibold tracking-[-0.8px]">{shortMoney(size)}</p>
      </div>
      <div className="h-px bg-brand-strong/20" />
      <div className="flex h-6 items-center bg-brand-soft px-3">
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.66px] text-brand-strong">{program}</span>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const cls = status === "Active" ? "bg-success text-white" : status === "Breached" ? "bg-danger text-white" : "bg-brand text-brand-ink";
  return <span className={cx("inline-flex h-5 items-center rounded-md px-1.5 text-[12px] leading-[14px] font-medium", cls)}>{status}</span>;
}

/* ── Segmented bar: 40 slim rects ── */
function SegmentedBar({ pct, tone, dangerFrom }: { pct: number; tone: "success" | "danger" | "warning"; dangerFrom?: number }) {
  const filled = Math.round(Math.min(1, Math.max(0, pct)) * 40);
  const fill = { success: "fill-success", danger: "fill-danger", warning: "fill-warning" }[tone];
  return (
    <svg className="h-8 w-full" viewBox="0 0 400 32" preserveAspectRatio="none" aria-hidden>
      {Array.from({ length: 40 }, (_, i) => (
        <rect key={i} x={i * 10.1} y={8} width={6.1} height={24} rx={1} className={i < filled ? fill : dangerFrom !== undefined && i >= dangerFrom ? "fill-surface-2" : "fill-line"} />
      ))}
    </svg>
  );
}

function ObjectiveCell({ o }: { o: { label: string; current: number; target: number; kind: "target" | "limit" } }) {
  const pct = o.target ? Math.min(1, o.current / o.target) : 0;
  const isTarget = o.kind === "target";
  const tone = isTarget ? "success" : pct < 0.5 ? "warning" : "danger";
  return (
    <div className="flex flex-col gap-4 rounded-tile border border-line bg-surface p-4 xl:rounded-none xl:border-0 xl:border-l xl:first:border-l-0">
      <p className="text-[13px] leading-5 font-medium text-muted">{o.label}</p>
      <p className="text-[16px] leading-5 font-semibold text-ink">{money(o.target, 0)}</p>
      <div className="flex flex-col gap-4 xl:mt-auto">
        <div className="relative pt-7">
          {isTarget && (
            <span
              className="absolute top-0 -translate-x-1/2 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[12px] text-success"
              style={{ left: `${Math.min(92, Math.max(8, pct * 100))}%` }}
            >
              {(pct * 100).toFixed(0)} %
            </span>
          )}
          <SegmentedBar pct={pct} tone={tone} dangerFrom={isTarget ? undefined : 32} />
          <div className={cx("mt-1 flex justify-between text-[12px] text-muted", !isTarget && "w-4/5")}>
            <span>0%</span>
            <span>{isTarget ? "100%" : "80%"}</span>
          </div>
        </div>
        <p className="text-[13px] leading-5 font-medium text-ink-2">
          {isTarget ? (
            <>Result: <span className="text-ink">{money(o.current)}</span></>
          ) : (
            <>Remaining: <span className="text-ink">{money(Math.max(0, o.target - o.current))}</span></>
          )}
        </p>
      </div>
    </div>
  );
}

/* ── Calendar tab ── */
function TradingCalendar({ days, trades }: { days: DayPnl[]; trades: Trade[] }) {
  const last = days.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState({ y: +last.slice(0, 4), m: +last.slice(5, 7) - 1 });
  const map = new Map(days.map((d) => [d.date, d]));
  const tradeCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trades) {
      const k = t.closeTime.slice(0, 10).replace(/\./g, "-");
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [trades]);
  const today = new Date().toISOString().slice(0, 10);
  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const total = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((offset + total) / 7) * 7;
  const shift = (d: number) => setYm(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] leading-5 font-semibold text-ink">Trading Calendar</h2>
        <div className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="text-muted hover:text-ink">
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="min-w-24 text-center text-[12px] leading-[14px] font-medium text-ink">
            {MONTHS[ym.m]} {ym.y}
          </span>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="text-muted hover:text-ink">
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div className={cx(card, "pt-2")}>
        <div className="grid grid-cols-5 px-1 sm:grid-cols-7">
          {WEEKDAYS.map((d, i) => (
            <div key={d} className={cx("p-1 text-center text-[14px] leading-5 font-medium text-ink", i > 4 && "hidden sm:block")}>
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-px p-2 sm:grid-cols-7 md:gap-2">
          {Array.from({ length: cellCount }, (_, i) => {
            const day = i - offset + 1;
            const weekend = i % 7 > 4;
            const inMonth = day >= 1 && day <= total;
            const key = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const d = inMonth ? map.get(key) : undefined;
            const n = tradeCount.get(key);
            const shown = inMonth ? day : new Date(Date.UTC(ym.y, ym.m, day)).getUTCDate();
            return (
              <div
                key={i}
                className={cx(
                  "flex h-[120px] w-full flex-col border-t border-line sm:h-[150px] md:rounded-b-[6px]",
                  weekend && "hidden sm:flex",
                  !inMonth
                    ? "bg-surface-2 opacity-60"
                    : d && d.pnl > 0
                      ? "border-t-success bg-success/10"
                      : d && d.pnl < 0
                        ? "border-t-danger bg-danger/10"
                        : weekend
                          ? "bg-surface-2"
                          : "bg-canvas/60"
                )}
              >
                <div className="flex h-full flex-col justify-between px-1.5 py-3 md:pr-3 md:pl-2">
                  <div className="flex items-start justify-between gap-1">
                    <span className={cx("flex h-7 w-7 items-center justify-center rounded-md text-[16px] leading-5 font-medium", inMonth ? "text-ink" : "text-muted", key === today && inMonth && "bg-surface")}>
                      {String(shown).padStart(2, "0")}
                    </span>
                    {weekend && inMonth && !d && <span className="hidden text-[12px] font-medium text-muted lg:inline">Weekend</span>}
                  </div>
                  {d && d.pnl !== 0 && (
                    <div className="min-w-0">
                      <p className={cx("truncate text-[13px] font-semibold sm:text-[16px]", d.pnl >= 0 ? "text-success" : "text-danger")}>{signed(d.pnl)}</p>
                      {n ? <p className="text-[12px] text-muted">{n} trade{n > 1 ? "s" : ""}</p> : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── History tab ── */
function HistoryTab({ trades, balance, startLabel }: { trades: Trade[]; balance: number; startLabel: string }) {
  const [page, setPage] = useState(0);
  const [side, setSide] = useState<"all" | "buy" | "sell">("all");
  const per = 10;
  const rows = trades.filter((t) => side === "all" || (side === "buy" ? /buy|long/i.test(t.side) : !/buy|long/i.test(t.side)));
  const pages = Math.max(1, Math.ceil(rows.length / per));
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const stats: [string, string][] = [
    ["Balance", money(balance)],
    ["Profit Factor", grossLoss ? (grossWin / grossLoss).toFixed(2) : "—"],
    ["Win Rate", trades.length ? `${((wins.length / trades.length) * 100).toFixed(1)}%` : "—"],
    ["Avg Profit / Avg Loss", `${wins.length ? money(grossWin / wins.length, 0) : "—"} / ${losses.length ? money(-grossLoss / losses.length, 0) : "—"}`],
    ["Total Trades", String(trades.length)],
  ];
  const fmt = (v?: number) => (v === undefined ? "—" : String(v));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col justify-between gap-3 pt-3 md:flex-row md:items-center">
        <div>
          <h2 className="text-[16px] leading-5 font-semibold text-ink">Trading History</h2>
          <p className="text-[14px] text-muted">Account started {startLabel}</p>
        </div>
        <div className="flex gap-1.5">
          {(["all", "buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSide(s);
                setPage(0);
              }}
              className={cx(chip, "capitalize", side === s && "border-brand-strong/40 bg-brand-soft text-brand-strong")}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
        {stats.map(([k, v]) => (
          <div key={k} className={cx(card, "flex h-[120px] w-[160px] shrink-0 flex-col justify-between p-5 sm:w-auto")}>
            <p className="text-[13px] leading-5 font-medium text-muted">{k}</p>
            <p className="truncate text-[20px] leading-6 font-semibold text-ink">{v}</p>
          </div>
        ))}
      </div>

      {rows.length ? (
        <div className={cx(card, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  {["Ticket", "Symbol", "Type", "Lots", "Open Time", "Open Price", "Close Time", "Close Price", "SL", "TP", "Commission", "Swap", "Profit"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[12px] leading-[14px] font-medium whitespace-nowrap text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(page * per, page * per + per).map((t) => {
                  const buy = /buy|long/i.test(t.side);
                  const td = "border-t border-line px-4 py-3.5 text-[13px] leading-5 font-medium whitespace-nowrap text-ink";
                  return (
                    <tr key={t.id}>
                      <td className={td}>{t.id}</td>
                      <td className={td}>{t.symbol}</td>
                      <td className={td}>
                        <span className={cx("inline-flex h-5 items-center rounded-md px-1.5 text-[12px] capitalize", buy ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>{t.side}</span>
                      </td>
                      <td className={td}>{t.lots.toFixed(2)}</td>
                      <td className={td}>{t.openTime}</td>
                      <td className={td}>{fmt(t.openPrice)}</td>
                      <td className={td}>{t.closeTime}</td>
                      <td className={td}>{fmt(t.closePrice)}</td>
                      <td className={td}>{fmt(t.sl)}</td>
                      <td className={td}>{fmt(t.tp)}</td>
                      <td className={td}>{fmt(t.commission)}</td>
                      <td className={td}>{fmt(t.swap)}</td>
                      <td className={cx(td, "font-semibold", t.pnl >= 0 ? "text-success" : "text-danger")}>{signed(t.pnl)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-[13px] text-muted">
            <span>
              Page {page + 1} of {pages} · {rows.length} trades
            </span>
            <div className="flex gap-1.5">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className={cx(chip, "disabled:opacity-40")}>
                <ChevronLeft /> Prev
              </button>
              <button type="button" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className={cx(chip, "disabled:opacity-40")}>
                Next <ChevronRight />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={cx(card, "flex flex-col items-center gap-3 px-6 py-12 sm:p-15")}>
          <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
            <BarChart3 size={24} />
          </div>
          <p className="max-w-[450px] text-center text-[12px] leading-5 text-muted">No trades yet. Place your first trade to get started.</p>
        </div>
      )}
    </div>
  );
}

/* ── Platform tab ── */
const DEVICES = [
  { key: "tablet", label: "Tablet", icon: Tablet },
  { key: "desktop", label: "Desktop", icon: Monitor },
  { key: "phone", label: "Phone", icon: Smartphone },
] as const;
function PlatformTab({ platform, server }: { platform: string; server: string }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["key"]>("desktop");
  const name = platform || "MT5";
  const steps = [
    ["Download platform", `Install ${name} for your ${device} using the links on this page.`],
    ["Open & navigate", `Launch ${name} and open File → Login to Trade Account${device === "desktop" ? "" : " (Settings → New account on mobile)"}.`],
    ["Add your account", "Enter the login number and master password from the Login info panel above."],
    ["Select the correct server", `Choose ${server || "the server shown in Login info"} from the server list.`],
    ["Verify & start trading", "Once connected, your balance appears in the terminal. You're ready to trade."],
  ];
  const downloads = device === "desktop" ? ["Download for Windows", "Download for MacOS"] : ["App Store", "Google Play"];

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex gap-1.5">
        {DEVICES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setDevice(key)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-[12px] leading-[14px] font-medium transition [&_svg]:size-4",
              device === key ? "border-brand-strong/40 bg-brand-soft text-ink shadow-[inset_0_0_20px_0_rgba(0,0,0,0.04)]" : "border-line bg-surface text-muted hover:text-ink"
            )}
          >
            <Icon /> {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className={cx(card, "flex flex-1 flex-col gap-6 rounded-[10px] p-6 md:flex-row")}>
          <div className="flex flex-1 flex-col gap-7">
            <h2 className="text-[16px] font-semibold text-ink">Step-by-Step Login Guide</h2>
            {steps.map(([t, b], i) => (
              <div key={t} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-[12px] font-bold text-ink">{i + 1}</span>
                <div>
                  <p className="text-[12px] leading-[15px] font-bold tracking-wide text-ink">{t}</p>
                  <p className="mt-1 text-[12px] leading-5 text-ink-2">{b}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-5 md:w-[260px]">
            <div className="rounded-tile bg-brand-soft p-2.5">
              <div className="flex aspect-video items-center justify-center rounded-2xl bg-surface/60">
                <span className="flex size-14 items-center justify-center rounded-full bg-brand text-brand-ink shadow-lg">
                  <Monitor size={22} />
                </span>
              </div>
              <p className="mt-2 text-center text-[12px] font-semibold text-ink">{name} setup guide</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold text-ink-2">Download {name}</p>
              {downloads.map((d) => (
                <Link key={d} href="/downloads" className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-soft px-4 py-3 text-[14px] font-medium text-brand-strong transition hover:brightness-95">
                  <Download size={16} /> {d}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className={cx(card, "overflow-hidden rounded-[10px] p-6 lg:w-[420px]")}>
          <h2 className="text-[16px] font-semibold text-ink">Trade from your browser</h2>
          <p className="mt-2 text-[14px] text-ink-2">No install needed — log in to the {name} web terminal with the same credentials.</p>
          <a href="https://www.mql5.com/en/trading" target="_blank" rel="noopener noreferrer" className={cx(btnSecondaryXs, "mt-4 h-[30px] px-4 text-[14px] font-medium")}>
            Web Terminal <ExternalLink />
          </a>
          <div className="aspect-5/3 translate-y-10 rounded-2xl bg-brand-soft md:translate-x-8 md:translate-y-8">
            <div className="flex h-full items-center justify-center text-brand-strong/60">
              <BarChart3 size={56} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Login info drawer ── */
function CredRow({ k, v, secret }: { k: string; v: string; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
      <span className="text-[13px] text-muted">{k}</span>
      <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-ink">
        <span className="truncate">{show ? v || "—" : "••••••••"}</span>
        {secret && v && (
          <button type="button" aria-label={show ? "Hide" : "Show"} onClick={() => setShow((s) => !s)} className="text-muted hover:text-ink">
            {show ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
        {v && (
          <button
            type="button"
            aria-label={`Copy ${k}`}
            onClick={() => {
              navigator.clipboard?.writeText(v);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
            className="text-muted hover:text-ink"
          >
            {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
          </button>
        )}
      </span>
    </div>
  );
}
function LoginDrawer({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: { k: string; v: string; secret?: boolean }[] }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Login info"
        className="absolute inset-y-0 right-0 mx-4 my-auto flex h-full max-h-[calc(100%-40px)] w-[calc(100vw-32px)] flex-col rounded-[10px] bg-surface sm:max-w-120"
        style={{ animation: "drawerIn .5s cubic-bezier(0.32,0.72,0,1)" }}
      >
        <div className="relative border-b border-line p-5">
          <h2 className="text-[18px] leading-[22px] font-semibold text-ink">Login info</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute top-2.75 right-2.75 rounded-md p-2.5 text-muted hover:bg-surface-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">
          {rows.map((r) => (
            <CredRow key={r.k} {...r} />
          ))}
        </div>
      </aside>
      <style>{`@keyframes drawerIn{from{transform:translateX(100%)}to{transform:none}}`}</style>
    </div>
  );
}

/* ── Page ── */
export default function AccountDetailsView({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi(async () => {
    const [acc, ord] = await Promise.all([api.accounts.list(), api.orders.list()]);
    const raw = acc.accounts.find((a) => a.id === id);
    return raw ? toUiAccount(raw, ord.orders) : null;
  }, [id]);
  const [tab, setTab] = useState<TabKey>("overview");
  const [drawer, setDrawer] = useState(false);
  const [details, setDetails] = useState(true);
  const [range, setRange] = useState<"7" | "30" | "all">("all");
  const [nextMsg, setNextMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const a = data;
  const history = useMemo(() => {
    if (!a) return null;
    const series = buildPerformanceSeries({ payload: a.raw.statisticsPayload, initialBalance: a.size, currentBalance: a.balance, currentEquity: a.equity, currentTotalProfit: Number(a.raw.totalPl) || undefined });
    return {
      curve: series.map((p) => ({ date: p.date, balance: p.balance })),
      days: series.filter((p) => /^\d{4}-\d{2}-\d{2}/.test(p.date)).map((p) => ({ date: p.date.slice(0, 10), pnl: p.dailyProfit })),
      trades: getStatisticsTrades(a.raw.statisticsPayload).map(normTrade),
    };
  }, [a]);

  const crumbs = (
    <>
      <nav className="hidden items-center gap-1.5 pt-1 md:flex">
        <Link href="/dashboard" aria-label="Dashboard" className="text-muted hover:text-ink">
          <Home className="size-4" />
        </Link>
        <ChevronRight className="size-4 text-line" />
        <Link href="/accounts" className="text-[14px] leading-4 font-medium text-muted hover:text-ink">
          Accounts
        </Link>
        <ChevronRight className="size-4 text-line" />
        <span className="text-[14px] font-medium text-ink-2">{a?.pendingDelivery ? "Pending" : a?.login ?? "Account"}</span>
      </nav>
      <Link href="/accounts" className="inline-flex items-center gap-1.5 text-[18px] leading-[22px] font-semibold text-ink md:hidden">
        <ArrowLeft size={18} /> Back
      </Link>
    </>
  );
  if (loading || error) return <div className="space-y-5">{crumbs}<LoadState loading={loading} error={error} onRetry={reload} /></div>;
  if (!a || !history) {
    return (
      <div className="space-y-5">
        {crumbs}
        <Card>
          <EmptyState icon={Layers} title="Account not found" text="This account doesn't exist or doesn't belong to you." />
        </Card>
      </div>
    );
  }

  const pnl = a.balance - a.size;
  const floating = a.equity - a.balance;
  const breachRaw = a.raw.statisticsPayload?._range4exCompliance?.breachReason;
  const breach = typeof breachRaw === "string" ? breachRaw : "";
  const started = fmtDate(a.raw.deliveredAt || a.raw.createdAt);
  const curve = range === "all" ? history.curve : history.curve.slice(-Number(range) - 1);

  const requestNext = async () => {
    setRequesting(true);
    try {
      const r = await api.accounts.requestNextStage(a.id);
      setNextMsg({ tone: "success", text: r.message || "Your next-stage account has been requested." });
      reload();
    } catch (e) {
      setNextMsg({ tone: "error", text: e instanceof ApiError ? e.message : "Request failed." });
    } finally {
      setRequesting(false);
    }
  };
  const refresh = async () => {
    setRefreshing(true);
    reload();
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <div className="flex flex-col gap-4 xl:gap-6">
      {crumbs}

      {/* Header card + tab bar */}
      <div className="overflow-hidden rounded-card border border-line">
        <div className="flex flex-col bg-[linear-gradient(-90deg,var(--surface)_25%,var(--brand-soft)_100%)] px-4 py-3 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex items-center gap-4 md:gap-5">
              <PlanBadge phase={a.phase} size={a.size} program={a.program} />
              <div className="flex flex-col gap-3 md:gap-5">
                <h1 className="text-[16px] leading-[22px] font-semibold text-ink md:text-[18px]">
                  {a.pendingDelivery ? "Account being prepared" : <>Login ID : {a.login}</>}
                </h1>
                <div className="flex flex-wrap items-center gap-1 md:gap-3">
                  <StatusChip status={a.status} />
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted">
                    <BarChart3 className="size-3" /> {a.platform}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-muted">
                    <ArrowLeftRight className="size-3" /> {a.program}
                  </span>
                  {a.raw.weekendHoldingAddon && <span className="rounded-md bg-brand-soft px-1.5 text-[12px] font-medium text-brand-strong">Weekend Holding</span>}
                  {a.raw.overnightHoldingAddon && <span className="rounded-md bg-brand-soft px-1.5 text-[12px] font-medium text-brand-strong">Overnight Holding</span>}
                </div>
                <p className="flex items-center gap-1 text-[10px] font-medium text-muted md:hidden">
                  <Clock className="size-3" /> Started {started}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start justify-between gap-3 self-stretch md:items-end md:gap-5">
              <div className="flex flex-wrap gap-2">
                {a.raw.status === "Passed" && (
                  <button type="button" onClick={requestNext} disabled={requesting} className={cx(btnPrimary, "h-[30px] rounded-md px-3.5")}>
                    {requesting ? "Requesting…" : a.model === "Two Step" && a.phase === "Phase 1" ? "Request Phase 2" : "Request funded account"} <ArrowRight size={16} />
                  </button>
                )}
                {!a.pendingDelivery && (
                  <button type="button" onClick={() => setDrawer(true)} className={btnOutlineAccent}>
                    <Lock /> Login info
                  </button>
                )}
              </div>
              <p className="hidden items-center gap-1 text-[12px] leading-[15px] font-medium text-muted md:flex">
                <Clock className="size-4" /> Started: {started}
              </p>
            </div>
          </div>
          {(nextMsg || a.pendingDelivery || (breach && a.status === "Breached")) && (
            <div className="mt-4 space-y-2">
              {nextMsg && <FormMessage tone={nextMsg.tone}>{nextMsg.text}</FormMessage>}
              {a.pendingDelivery && <FormMessage tone="info">Your login details are being prepared. We&apos;ll email them to you and show them here as soon as they&apos;re ready.</FormMessage>}
              {breach && a.status === "Breached" && <FormMessage tone="error">Breach reason: {breach}</FormMessage>}
            </div>
          )}
        </div>
        <div className="overflow-x-auto [scrollbar-width:none] border-t border-line bg-surface px-6 pt-1.5">
          <div className="flex w-max gap-5 md:gap-3" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cx("shrink-0 border-b-2 pt-0.5 pb-1.5 whitespace-nowrap", tab === t.key ? "border-brand" : "border-transparent")}
              >
                <span className={cx("block rounded-md px-1.5 py-1 text-[14px] leading-4 font-semibold", tab === t.key ? "text-brand-strong" : "text-muted hover:text-ink")}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Balance card */}
          <div className="order-1 shrink-0 lg:order-2 lg:w-90">
            <div className={cx(card, "p-4")}>
              <div className="flex flex-col items-center gap-2 rounded-tile bg-brand-soft p-5">
                <p className="text-[14px] leading-4 font-medium text-ink-2">Current balance</p>
                <p className="text-[24px] leading-[29px] font-medium text-ink">{money(a.balance)}</p>
                <button type="button" onClick={() => setDetails((d) => !d)} className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-strong">
                  {details ? "Hide details" : "Show details"} <ChevronUp className={cx("size-3.5 transition", !details && "rotate-180")} />
                </button>
              </div>
              <div className={cx("grid transition-all duration-300", details ? "grid-rows-[1fr]" : "grid-rows-[0fr] opacity-0")}>
                <div className="overflow-hidden">
                  <div className="pt-2">
                    {[
                      ["Initial balance", money(a.size), null],
                      ["Equity", money(a.equity), null],
                      ["Profit/Loss", signed(pnl), pnl >= 0],
                      ["Floating Profit/Loss", signed(floating), floating >= 0],
                    ].map(([k, v, good]) => (
                      <div key={String(k)} className="flex justify-between border-b border-line py-3 last:border-0 last:pb-0">
                        <span className="text-[13px] leading-5 font-medium text-muted">{k}</span>
                        <span className={cx("text-[13px] font-semibold", good === null ? "text-ink" : good ? "text-success" : "text-danger")}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="order-2 flex min-w-0 flex-1 flex-col gap-4 lg:order-1 lg:gap-6">
            {/* Trading objectives */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] leading-5 font-medium text-muted">
                  Trading Objectives
                  {a.raw.statisticsUpdatedAt && <> • Updated {new Date(a.raw.statisticsUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>}
                </p>
                <button type="button" onClick={refresh} className={btnSecondaryXs}>
                  <RefreshCw className={cx(refreshing && "animate-spin")} /> Refresh
                </button>
              </div>
              <div
                className={cx(
                  "grid gap-3 xl:gap-0 xl:overflow-hidden xl:rounded-tile xl:border xl:border-line xl:bg-surface xl:*:min-h-62.5",
                  a.objectives.length === 3 ? "xl:grid-cols-3" : a.objectives.length === 2 ? "xl:grid-cols-2" : "xl:grid-cols-4"
                )}
              >
                {a.objectives.map((o) => (
                  <ObjectiveCell key={o.label} o={o} />
                ))}
              </div>
            </div>

            {/* Account status chart */}
            <div className={cx(card, "p-5")}>
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] leading-5 font-semibold text-ink">Account Status</h2>
                  <p className="text-[14px] text-muted">Balance over time</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.raw.graphLink && (
                    <a href={a.raw.graphLink} target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1 text-[13px] font-medium text-brand-strong hover:underline sm:inline-flex">
                      Full analytics <ExternalLink size={13} />
                    </a>
                  )}
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value as typeof range)}
                    aria-label="Chart range"
                    className="rounded-[4px] border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-2 outline-none"
                  >
                    <option value="7">7 Days</option>
                    <option value="30">30 Days</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
              {curve.length > 1 ? (
                <PnlChart data={curve} start={a.size} />
              ) : (
                <p className="flex h-[280px] items-center justify-center text-[14px] text-muted">No data available</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "calendar" && <TradingCalendar days={history.days} trades={history.trades} />}
      {tab === "history" && <HistoryTab trades={history.trades} balance={a.balance} startLabel={started} />}
      {tab === "platform" && <PlatformTab platform={a.platform} server={a.raw.server} />}

      <LoginDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        rows={[
          { k: "Login", v: a.raw.login },
          { k: "Password", v: a.raw.passwordMaster, secret: true },
          { k: "Investor password", v: a.raw.passwordInvestor, secret: true },
          { k: "Server", v: a.raw.server },
          { k: "Platform", v: a.platform },
        ]}
      />
    </div>
  );
}
