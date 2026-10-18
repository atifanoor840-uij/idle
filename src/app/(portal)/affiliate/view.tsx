"use client";
import { useEffect, useState } from "react";
import { Check, Copy, Users } from "lucide-react";
import { money } from "@/lib/mock";
import { api } from "@/lib/propApi";
import { fmtDate, useApi } from "@/lib/portal-data";
import { btnPrimary, Card, cx, EmptyState, LoadState, StatTile } from "@/components/portal/ui";
import { Badge, inputCls, PageHeader, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

// Referred traders' emails are masked: show only the first letter and the domain.
const mask = (email?: string, name?: string) => {
  if (!email) return name || "Trader";
  const [u, d] = email.split("@");
  return `${u.slice(0, 1)}•••@${d ?? ""}`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AffiliateView() {
  const { data, error, loading, reload } = useApi(() => api.affiliate());
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const code = data?.affiliate.referralCode ?? "";
  const link = code ? `${origin}/auth/signup?ref=${encodeURIComponent(code)}` : "";
  const m = data?.metrics;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Affiliate Program" sub={data ? `Earn ${data.affiliate.commissionRate}% on every challenge your referrals buy.` : "Earn commission on every challenge your referrals buy."} />
      <LoadState loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          <Card title="Your referral link">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input readOnly value={link} className={cx(inputCls, "flex-1 bg-surface-2 font-medium")} aria-label="Referral link" onFocus={(e) => e.target.select()} />
              <button type="button" onClick={copy} disabled={!link} className={btnPrimary}>
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy link"}
              </button>
            </div>
            <p className="mt-2 text-[13px] text-muted">
              Your code <strong className="text-ink">{code}</strong> also gives referred traders 10% off when entered at checkout.
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Referred purchases" value={String(m?.totalReferrals ?? 0)} delta="All time" trend="flat" />
            <StatTile label="Total earned" value={money(m?.totalEarned ?? 0)} delta={`${data.affiliate.commissionRate}% commission rate`} trend="flat" />
            <StatTile label="Pending" value={money(m?.pendingEarned ?? 0)} delta="Approved after the order is paid" trend="flat" />
            <StatTile label="Paid out" value={money(m?.paidEarned ?? 0)} delta="Sent to you" trend="flat" />
          </div>

          <Card title="Referrals">
            {data.referrals.length ? (
              <div className={tableWrap}>
                <table className="w-full min-w-[640px] border-collapse">
                  <thead className="bg-surface-2">
                    <tr>
                      <th className={thCls}>Trader</th>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Product</th>
                      <th className={cx(thCls, "text-right")}>Order</th>
                      <th className={cx(thCls, "text-right")}>Commission</th>
                      <th className={thCls}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrals.map((r, i) => (
                      <tr key={i} className={trCls}>
                        <td className={cx(tdCls, "font-medium text-ink")}>{mask(r.referredEmail, r.referredName)}</td>
                        <td className={tdCls}>{fmtDate(r.createdAt)}</td>
                        <td className={tdCls}>{r.planName || "—"}</td>
                        <td className={cx(tdCls, "text-right")}>{money(Number(r.amountPaid) || 0)}</td>
                        <td className={cx(tdCls, "text-right font-semibold text-success")}>+{money(Number(r.commissionAmount) || 0)}</td>
                        <td className={tdCls}>
                          <Badge>{cap(String(r.status || "pending"))}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Users} title="No referrals yet" text="Share your link to start earning commission." />
            )}
            <p className="mt-4 text-[13px] text-muted">Approved commission can be used as credit on your next challenge purchase. Paid-out commission is sent by our team.</p>
          </Card>
        </>
      )}
    </div>
  );
}
