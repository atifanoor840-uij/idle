"use client";
import { useState } from "react";
import { crm } from "@/lib/crmApi";
import { Card, cx, LoadState } from "@/components/portal/ui";
import { Badge, PageHeader, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";
import { fmtDateTime, matches, SearchBox, useAdmin } from "@/components/crm/kit";

export default function AuditLog() {
  const { data, error, loading, reload } = useAdmin(() => crm.audit());
  const [q, setQ] = useState("");
  const logs = (data?.logs ?? []).filter((l) => matches(q, l.userName, l.action, l.description, l.targetId));

  return (
    <div className="space-y-5">
      <PageHeader title="Audit log" sub="Admin actions on orders, accounts and users, newest first." />
      <Card actions={<SearchBox value={q} onChange={setQ} placeholder="Search admin, action, target…" />}>
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error && (
          <div className={tableWrap}>
            <table className="w-full min-w-[860px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>When</th>
                  <th className={thCls}>Admin</th>
                  <th className={thCls}>Action</th>
                  <th className={thCls}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 500).map((l) => (
                  <tr key={l.id} className={cx(trCls, "align-top")}>
                    <td className={cx(tdCls, "text-[12.5px] text-muted")}>{fmtDateTime(l.createdAt)}</td>
                    <td className={tdCls}>{l.userName}</td>
                    <td className={tdCls}>
                      <Badge tone="neutral">{l.action.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className={cx(tdCls, "whitespace-normal text-ink-2")}>
                      {l.description}
                      <span className="block text-[12px] text-muted">
                        {l.targetType} {l.targetId}
                      </span>
                    </td>
                  </tr>
                ))}
                {!logs.length && (
                  <tr>
                    <td colSpan={4} className={cx(tdCls, "py-10 text-center text-muted")}>
                      No entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
