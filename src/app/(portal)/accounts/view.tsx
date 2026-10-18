"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Layers } from "lucide-react";
import { money, type AccountStatus, type Platform } from "@/lib/mock";
import { api } from "@/lib/propApi";
import { fmtDate, planInfo, MODEL_LABEL, toUiAccount, useApi } from "@/lib/portal-data";
import AccountCard from "@/components/portal/AccountCard";
import { btnPrimary, Card, cx, EmptyState, LoadState } from "@/components/portal/ui";
import { Badge, PageHeader, Segmented, Tabs, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

type TabKey = AccountStatus | "History";

export default function AccountsView() {
  const { data, error, loading, reload } = useApi(async () => {
    const [acc, ord] = await Promise.all([api.accounts.list(), api.orders.list()]);
    return { accounts: acc.accounts.map((a) => toUiAccount(a, ord.orders)), orders: ord.orders };
  });
  const [tab, setTab] = useState<TabKey>("Active");
  const [platform, setPlatform] = useState<"All" | Platform>("All");

  const accounts = data?.accounts ?? [];
  const platforms = [...new Set(accounts.map((a) => a.platform))];
  const count = (s: AccountStatus) => accounts.filter((a) => a.status === s).length;
  const list = accounts.filter((a) => a.status === tab && (platform === "All" || a.platform === platform));

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Accounts"
        sub="Every challenge and funded account you own."
        actions={
          <Link href="/challenges" className={btnPrimary}>
            New challenge <ArrowRight size={16} />
          </Link>
        }
      />

      <Card>
        <Tabs<TabKey>
          tabs={[
            { key: "Active", label: "Active", count: count("Active") },
            { key: "Pending", label: "Being prepared", count: count("Pending") },
            { key: "Passed", label: "Passed", count: count("Passed") },
            { key: "Breached", label: "Breached", count: count("Breached") },
            { key: "History", label: "Orders" },
          ]}
          value={tab}
          onChange={setTab}
        />

        <div className="mt-5">
          <LoadState loading={loading} error={error} onRetry={reload} />
        </div>

        {!loading && !error && tab === "History" && (
          <div className={tableWrap}>
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="bg-surface-2">
                <tr>
                  <th className={thCls}>Order</th>
                  <th className={thCls}>Date</th>
                  <th className={thCls}>Challenge</th>
                  <th className={thCls}>Method</th>
                  <th className={cx(thCls, "text-right")}>Amount</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.orders ?? []).map((o) => {
                  const p = planInfo(o);
                  return (
                    <tr key={o.id} className={trCls}>
                      <td className={cx(tdCls, "text-muted")}>{o.id}</td>
                      <td className={tdCls}>{fmtDate(o.createdAt)}</td>
                      <td className={cx(tdCls, "font-semibold text-ink")}>
                        {MODEL_LABEL[p.model]} · {p.size ? money(p.size, 0) : "—"}
                      </td>
                      <td className={tdCls}>{o.paymentMethod}</td>
                      <td className={cx(tdCls, "text-right font-semibold")}>{money(o.amountPaid)}</td>
                      <td className={tdCls}>
                        <Badge>{o.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
                {!data?.orders.length && (
                  <tr>
                    <td colSpan={6} className={cx(tdCls, "py-8 text-center text-muted")}>
                      No orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && tab !== "History" && (
          <>
            {platforms.length > 1 && (
              <div className="mb-5 max-w-xl">
                <Segmented label="Platform" options={["All", ...platforms] as ("All" | Platform)[]} value={platform} onChange={setPlatform} cols="grid-cols-2 sm:grid-cols-4" />
              </div>
            )}
            {list.length ? (
              <div className="flex flex-col gap-3.5">
                {list.map((a) => (
                  <AccountCard key={a.id} a={a} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Layers}
                title={`No ${tab === "Pending" ? "accounts being prepared" : `${tab.toLowerCase()} accounts`}`}
                text="Accounts will show up here as soon as you have one."
                action={
                  <Link href="/challenges" className={btnPrimary}>
                    Start a Challenge <ArrowRight size={16} />
                  </Link>
                }
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
