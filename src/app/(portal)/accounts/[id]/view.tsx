"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, ExternalLink, Eye, KeyRound, Layers, XCircle } from "lucide-react";
import { money } from "@/lib/mock";
import { api, ApiError } from "@/lib/propApi";
import { toUiAccount, useApi } from "@/lib/portal-data";
import { buildPerformanceSeries, getStatisticsTrades } from "@/lib/tradingStatistics";
import PnlChart from "@/components/portal/PnlChart";
import { btnPrimary, btnSecondary, Card, cx, EmptyState, FormMessage, LoadState, StatusBadge, Tag } from "@/components/portal/ui";
import { tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
type DayPnl = { date: string; pnl: number };

function PnlCalendar({ days }: { days: DayPnl[] }) {
  const last = days.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState({ y: +last.slice(0, 4), m: +last.slice(5, 7) - 1 });
  const map = new Map(days.map((d) => [d.date, d]));
  const first = new Date(Date.UTC(ym.y, ym.m, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const total = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const monthPnl = days.filter((d) => d.date.startsWith(`${ym.y}-${String(ym.m + 1).padStart(2, "0")}`)).reduce((s, d) => s + d.pnl, 0);
  const shift = (d: number) => setYm(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));

  return (
    <Card
      title="P&L Calendar"
      actions={
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-36 text-center text-[14px] font-semibold text-ink">
            {MONTHS[ym.m]} {ym.y}
          </span>
          <button type="button" aria-label="Next month" onClick={() => shift(1)} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface-2">
            <ChevronRight size={16} />
          </button>
        </div>
      }
    >
      <p className="-mt-2 mb-4 text-[14px] text-muted">
        Month P&L:{" "}
        <span className={cx("font-semibold", monthPnl >= 0 ? "text-success" : "text-danger")}>
          {monthPnl >= 0 ? "+" : ""}
          {money(monthPnl)}
        </span>
      </p>
      <div className="grid grid-cols-7 gap-1 text-center sm:gap-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="pb-1 text-[10.5px] font-semibold uppercase text-muted sm:text-[12px]">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const key = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const d = map.get(key);
          return (
            <div key={i} className={cx("flex min-h-13 min-w-0 flex-col justify-between rounded-lg p-1 text-left sm:min-h-16 sm:p-2", !d ? "bg-surface-2" : d.pnl >= 0 ? "bg-success/12" : "bg-danger/10")}>
              <span className="text-[10.5px] text-muted sm:text-[12px]">{day}</span>
              {d && (
                <span className={cx("block truncate text-right text-[9.5px] font-bold sm:text-[12.5px]", d.pnl >= 0 ? "text-success" : "text-danger")}>
                  {d.pnl >= 0 ? "+" : "-"}${Math.abs(d.pnl) >= 1000 ? `${(Math.abs(d.pnl) / 1000).toFixed(1)}K` : Math.abs(d.pnl).toFixed(0)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

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
    pnl: num(t?.profit, t?.pnl, t?.net_profit) ?? 0,
  };
}

function Credential({ k, v, secret }: { k: string; v: string; secret?: boolean }) {
  const [show, setShow] = useState(!secret);
  return (
    <div>
      <p className="text-[12px] text-muted">{k}</p>
      <p className="flex items-center gap-2 break-all font-semibold text-ink">
        {show ? v || "—" : "••••••••"}
        {secret && v && (
          <button type="button" onClick={() => setShow((s) => !s)} className="text-[12px] font-medium text-brand-strong hover:underline">
            {show ? "Hide" : "Show"}
          </button>
        )}
      </p>
    </div>
  );
}

export default function AccountDetailsView({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi(async () => {
    const [acc, ord] = await Promise.all([api.accounts.list(), api.orders.list()]);
    const raw = acc.accounts.find((a) => a.id === id);
    return raw ? toUiAccount(raw, ord.orders) : null;
  }, [id]);
  const [showCreds, setShowCreds] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nextMsg, setNextMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [requesting, setRequesting] = useState(false);

  const a = data;
  const history = useMemo(() => {
    if (!a) return null;
    const series = buildPerformanceSeries({ payload: a.raw.statisticsPayload, initialBalance: a.size, currentBalance: a.balance, currentEquity: a.equity, currentTotalProfit: Number(a.raw.totalPl) || undefined });
    const trades = getStatisticsTrades(a.raw.statisticsPayload).map(normTrade);
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    return {
      curve: series.map((p) => ({ date: p.date, balance: p.balance })),
      days: series.filter((p) => /^\d{4}-\d{2}-\d{2}/.test(p.date)).map((p) => ({ date: p.date.slice(0, 10), pnl: p.dailyProfit })),
      trades,
      stats: trades.length
        ? [
            ["Total trades", String(trades.length)],
            ["Win rate", `${((wins.length / trades.length) * 100).toFixed(1)}%`],
            ["Profit factor", grossLoss ? (grossWin / grossLoss).toFixed(2) : "—"],
            ["Lots traded", trades.reduce((s, t) => s + t.lots, 0).toFixed(2)],
            ["Average win", wins.length ? money(grossWin / wins.length) : "—"],
            ["Average loss", losses.length ? money(-grossLoss / losses.length) : "—"],
            ["Best trade", money(Math.max(...trades.map((t) => t.pnl)))],
            ["Worst trade", money(Math.min(...trades.map((t) => t.pnl)))],
          ]
        : [],
    };
  }, [a]);

  const back = (
    <Link href="/accounts" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted hover:text-ink">
      <ArrowLeft size={16} /> My Accounts
    </Link>
  );
  if (loading || error) return <div className="space-y-5">{back}<LoadState loading={loading} error={error} onRetry={reload} /></div>;
  if (!a || !history) {
    return (
      <div className="space-y-5">
        {back}
        <Card>
          <EmptyState icon={Layers} title="Account not found" text="This account doesn't exist or doesn't belong to you." />
        </Card>
      </div>
    );
  }

  const pnl = a.balance - a.size;
  const rules = a.objectives.map((o) => {
    const ok = o.kind === "target" ? o.current >= o.target : o.current < o.target;
    const text = o.kind === "target" ? `${o.label}: ${money(o.current, 0)} of ${money(o.target, 0)}` : `${o.label}: ${money(o.current, 0)} used of ${money(o.target, 0)} allowed`;
    return { ok, pending: o.kind === "target" && !ok && a.status === "Active", text };
  });
  const breachRaw = a.raw.statisticsPayload?._range4exCompliance?.breachReason;
  const breach = typeof breachRaw === "string" ? breachRaw : "";

  const copy = () => {
    navigator.clipboard?.writeText(`Login: ${a.raw.login}\nServer: ${a.raw.server}\nPassword: ${a.raw.passwordMaster}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

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

  return (
    <div className="space-y-5">
      {back}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold text-ink md:text-[24px]">{a.pendingDelivery ? "Account being prepared" : `#${a.login}`}</h1>
              <Tag>{a.phase}</Tag>
              <StatusBadge status={a.status} />
              {a.raw.weekendHoldingAddon && (
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-strong border border-brand/20">
                  Weekend Holding
                </span>
              )}
              {a.raw.overnightHoldingAddon && (
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-strong border border-brand/20">
                  Overnight Holding
                </span>
              )}
            </div>
            <p className="mt-1 text-[14px] text-muted">
              {a.program} · {money(a.size, 0)} · {a.platform}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.raw.status === "Passed" && (
              <button type="button" onClick={requestNext} disabled={requesting} className={btnPrimary}>
                {requesting ? "Requesting…" : a.model === "Two Step" && a.phase === "Phase 1" ? "Request Phase 2" : "Request funded account"} <ArrowRight size={16} />
              </button>
            )}
            {!a.pendingDelivery && (
              <button type="button" onClick={() => setShowCreds((s) => !s)} className={btnSecondary}>
                <KeyRound size={16} strokeWidth={1.75} /> {showCreds ? "Hide credentials" : "Credentials"}
              </button>
            )}
          </div>
        </div>
        {nextMsg && <div className="mt-4"><FormMessage tone={nextMsg.tone}>{nextMsg.text}</FormMessage></div>}
        {a.pendingDelivery && (
          <div className="mt-4">
            <FormMessage tone="info">Your login details are being prepared. We&apos;ll email them to you and show them here as soon as they&apos;re ready.</FormMessage>
          </div>
        )}
        {breach && a.status === "Breached" && (
          <div className="mt-4">
            <FormMessage tone="error">Breach reason: {breach}</FormMessage>
          </div>
        )}
        {showCreds && !a.pendingDelivery && (
          <div className="mt-5 grid gap-4 rounded-tile bg-surface-2 p-4 sm:grid-cols-2 lg:grid-cols-5">
            <Credential k="Login" v={a.raw.login} />
            <Credential k="Server" v={a.raw.server} />
            <Credential k="Master password" v={a.raw.passwordMaster} secret />
            <Credential k="Investor password" v={a.raw.passwordInvestor} secret />
            <button type="button" onClick={copy} className={cx(btnSecondary, "self-center")}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {[
            ["Balance", money(a.balance), null],
            ["Equity", money(a.equity), null],
            ["Total P&L", `${pnl >= 0 ? "+" : ""}${money(pnl)}`, pnl >= 0],
            ["Gain", `${pnl >= 0 ? "+" : ""}${a.size ? ((pnl / a.size) * 100).toFixed(2) : "0.00"}%`, pnl >= 0],
          ].map(([k, v, good]) => (
            <div key={String(k)} className="min-w-0 rounded-tile bg-surface-2 p-3 sm:p-4">
              <p className="truncate text-[12px] text-muted">{k}</p>
              <p className={cx("mt-1 truncate text-[17px] font-bold sm:text-[22px]", good === null ? "text-ink" : good ? "text-success" : "text-danger")}>{v}</p>
            </div>
          ))}
        </div>
        {a.raw.statisticsUpdatedAt && <p className="mt-3 text-[12px] text-muted">Stats updated {new Date(a.raw.statisticsUpdatedAt).toLocaleString()}</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {a.objectives.map((o) => {
          const pct = o.target ? Math.min(100, (o.current / o.target) * 100) : 0;
          const bad = o.kind === "limit" && o.current >= o.target;
          return (
            <div key={o.label} className="rounded-card bg-surface p-5">
              <p className="text-[13px] font-medium text-muted">{o.label}</p>
              <p className={cx("mt-2 text-[22px] font-bold", bad ? "text-danger" : "text-ink")}>{money(o.current, 0)}</p>
              <p className="text-[12.5px] text-muted">
                {o.kind === "target" ? "Target" : "Limit"} {money(o.target, 0)}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className={cx("h-full rounded-full", o.kind === "target" ? "bg-brand" : bad ? "bg-danger" : pct > 70 ? "bg-warning" : "bg-success")} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card
          title="Balance curve"
          className="min-w-0"
          actions={
            a.raw.graphLink ? (
              <a href={a.raw.graphLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[14px] font-medium text-brand-strong hover:underline">
                Full analytics <ExternalLink size={14} />
              </a>
            ) : undefined
          }
        >
          {history.curve.length > 1 ? (
            <PnlChart data={history.curve} start={a.size} />
          ) : (
            <p className="py-10 text-center text-[14px] text-muted">The chart appears after your first trading day.</p>
          )}
        </Card>
        <Card title="Rule check">
          <ul className="space-y-3">
            {rules.map((r) => (
              <li key={r.text} className="flex items-start gap-2.5 text-[14px]">
                {r.ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" /> : r.pending ? <Eye size={18} className="mt-0.5 shrink-0 text-warning" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />}
                <span className="text-ink-2">
                  {r.text}
                  <span className="block text-[12px] text-muted">{r.ok ? "Passed" : r.pending ? "In progress" : "Not met"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {history.stats.length > 0 && (
        <Card title="Trading statistics">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {history.stats.map(([k, v]) => (
              <div key={k} className="rounded-tile bg-surface-2 p-4">
                <p className="text-[12px] text-muted">{k}</p>
                <p className="mt-1 text-[18px] font-bold text-ink">{v}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title={`Trades (${history.trades.length})`}>
        {history.trades.length ? (
          <div className={cx(tableWrap, "max-h-[440px]")}>
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  <th className={thCls}>Symbol</th>
                  <th className={thCls}>Side</th>
                  <th className={cx(thCls, "text-right")}>Lots</th>
                  <th className={thCls}>Open time</th>
                  <th className={cx(thCls, "text-right")}>Open</th>
                  <th className={thCls}>Close time</th>
                  <th className={cx(thCls, "text-right")}>Close</th>
                  <th className={cx(thCls, "text-right")}>P&L</th>
                </tr>
              </thead>
              <tbody>
                {history.trades.map((t) => (
                  <tr key={t.id} className={trCls}>
                    <td className={cx(tdCls, "font-semibold text-ink")}>{t.symbol}</td>
                    <td className={cx(tdCls, /buy|long/i.test(t.side) ? "text-success" : "text-danger")}>{t.side}</td>
                    <td className={cx(tdCls, "text-right")}>{t.lots.toFixed(2)}</td>
                    <td className={cx(tdCls, "text-muted")}>{t.openTime}</td>
                    <td className={cx(tdCls, "text-right")}>{t.openPrice ?? "—"}</td>
                    <td className={cx(tdCls, "text-muted")}>{t.closeTime}</td>
                    <td className={cx(tdCls, "text-right")}>{t.closePrice ?? "—"}</td>
                    <td className={cx(tdCls, "text-right font-semibold", t.pnl >= 0 ? "text-success" : "text-danger")}>
                      {t.pnl >= 0 ? "+" : ""}
                      {money(t.pnl)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-[14px] text-muted">No closed trades yet.</p>
        )}
      </Card>

      {history.days.length > 0 && <PnlCalendar days={history.days} />}
    </div>
  );
}
