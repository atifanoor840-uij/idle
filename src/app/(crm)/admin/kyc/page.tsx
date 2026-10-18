"use client";
import { useState } from "react";
import { crm, type AdminKyc } from "@/lib/crmApi";
import { Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { ConfirmAction, dangerLink, errMsg, fmtDateTime, linkBtn, matches, Person, SearchBox, useAdmin } from "@/components/crm/kit";

type Filter = "review" | "approved" | "rejected" | "all";
const LABEL: Record<AdminKyc["status"], string> = { pending: "Pending", needs_review: "In review", approved: "Approved", rejected: "Rejected" };
const docLinks = (k: AdminKyc) =>
  (
    [
      ["Front", k.frontUrl],
      ["Back", k.backUrl],
      ["Selfie", k.selfieUrl],
      ["Address", k.addressUrl],
    ] as const
  ).filter(([, u]) => typeof u === "string" && /^https?:\/\//.test(u));

export default function KycDesk() {
  const { data, error, loading, reload } = useAdmin(() => crm.kyc.list());
  const [filter, setFilter] = useState<Filter>("review");
  const [q, setQ] = useState("");
  const [act, setAct] = useState<{ k: AdminKyc; to: AdminKyc["status"] } | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const rows = data?.kyc ?? [];
  const inTab = (k: AdminKyc, f: Filter) => (f === "all" ? true : f === "review" ? k.status === "pending" || k.status === "needs_review" : k.status === f);
  const list = rows.filter((k) => inTab(k, filter) && matches(q, k.userName, k.userEmail, k.userId));

  const sync = async (k: AdminKyc) => {
    setMsg(null);
    try {
      await crm.kyc.sync(k.userId);
      setMsg({ tone: "success", text: `Pulled the latest Didit decision for ${k.userName || k.userId}.` });
      reload();
    } catch (e) {
      setMsg({ tone: "error", text: errMsg(e) });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="KYC" sub="Identity checks. Payouts stay locked until a trader is approved." />
      <Card>
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs<Filter>
            tabs={(
              [
                ["review", "To review"],
                ["approved", "Approved"],
                ["rejected", "Rejected"],
                ["all", "All"],
              ] as [Filter, string][]
            ).map(([key, label]) => ({ key, label, count: rows.filter((k) => inTab(k, key)).length }))}
            value={filter}
            onChange={setFilter}
          />
          <SearchBox value={q} onChange={setQ} placeholder="Search trader…" />
        </div>
        {msg && <div className="mb-4"><FormMessage tone={msg.tone}>{msg.text}</FormMessage></div>}
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Trader</th>
                  <th className={thCls}>Method</th>
                  <th className={thCls}>Documents</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>Updated</th>
                  <th className={thCls}>Action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((k) => (
                  <tr key={k.userId} className={cx(trCls, "align-top")}>
                    <td className={cx(tdCls, "max-w-[240px]")}>
                      <Person name={k.userName} email={k.userEmail} />
                    </td>
                    <td className={tdCls}>{k.documentType === "didit" ? "Didit" : k.documentType}</td>
                    <td className={tdCls}>
                      <div className="flex flex-wrap gap-2">
                        {docLinks(k).map(([label, url]) => (
                          <a key={label} href={url} target="_blank" rel="noopener noreferrer" className={linkBtn}>
                            {label}
                          </a>
                        ))}
                        {!docLinks(k).length && <span className="text-muted">—</span>}
                      </div>
                    </td>
                    <td className={tdCls}>
                      <Badge>{LABEL[k.status]}</Badge>
                      {k.rejectReason && <span className="mt-1 block max-w-[200px] whitespace-normal text-[12px] text-muted">{k.rejectReason}</span>}
                    </td>
                    <td className={cx(tdCls, "text-[12.5px] text-muted")}>{fmtDateTime(k.updatedAt)}</td>
                    <td className={tdCls}>
                      <div className="flex flex-col items-start gap-1.5">
                        {k.status !== "approved" && (
                          <button type="button" onClick={() => setAct({ k, to: "approved" })} className={linkBtn}>
                            Approve
                          </button>
                        )}
                        {k.status !== "rejected" && (
                          <button type="button" onClick={() => setAct({ k, to: "rejected" })} className={dangerLink}>
                            Reject
                          </button>
                        )}
                        {k.documentType === "didit" && (
                          <button type="button" onClick={() => sync(k)} className={linkBtn}>
                            Sync from Didit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!list.length && (
                  <tr>
                    <td colSpan={6} className={cx(tdCls, "py-10 text-center text-muted")}>
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
        title={`${act?.to === "approved" ? "Approve" : "Reject"} KYC for ${act?.k.userName || act?.k.userId}?`}
        body={act?.to === "approved" ? "The trader can request payouts once approved. They are notified by email." : "The trader is emailed the reason and can verify again."}
        withNote={act?.to === "rejected" ? "Reason (sent to the trader)" : undefined}
        confirmLabel="Confirm"
        onCancel={() => setAct(null)}
        onConfirm={async (note) => {
          if (act!.to === "rejected" && !note) throw new Error("Write a reason for the trader.");
          await crm.kyc.review(act!.k.userId, act!.to, note || undefined);
          setAct(null);
          reload();
        }}
      />
    </div>
  );
}
