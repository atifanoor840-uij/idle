"use client";
import { useMemo, useState } from "react";
import { CalendarDays, FileSpreadsheet, NotebookPen, RotateCcw } from "lucide-react";
import { accounts, money } from "@/lib/mock";
import { closedTrades, openPositions, type Trade } from "@/lib/mock-pages";
import { btnPrimary, btnSecondary, Card, cx, EmptyState, StatTile } from "@/components/portal/ui";
import { downloadFile, Field, inputCls, PageHeader, Tabs, tableWrap, tdCls, thCls, toCSV, trCls } from "@/components/portal/kit";

const EMPTY = { login: "all", from: "", to: "", symbol: "" };

export default function TradesView() {
  const [tab, setTab] = useState<"open" | "closed">("closed");
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);

  const rows = useMemo(() => {
    const src = tab === "open" ? openPositions : closedTrades;
    return src.filter((t) => {
      const d = (t.closeTime ?? t.openTime).slice(0, 10);
      return (
        (filters.login === "all" || t.login === filters.login) &&
        (!filters.from || d >= filters.from) &&
        (!filters.to || d <= filters.to) &&
        (!filters.symbol || t.symbol.includes(filters.symbol.toUpperCase()))
      );
    });
  }, [tab, filters]);

  const pnl = rows.reduce((s, t) => s + t.pnl, 0);
  const wins = rows.filter((t) => t.pnl > 0).length;

  const exportCsv = () =>
    downloadFile(
      `trades-${tab}.csv`,
      toCSV(
        rows.map((t: Trade) => ({
          account: t.login,
          symbol: t.symbol,
          side: t.side,
          lots: t.lots,
          open_time: t.openTime,
          open_price: t.openPrice,
          close_time: t.closeTime,
          close_price: t.closePrice,
          pnl: t.pnl,
        }))
      ),
      "text/csv"
    );

  return (
    <div className="space-y-5">
      <PageHeader title="Trading Journal" sub="Every trade across your accounts, ready to review." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Trades in view" value={String(rows.length)} delta={tab === "open" ? "Open right now" : "Closed trades"} trend="flat" />
        <StatTile label="Net P&L" value={`${pnl >= 0 ? "+" : ""}${money(pnl)}`} delta="For the selected filters" trend={pnl >= 0 ? "up" : "down"} />
        <StatTile label="Win rate" value={rows.length ? `${((wins / rows.length) * 100).toFixed(1)}%` : "—"} delta={`${wins} winning trades`} trend="flat" />
      </div>

      <Card
        title="Filters"
        actions={
          <button type="button" onClick={exportCsv} className={btnSecondary} disabled={!rows.length}>
            <FileSpreadsheet size={16} strokeWidth={1.75} /> Export
          </button>
        }
      >
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters(draft);
          }}
        >
          <Field label="Account">
            <select className={inputCls} value={draft.login} onChange={(e) => setDraft({ ...draft, login: e.target.value })}>
              <option value="all">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.login}>
                  #{a.login} · {a.program}
                </option>
              ))}
            </select>
          </Field>
          <Field label="From">
            <div className="relative">
              <CalendarDays size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="date" className={inputCls} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
            </div>
          </Field>
          <Field label="To">
            <div className="relative">
              <CalendarDays size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="date" className={inputCls} value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
            </div>
          </Field>
          <Field label="Symbol">
            <input className={inputCls} placeholder="e.g. XAUUSD" value={draft.symbol} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })} />
          </Field>
          <div className="flex items-end gap-2">
            <button type="submit" className={btnPrimary}>
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(EMPTY);
                setFilters(EMPTY);
              }}
              className="inline-flex h-10 items-center gap-1.5 px-2 text-[14px] font-medium text-muted hover:text-ink"
            >
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <Tabs
          tabs={[
            { key: "open", label: "Open Positions", count: openPositions.length },
            { key: "closed", label: "Closed Trades", count: closedTrades.length },
          ]}
          value={tab}
          onChange={setTab}
          className="mb-5"
        />
        {rows.length ? (
          <div className={cx(tableWrap, "max-h-[560px]")}>
            <table className="w-full min-w-[820px] border-collapse">
              <thead className="sticky top-0 bg-surface-2">
                <tr>
                  <th className={thCls}>Account</th>
                  <th className={thCls}>Symbol</th>
                  <th className={thCls}>Side</th>
                  <th className={cx(thCls, "text-right")}>Lots</th>
                  <th className={thCls}>Open time</th>
                  <th className={cx(thCls, "text-right")}>Open price</th>
                  {tab === "closed" && <th className={thCls}>Close time</th>}
                  {tab === "closed" && <th className={cx(thCls, "text-right")}>Close price</th>}
                  <th className={cx(thCls, "text-right")}>{tab === "open" ? "Floating P&L" : "P&L"}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className={trCls}>
                    <td className={cx(tdCls, "text-muted")}>#{t.login}</td>
                    <td className={cx(tdCls, "font-semibold text-ink")}>{t.symbol}</td>
                    <td className={cx(tdCls, t.side === "Buy" ? "text-success" : "text-danger")}>{t.side}</td>
                    <td className={cx(tdCls, "text-right")}>{t.lots.toFixed(2)}</td>
                    <td className={cx(tdCls, "text-muted")}>{t.openTime}</td>
                    <td className={cx(tdCls, "text-right")}>{t.openPrice.toFixed(t.dp)}</td>
                    {tab === "closed" && <td className={cx(tdCls, "text-muted")}>{t.closeTime}</td>}
                    {tab === "closed" && <td className={cx(tdCls, "text-right")}>{t.closePrice?.toFixed(t.dp)}</td>}
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
          <EmptyState icon={NotebookPen} title="No trades match these filters" text="Try a wider date range or a different account." />
        )}
      </Card>
    </div>
  );
}
