"use client";
import { useState } from "react";
import { CalendarRange, Gift, Trophy, Users } from "lucide-react";
import { money } from "@/lib/mock";
import { competitions, competitionStandings, dateFmt, type Competition } from "@/lib/mock-pages";
import { btnPrimary, btnSecondary, Card, cx, EmptyState } from "@/components/portal/ui";
import { Badge, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

export default function CompetitionsView() {
  const [tab, setTab] = useState<"All" | Competition["status"]>("All");
  const [joined, setJoined] = useState<Record<string, boolean>>(Object.fromEntries(competitions.map((c) => [c.id, c.joined])));
  const list = competitions.filter((c) => tab === "All" || c.status === tab);
  const live = competitions.find((c) => c.status === "Live");

  return (
    <div className="space-y-5">
      <PageHeader title="Competitions" sub="Free-entry trading contests. Win funded accounts without paying a fee." />

      {live && joined[live.id] && (
        <Card title={`${live.name} · your standing`}>
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div className="rounded-tile bg-brand-soft p-5">
              <p className="text-[13px] font-medium text-ink-2">Your rank</p>
              <p className="mt-1 text-[32px] font-bold text-ink">#{competitionStandings.yourRank}</p>
              <p className="text-[13px] font-semibold text-success">+{competitionStandings.yourGain}% gain</p>
              <p className="mt-3 text-[12.5px] text-ink-2">Top 10 at month end win prizes. Ends {dateFmt(live.end)}.</p>
            </div>
            <div className={tableWrap}>
              <table className="w-full min-w-[420px] border-collapse">
                <thead className="bg-surface-2">
                  <tr>
                    <th className={thCls}>Rank</th>
                    <th className={thCls}>Trader</th>
                    <th className={cx(thCls, "text-right")}>Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {competitionStandings.top.map((l) => (
                    <tr key={l.name} className={trCls}>
                      <td className={cx(tdCls, "font-bold text-ink")}>{l.rank}</td>
                      <td className={tdCls}>{l.name}</td>
                      <td className={cx(tdCls, "text-right font-semibold text-success")}>+{l.gain.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      <Tabs tabs={(["All", "Live", "Upcoming", "Ended"] as const).map((k) => ({ key: k, label: k }))} value={tab} onChange={setTab} />

      {list.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {list.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface-2 text-brand-strong">
                  <Trophy size={20} strokeWidth={1.75} />
                </span>
                <Badge>{c.status}</Badge>
              </div>
              <p className="mt-4 text-[17px] font-semibold text-ink">{c.name}</p>
              <p className="mt-1 text-[28px] font-bold text-ink">{money(c.prizePool, 0)}</p>
              <p className="text-[13px] text-muted">prize pool</p>

              <div className="mt-4 space-y-2 text-[14px] text-ink-2">
                <p className="flex items-center gap-2">
                  <CalendarRange size={16} className="text-muted" /> {dateFmt(c.start)} – {dateFmt(c.end)}
                </p>
                <p className="flex items-center gap-2">
                  <Users size={16} className="text-muted" /> {c.participants.toLocaleString()} traders · {c.account}
                </p>
              </div>
              <ul className="mt-4 flex-1 space-y-1.5 rounded-tile bg-surface-2 p-4 text-[13px] text-ink-2">
                {c.prizes.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Gift size={14} className="mt-0.5 shrink-0 text-brand-strong" /> {p}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {c.status === "Ended" ? (
                  <button type="button" className={cx(btnSecondary, "w-full")}>
                    View results
                  </button>
                ) : joined[c.id] ? (
                  <button type="button" disabled className={cx(btnSecondary, "w-full opacity-70")}>
                    You&apos;re in
                  </button>
                ) : (
                  <button type="button" onClick={() => setJoined((j) => ({ ...j, [c.id]: true }))} className={cx(btnPrimary, "w-full")}>
                    Join for free
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Trophy} title={`No ${tab.toLowerCase()} competitions`} text="Check back soon. New contests launch every month." />
        </Card>
      )}
    </div>
  );
}
