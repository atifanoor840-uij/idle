"use client";
import { useState } from "react";
import { CalendarX } from "lucide-react";
import { calendarWeek } from "@/lib/mock-pages";
import { Card, cx, EmptyState } from "@/components/portal/ui";
import { PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

const DAYS = ["All", "Mon", "Tue", "Wed", "Thu", "Fri"] as const;
const CURRENCIES = [...new Set(calendarWeek.map((e) => e.currency))];

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

export default function CalendarView() {
  const [day, setDay] = useState<(typeof DAYS)[number]>("All");
  const [impact, setImpact] = useState<0 | 1 | 2 | 3>(0);
  const [cur, setCur] = useState<string[]>([]);

  const rows = calendarWeek.filter((e) => (day === "All" || e.day === day) && e.impact >= impact && (!cur.length || cur.includes(e.currency)));
  const toggleCur = (c: string) => setCur((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]));

  return (
    <div className="space-y-5">
      <PageHeader title="Economic Calendar" sub="High-impact news can move markets fast. Check before you trade. Times are GMT." />
      <Card>
        <Tabs tabs={DAYS.map((d) => ({ key: d, label: d === "All" ? "This week" : d }))} value={day} onChange={setDay} />

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink-2">Impact</span>
            {(
              [
                [0, "All"],
                [2, "Medium+"],
                [3, "High only"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setImpact(v)}
                className={cx("h-8 rounded-full border px-3 text-[13px] font-medium", impact === v ? "border-ink bg-surface-2 text-ink" : "border-line text-muted hover:text-ink")}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink-2">Currency</span>
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cur.includes(c)}
                onClick={() => toggleCur(c)}
                className={cx("h-8 rounded-full border px-3 text-[13px] font-semibold", cur.includes(c) ? "border-ink bg-surface-2 text-ink" : "border-line text-muted hover:text-ink")}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {rows.length ? (
          <div className={cx(tableWrap, "mt-5")}>
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Day</th>
                  <th className={thCls}>Time</th>
                  <th className={thCls}>Cur.</th>
                  <th className={thCls}>Event</th>
                  <th className={thCls}>Impact</th>
                  <th className={cx(thCls, "text-right")}>Actual</th>
                  <th className={cx(thCls, "text-right")}>Forecast</th>
                  <th className={cx(thCls, "text-right")}>Previous</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.day + e.time + e.event} className={cx(trCls, e.impact === 3 && "bg-danger/[.03]")}>
                    <td className={cx(tdCls, "text-muted")}>{e.day}</td>
                    <td className={cx(tdCls, "text-muted")}>{e.time}</td>
                    <td className={cx(tdCls, "font-semibold text-ink")}>{e.currency}</td>
                    <td className={cx(tdCls, "text-ink-2")}>{e.event}</td>
                    <td className={tdCls}>
                      <Impact level={e.impact} />
                    </td>
                    <td className={cx(tdCls, "text-right font-semibold text-ink")}>{e.actual ?? "—"}</td>
                    <td className={cx(tdCls, "text-right")}>{e.forecast}</td>
                    <td className={cx(tdCls, "text-right text-muted")}>{e.previous}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={CalendarX} title="No events match" text="Try a different day, impact or currency filter." />
        )}
      </Card>
    </div>
  );
}
