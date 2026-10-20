"use client";
import Link from "next/link";
import { useState } from "react";
import { FileDown, Receipt } from "lucide-react";
import { money } from "@/lib/mock";
import { api, type Order } from "@/lib/propApi";
import { fmtDate, MODEL_LABEL, planInfo, useApi } from "@/lib/portal-data";
import { site } from "@/site.config";
import { Card, cx, EmptyState, LoadState, StatTile } from "@/components/portal/ui";
import { Badge, downloadFile, esc, PageHeader, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

type Group = "All" | "Paid" | "Pending" | "Failed";
const groupOf = (s: string): Exclude<Group, "All"> => {
  const v = s.toLowerCase();
  if (v === "pending") return "Pending";
  if (v.includes("fail") || v.includes("cancel") || v.includes("refund")) return "Failed";
  return "Paid";
};
const product = (o: Order) => {
  const p = planInfo(o);
  return `${MODEL_LABEL[p.model]} Challenge · ${p.size ? money(p.size, 0) : ""}`;
};

function invoiceHtml(o: Order) {
  return `<!doctype html><meta charset="utf-8"><title>${esc(o.id)}</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;color:#111">
<h1 style="margin:0">${esc(site.name)}</h1><p style="color:#777">${esc(site.company)}</p><hr>
<h2>Invoice ${esc(o.id)}</h2>
<p>Date: ${esc(fmtDate(o.createdAt))}<br>Status: ${esc(o.status)}<br>Payment method: ${esc(o.paymentMethod)}</p>
<table style="width:100%;border-collapse:collapse"><tr style="background:#f5f5f5"><th align="left" style="padding:8px">Item</th><th align="right" style="padding:8px">Amount</th></tr>
<tr><td style="padding:8px">${esc(product(o))}${o.weekendHoldingAddon ? " + weekend holding add-on" : ""}${o.overnightHoldingAddon ? " + overnight holding add-on" : ""}${o.couponUsed ? ` (code ${esc(o.couponUsed)})` : ""}</td><td align="right" style="padding:8px">${money(o.amountPaid)}</td></tr>
<tr><td style="padding:8px"><b>Total</b></td><td align="right" style="padding:8px"><b>${money(o.amountPaid)}</b></td></tr></table>
<p style="color:#777;font-size:12px;margin-top:40px">${esc(site.company)}. Replace with your firm's registered address and tax details.</p></body>`;
}

export default function BillingView() {
  const { data, error, loading, reload } = useApi(() => api.orders.list());
  const [tab, setTab] = useState<Group>("All");
  const orders = data?.orders ?? [];
  const list = orders.filter((o) => tab === "All" || groupOf(o.status) === tab);
  const paid = orders.filter((o) => groupOf(o.status) === "Paid");

  return (
    <div className="space-y-5">
      <PageHeader title="Billing" sub="Your orders and invoices." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total spent" value={money(paid.reduce((s, o) => s + Number(o.amountPaid || 0), 0))} delta={`${paid.length} paid ${paid.length === 1 ? "order" : "orders"}`} trend="flat" />
        <StatTile label="Awaiting payment" value={String(orders.filter((o) => groupOf(o.status) === "Pending").length)} delta="Finish checkout from the table below" trend="flat" />
        <StatTile label="Failed / cancelled" value={String(orders.filter((o) => groupOf(o.status) === "Failed").length)} delta="Includes failed challenges" trend="flat" />
      </div>

      <Card title="Orders">
        <Tabs tabs={(["All", "Paid", "Pending", "Failed"] as const).map((k) => ({ key: k, label: k }))} value={tab} onChange={setTab} className="mb-5" />
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error &&
          (list.length ? (
            <div className={tableWrap}>
              <table className="w-full min-w-[720px] border-collapse">
                <thead className="bg-surface-2">
                  <tr>
                    <th className={thCls}>Order</th>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Product</th>
                    <th className={cx(thCls, "text-right")}>Amount</th>
                    <th className={thCls}>Method</th>
                    <th className={thCls}>Status</th>
                    <th className={cx(thCls, "text-right")}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={o.id} className={trCls}>
                      <td className={cx(tdCls, "font-semibold text-ink")}>{o.id}</td>
                      <td className={tdCls}>{fmtDate(o.createdAt)}</td>
                      <td className={tdCls}>{product(o)}</td>
                      <td className={cx(tdCls, "text-right font-semibold text-ink")}>{money(o.amountPaid)}</td>
                      <td className={cx(tdCls, "text-muted")}>{o.paymentMethod}</td>
                      <td className={tdCls}>
                        <Badge>{o.status}</Badge>
                      </td>
                      <td className={cx(tdCls, "text-right")}>
                        {groupOf(o.status) === "Pending" ? (
                          <Link href={`/pay?orderId=${encodeURIComponent(o.id)}`} className="text-[13px] font-medium text-brand-strong hover:underline">
                            Complete payment
                          </Link>
                        ) : (
                          <button type="button" onClick={() => downloadFile(`${o.id}.html`, invoiceHtml(o), "text/html")} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline">
                            <FileDown size={15} /> Invoice
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={Receipt} title="No orders here" text="Orders with this status will show up here." />
          ))}
      </Card>
    </div>
  );
}
