"use client";
import { useState } from "react";
import type { EconEvent } from "@/lib/mock";
import { AssetIcon } from "@/components/AssetIcon";
import { cx } from "./ui";

const TABS = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
] as const;

function Impact({ level }: { level: 1 | 2 | 3 }) {
  const color = level === 3 ? "bg-danger" : level === 2 ? "bg-warning" : "bg-muted";
  return (
    <span className="inline-flex gap-1" aria-label={`${["Low", "Medium", "High"][level - 1]} impact`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={cx("size-2 rounded-full", n <= level ? color : "bg-line")} />
      ))}
    </span>
  );
}

export default function EconomicCalendar({ data }: { data: { today: EconEvent[]; week: EconEvent[] } }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("today");
  const rows = data[tab];
  return (
    <>
      <div className="mb-4 flex gap-6 border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "-mb-px border-b-2 pb-3 text-[14px] font-medium transition",
              tab === t.key ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-tile border border-line">
        <table className="w-full min-w-[640px] border-collapse text-[14px]">
          <thead className="bg-surface-2">
            <tr className="text-[12px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Cur.</th>
              <th className="px-4 py-3 text-left">Event</th>
              <th className="px-4 py-3 text-left">Impact</th>
              <th className="px-4 py-3 text-right">Actual</th>
              <th className="px-4 py-3 text-right">Forecast</th>
              <th className="px-4 py-3 text-right">Previous</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.time + e.event} className="h-11 border-t border-line">
                <td className="whitespace-nowrap px-4 text-muted">{e.time}</td>
                <td className="px-4 font-semibold text-ink">
                  <span className="inline-flex items-center gap-2">
                    <AssetIcon symbol={e.currency} size={18} />
                    <span>{e.currency}</span>
                  </span>
                </td>
                <td className="px-4 text-ink-2">{e.event}</td>
                <td className="px-4">
                  <Impact level={e.impact} />
                </td>
                <td className="px-4 text-right font-semibold text-ink">{e.actual ?? "—"}</td>
                <td className="px-4 text-right text-ink-2">{e.forecast}</td>
                <td className="px-4 text-right text-muted">{e.previous}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
