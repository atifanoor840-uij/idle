"use client";
import { useState } from "react";
import { Crown } from "lucide-react";
import { money } from "@/lib/mock";
import { leaderboard, leaderboardAllTime, type Leader } from "@/lib/mock-pages";
import { Card, cx } from "@/components/portal/ui";
import { PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

const k = (n: number) => `$${n / 1000}K`;

function Podium({ l }: { l: Leader }) {
  const first = l.rank === 1;
  return (
    <div className={cx("relative flex flex-col items-center rounded-card p-6 text-center", first ? "bg-[#111318] text-white dark:bg-surface-2" : "bg-surface", first && "sm:-mt-4 sm:pb-10")}>
      {first && <Crown size={22} className="mb-2 text-brand" />}
      <span className={cx("inline-flex size-14 items-center justify-center rounded-full text-[18px] font-bold", first ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink")}>
        {l.name
          .split(" ")
          .map((p) => p[0])
          .join("")}
      </span>
      <p className={cx("mt-3 text-[17px] font-semibold", first ? "text-white dark:text-ink" : "text-ink")}>{l.name}</p>
      <p className={cx("text-[12px] font-semibold", first ? "text-white/60 dark:text-muted" : "text-muted")}>
        #{l.rank} · {l.country} · {k(l.size)}
      </p>
      <p className={cx("mt-4 text-[28px] font-bold", first ? "text-brand" : "text-success")}>+{l.gain.toFixed(2)}%</p>
      <p className={cx("text-[13px]", first ? "text-white/60 dark:text-muted" : "text-muted")}>{money(l.profit)} profit</p>
    </div>
  );
}

export default function LeaderboardView() {
  const [tab, setTab] = useState<"month" | "all">("month");
  const rows = tab === "month" ? leaderboard : leaderboardAllTime;
  const [a, b, c] = rows;

  return (
    <div className="space-y-5">
      <PageHeader title="Leaderboard" sub="Top funded traders ranked by % gain. Names are shortened for privacy." />
      <Tabs
        tabs={[
          { key: "month", label: "This month" },
          { key: "all", label: "All time" },
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="grid items-end gap-4 pt-4 sm:grid-cols-3">
        <div className="order-2 sm:order-1">
          <Podium l={b} />
        </div>
        <div className="order-1 sm:order-2">
          <Podium l={a} />
        </div>
        <div className="order-3">
          <Podium l={c} />
        </div>
      </div>

      <Card title="Rankings">
        <div className={tableWrap}>
          <table className="w-full min-w-[600px] border-collapse">
            <thead className="bg-surface-2">
              <tr>
                <th className={thCls}>Rank</th>
                <th className={thCls}>Trader</th>
                <th className={thCls}>Country</th>
                <th className={cx(thCls, "text-right")}>Account</th>
                <th className={cx(thCls, "text-right")}>Profit</th>
                <th className={cx(thCls, "text-right")}>Gain</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.name} className={cx(trCls, l.rank <= 3 && "bg-brand-soft/40")}>
                  <td className={cx(tdCls, "font-bold text-ink")}>{l.rank}</td>
                  <td className={cx(tdCls, "font-semibold text-ink")}>{l.name}</td>
                  <td className={cx(tdCls, "text-muted")}>{l.country}</td>
                  <td className={cx(tdCls, "text-right")}>{k(l.size)}</td>
                  <td className={cx(tdCls, "text-right")}>{money(l.profit)}</td>
                  <td className={cx(tdCls, "text-right font-semibold text-success")}>+{l.gain.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
