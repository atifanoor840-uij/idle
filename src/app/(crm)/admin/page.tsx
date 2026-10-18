"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { money } from "@/lib/mock";
import { crm } from "@/lib/crmApi";
import { MODEL_LABEL, planInfo } from "@/lib/portal-data";
import { Card, cx, LoadState, StatTile } from "@/components/portal/ui";
import { Badge, PageHeader } from "@/components/portal/kit";
import { fmtDateTime, Person, useAdmin } from "@/components/crm/kit";

const DAY = 86400000;
const isPaid = (s: string) => !["pending", "payment failed", "failed", "cancelled"].includes(s.toLowerCase());

export default function AdminOverview() {
  const { data, error, loading, reload } = useAdmin(async () => {
    const [orders, accounts, payouts, kyc, users] = await Promise.all([
      crm.orders.list(),
      crm.accounts.list(),
      crm.payouts.list(),
      crm.kyc.list().catch(() => ({ kyc: [] })),
      crm.users.list(),
    ]);
    return { orders: orders.orders, accounts: accounts.accounts, payouts: payouts.payouts, kyc: kyc.kyc, users: users.users };
  });

  const now = Date.now();
  const o = data?.orders ?? [];
  const paid = o.filter((x) => isPaid(x.status));
  const rev30 = paid.filter((x) => now - new Date(x.createdAt).getTime() < 30 * DAY).reduce((s, x) => s + Number(x.amountPaid || 0), 0);
  const pendingOrders = o.filter((x) => x.status.toLowerCase() === "pending");
  const proofsWaiting = pendingOrders.filter((x) => String(x.gatewayRef).startsWith("manual:"));
  const toDeliver = (data?.accounts ?? []).filter((a) => a.deliveryStatus === "pending");
  const payoutQueue = (data?.payouts ?? []).filter((p) => ["pending", "approved", "processing"].includes(p.status));
  const kycQueue = (data?.kyc ?? []).filter((k) => k.status === "pending" || k.status === "needs_review");
  const newUsers = (data?.users ?? []).filter((u) => now - new Date(u.createdAt).getTime() < 7 * DAY).length;

  const queues = [
    { label: "Crypto payments to verify", count: proofsWaiting.length, href: "/admin/orders?filter=proof" },
    { label: "Accounts to deliver", count: toDeliver.length, href: "/admin/accounts" },
    { label: "Payout requests", count: payoutQueue.length, href: "/admin/payouts" },
    { label: "KYC to review", count: kycQueue.length, href: "/admin/kyc" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Overview" sub="What needs your attention right now." />
      <LoadState loading={loading} error={error} onRetry={reload} />
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {queues.map((q) => (
              <Link key={q.label} href={q.href} className={cx("group rounded-card p-5 transition", q.count ? "bg-warning/15 hover:bg-warning/25" : "bg-surface hover:bg-surface-2")}>
                <p className="text-[13px] font-medium text-ink-2">{q.label}</p>
                <p className="mt-2 flex items-center justify-between text-[28px] font-bold text-ink">
                  {q.count}
                  <ArrowRight size={18} className="text-muted transition group-hover:translate-x-0.5" />
                </p>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Revenue (30 days)" value={money(rev30)} delta={`${paid.length} paid orders all time`} trend="flat" />
            <StatTile label="Revenue (all time)" value={money(paid.reduce((s, x) => s + Number(x.amountPaid || 0), 0))} delta="Excludes pending and failed" trend="flat" />
            <StatTile label="Traders" value={String(data.users.filter((u) => u.role === "trader").length)} delta={`${newUsers} joined this week`} trend="flat" />
            <StatTile label="Paid out" value={money(data.payouts.filter((p) => p.status === "paid").reduce((s, p) => s + Number(p.profitSplitAmount || 0), 0))} delta="Trader share of paid payouts" trend="flat" />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card title="Latest orders" actions={<Link href="/admin/orders" className="text-[14px] font-medium text-brand-strong hover:underline">All orders</Link>}>
              <ul className="divide-y divide-line">
                {o.slice(0, 8).map((x) => {
                  const p = planInfo(x);
                  return (
                    <li key={x.id} className="flex items-center justify-between gap-3 py-3">
                      <Person name={x.userName} email={x.userEmail} />
                      <span className="hidden text-[13px] text-muted sm:block">
                        {MODEL_LABEL[p.model]} {p.size ? money(p.size, 0) : ""}
                      </span>
                      <span className="text-right">
                        <span className="block text-[14px] font-semibold text-ink">{money(x.amountPaid)}</span>
                        <Badge>{x.status}</Badge>
                      </span>
                    </li>
                  );
                })}
                {!o.length && <li className="py-6 text-center text-[14px] text-muted">No orders yet.</li>}
              </ul>
            </Card>
            <Card title="Payout queue" actions={<Link href="/admin/payouts" className="text-[14px] font-medium text-brand-strong hover:underline">All payouts</Link>}>
              <ul className="divide-y divide-line">
                {payoutQueue.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <Person name={p.userName} email={p.userEmail} />
                    <span className="text-[12.5px] text-muted">{fmtDateTime(p.createdAt)}</span>
                    <span className="text-right">
                      <span className="block text-[14px] font-semibold text-ink">{money(Number(p.amount))}</span>
                      <Badge>{p.status}</Badge>
                    </span>
                  </li>
                ))}
                {!payoutQueue.length && <li className="py-6 text-center text-[14px] text-muted">No payouts waiting.</li>}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
