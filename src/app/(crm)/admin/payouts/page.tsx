"use client";
import { useState } from "react";
import { money } from "@/lib/mock";
import { crm, type AdminPayout } from "@/lib/crmApi";
import { Card, cx, LoadState } from "@/components/portal/ui";
import { Badge, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, fmtDateTime, linkBtn, matches, Person, SearchBox, useAdmin } from "@/components/crm/kit";

type Filter = "open" | "paid" | "rejected" | "all";
type Next = "approved" | "processing" | "paid" | "rejected";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function details(raw: string) {
  try {
    const d = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (d && typeof d === "object") return Object.entries(d as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`);
  } catch {}
  return raw ? [String(raw)] : [];
}

const NEXT: Record<string, Next[]> = { pending: ["approved", "rejected"], approved: ["processing", "paid", "rejected"], processing: ["paid", "rejected"] };
const HELP: Record<Next, string> = {
  approved: "Approves the request. Funds are not sent yet.",
  processing: "Marks the transfer as in progress.",
  paid: "Confirms the money was sent: deducts it from the account balance, issues a payout certificate and emails the trader. Only do this after the transfer is made.",
  rejected: "Rejects the request and emails the trader the reason below.",
};

export default function PayoutsDesk() {
  const { data, error, loading, reload } = useAdmin(() => crm.payouts.list());
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [act, setAct] = useState<{ p: AdminPayout; to: Next } | null>(null);

  const payouts = data?.payouts ?? [];
  const inTab = (p: AdminPayout, f: Filter) => (f === "all" ? true : f === "open" ? !["paid", "rejected"].includes(p.status) : p.status === f);
  const list = payouts.filter((p) => inTab(p, filter) && matches(q, p.id, p.userName, p.userEmail, p.accountId, p.paymentMethod));

  return (
    <div className="space-y-5">
      <PageHeader title="Payouts" sub="Review withdrawal requests. The server already applied caps, split and rule checks." />
      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Filter>
            tabs={(["open", "paid", "rejected", "all"] as Filter[]).map((k) => ({ key: k, label: k === "open" ? "Open" : cap(k), count: payouts.filter((p) => inTab(p, k)).length }))}
            value={filter}
            onChange={setFilter}
          />
          <SearchBox value={q} onChange={setQ} placeholder="Search trader, payout, account…" />
        </div>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[1080px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Request</th>
                  <th className={thCls}>Trader</th>
                  <th className={cx(thCls, "text-right")}>Gross</th>
                  <th className={cx(thCls, "text-right")}>Trader share</th>
                  <th className={thCls}>Send to</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className={cx(trCls, "align-top")}>
                    <td className={tdCls}>
                      <span className="block font-semibold text-ink">{p.id}</span>
                      <span className="block text-[12.5px] text-muted">{fmtDateTime(p.createdAt)}</span>
                      <span className="block text-[12px] text-muted">Account {p.accountId}</span>
                    </td>
                    <td className={cx(tdCls, "max-w-[200px]")}>
                      <Person name={p.userName} email={p.userEmail} />
                    </td>
                    <td className={cx(tdCls, "text-right")}>{money(Number(p.amount) || 0)}</td>
                    <td className={cx(tdCls, "text-right font-semibold text-ink")}>{money(Number(p.profitSplitAmount) || 0)}</td>
                    <td className={cx(tdCls, "max-w-[280px] whitespace-normal")}>
                      <span className="block font-medium text-ink">{p.paymentMethod}</span>
                      {details(p.paymentDetails).map((d) => (
                        <span key={d} className="block break-all text-[12.5px] text-muted">
                          {d}
                        </span>
                      ))}
                    </td>
                    <td className={tdCls}>
                      <Badge>{cap(p.status)}</Badge>
                      {p.notes && <span className="mt-1 block max-w-[180px] whitespace-normal text-[12px] text-muted">{p.notes}</span>}
                    </td>
                    <td className={tdCls}>
                      <div className="flex flex-col items-start gap-1.5">
                        {(NEXT[p.status] ?? []).map((to) => (
                          <button key={to} type="button" onClick={() => setAct({ p, to })} className={to === "rejected" ? dangerLink : linkBtn}>
                            {to === "approved" ? "Approve" : to === "processing" ? "Mark processing" : to === "paid" ? "Mark paid" : "Reject"}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={7} className={cx(tdCls, "py-10 text-center text-muted")}>
                      Nothing here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmAction
        open={!!act}
        danger={act?.to === "rejected"}
        title={`${act ? cap(act.to === "approved" ? "approve" : act.to === "rejected" ? "reject" : `mark ${act.to}`) : ""} ${act?.p.id}?`}
        body={
          <>
            <p>{act && HELP[act.to]}</p>
            <p className="mt-2 text-muted">
              {act?.p.userName} · trader share {money(Number(act?.p.profitSplitAmount) || 0)} via {act?.p.paymentMethod}
            </p>
          </>
        }
        withNote={act?.to === "rejected" ? "Reason (sent to the trader)" : "Internal note (optional)"}
        confirmLabel="Confirm"
        onCancel={() => setAct(null)}
        onConfirm={async (note) => {
          if (act!.to === "rejected" && !note) throw new Error("Write a reason for the trader.");
          await crm.payouts.review(act!.p.id, act!.to, note || undefined);
          setAct(null);
          reload();
        }}
      />
    </div>
  );
}
