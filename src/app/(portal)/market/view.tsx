"use client";
import { useState } from "react";
import { Search, SearchX, TrendingDown, TrendingUp } from "lucide-react";
import { market } from "@/lib/mock";
import MarketTable from "@/components/portal/MarketTable";
import { Card, cx, EmptyState } from "@/components/portal/ui";
import { inputCls, PageHeader, Tabs } from "@/components/portal/kit";

const GROUPS = ["All", ...market.map((g) => g.group)];

export default function MarketView() {
  const [group, setGroup] = useState("All");
  const [q, setQ] = useState("");
  const all = market.flatMap((g) => g.rows);
  const movers = [...all].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 4);

  const groups = market
    .filter((g) => group === "All" || g.group === group)
    .map((g) => ({ ...g, rows: g.rows.filter((r) => (r.symbol + r.name).toLowerCase().includes(q.toLowerCase())) }))
    .filter((g) => g.rows.length);

  return (
    <div className="space-y-5">
      <PageHeader title="Market Overview" sub="Indicative prices from our liquidity feed. Spreads are shown in points." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {movers.map((m) => {
          const up = m.change >= 0;
          return (
            <div key={m.symbol} className="rounded-card bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-semibold text-ink">{m.symbol}</p>
                {up ? <TrendingUp size={18} className="text-success" /> : <TrendingDown size={18} className="text-danger" />}
              </div>
              <p className="mt-2 text-[22px] font-bold text-ink">{m.bid.toFixed(m.dp)}</p>
              <p className={cx("text-[13px] font-semibold", up ? "text-success" : "text-danger")}>
                {up ? "+" : ""}
                {m.change.toFixed(2)}%
              </p>
            </div>
          );
        })}
      </div>

      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <Tabs tabs={GROUPS.map((g) => ({ key: g, label: g }))} value={group} onChange={setGroup} className="lg:flex-1" />
          <label className="relative block lg:w-72">
            <span className="sr-only">Search symbols</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={cx(inputCls, "pl-9")} placeholder="Search symbol…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
        {groups.length ? <MarketTable groups={groups} /> : <EmptyState icon={SearchX} title="No symbols found" text={`Nothing matches “${q}”.`} />}
      </Card>
    </div>
  );
}
