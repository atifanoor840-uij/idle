"use client";
import Link from "next/link";
import { ArrowRight, Bell, Layers, Plus } from "lucide-react";
import { money, offers } from "@/lib/mock";
import { api } from "@/lib/propApi";
import { fmtDate, MODEL_LABEL, planInfo, toUiAccount, useApi } from "@/lib/portal-data";
import HeroCarousel from "@/components/portal/HeroCarousel";
import AccountCard from "@/components/portal/AccountCard";
import { useSessionUser } from "@/components/portal/SessionContext";
import { btnPrimary, btnSecondary, Card, cx, EmptyState, FormMessage, LoadState, StatTile } from "@/components/portal/ui";
import { Badge } from "@/components/portal/kit";

const PAYMENT_COPY: Record<string, { tone: "success" | "error"; text: string }> = {
  success: { tone: "success", text: "Payment received. Your new account is being prepared — we'll email you the login details." },
  error: { tone: "error", text: "We couldn't confirm your payment. If you were charged, contact support with your order ID." },
  "order-not-found": { tone: "error", text: "We couldn't find the order for this payment. Please contact support." },
  "missing-session": { tone: "error", text: "The payment session was missing. Please contact support if you were charged." },
};

export default function DashboardView({ payment }: { payment: string }) {
  const user = useSessionUser();
  const { data, error, loading, reload } = useApi(async () => {
    const [acc, ord, pay, notif] = await Promise.all([
      api.accounts.list(),
      api.orders.list(),
      api.payouts.list().catch(() => ({ payouts: [] })),
      api.notifications.list().catch(() => ({ notifications: [] })),
    ]);
    return {
      accounts: acc.accounts.map((a) => toUiAccount(a, ord.orders)),
      orders: ord.orders,
      payouts: pay.payouts,
      notifications: notif.notifications,
    };
  });

  const firstName = user.name.split(" ")[0];
  const accounts = data?.accounts ?? [];
  const live = accounts.filter((a) => a.status !== "Breached");
  const funded = accounts.filter((a) => a.phase === "Funded" && a.status === "Active");
  const paid = (data?.payouts ?? []).filter((p) => p.status === "paid");
  const stats = [
    { label: "Funded capital", value: money(funded.reduce((s, a) => s + a.size, 0), 0), delta: `${funded.length} funded ${funded.length === 1 ? "account" : "accounts"}`, trend: "flat" as const },
    { label: "Total paid out", value: money(paid.reduce((s, p) => s + Number(p.profitSplitAmount || p.amount), 0)), delta: `${paid.length} ${paid.length === 1 ? "payout" : "payouts"}`, trend: "flat" as const },
    { label: "Active challenges", value: String(accounts.filter((a) => a.status === "Active" && a.phase !== "Funded").length), delta: `${accounts.filter((a) => a.status === "Passed").length} passed`, trend: "flat" as const },
    { label: "Being prepared", value: String(accounts.filter((a) => a.status === "Pending").length), delta: "Login details on the way", trend: "flat" as const },
  ];
  const ret = PAYMENT_COPY[payment];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-ink md:text-[24px]">Welcome back, {firstName}</h1>
        <p className="mt-0.5 text-[14px] text-muted">Here is how your accounts are doing today.</p>
      </div>

      {ret && <FormMessage tone={ret.tone}>{ret.text}</FormMessage>}

      <HeroCarousel offers={offers} />

      <Card
        title="Accounts Overview"
        actions={
          <>
            <Link href="/accounts" className={`${btnSecondary} max-sm:hidden`}>
              View all
            </Link>
            <Link href="/challenges" className={btnPrimary}>
              <Plus size={16} /> New challenge
            </Link>
          </>
        }
      >
        <LoadState loading={loading} error={error} onRetry={reload} />
        {!loading && !error &&
          (live.length ? (
            <div className="flex flex-col gap-3.5">
              {live.slice(0, 6).map((a) => (
                <AccountCard key={a.id} a={a} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="No accounts yet"
              text="Start your first evaluation challenge to trade in our simulated environment."
              action={
                <Link href="/challenges" className={btnPrimary}>
                  Start a Challenge <ArrowRight size={16} />
                </Link>
              }
            />
          ))}
      </Card>

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <StatTile key={s.label} {...s} />
            ))}
          </div>

          <div className="grid gap-5 2xl:grid-cols-2">
            <Card title="Recent orders" actions={<Link href="/billing" className="text-[14px] font-medium text-brand-strong hover:underline">Billing</Link>}>
              {data?.orders.length ? (
                <ul className="divide-y divide-line">
                  {data.orders.slice(0, 5).map((o) => {
                    const p = planInfo(o);
                    const pending = o.status.toLowerCase() === "pending";
                    return (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-[14px] font-semibold text-ink">
                            {MODEL_LABEL[p.model]} · {p.size ? money(p.size, 0) : "—"}
                          </p>
                          <p className="text-[12.5px] text-muted">
                            {o.id} · {fmtDate(o.createdAt)} · {money(o.amountPaid)}
                          </p>
                        </div>
                        {pending ? (
                          <Link href={`/pay?orderId=${encodeURIComponent(o.id)}`} className={cx(btnSecondary, "h-9")}>
                            Complete payment
                          </Link>
                        ) : (
                          <Badge>{o.status}</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-6 text-center text-[14px] text-muted">No orders yet.</p>
              )}
            </Card>

            <Card title="Notifications">
              {data?.notifications.length ? (
                <ul className="divide-y divide-line">
                  {data.notifications.slice(0, 5).map((n) => (
                    <li key={n.id} className="flex gap-3 py-3">
                      <Bell size={16} className={cx("mt-0.5 shrink-0", n.read ? "text-muted" : "text-brand-strong")} />
                      <div className="min-w-0">
                        <p className={cx("text-[14px] text-ink", !n.read && "font-semibold")}>{n.title}</p>
                        <p className="line-clamp-2 text-[13px] text-muted">{n.message}</p>
                        <p className="mt-0.5 text-[12px] text-muted">{fmtDate(n.sentAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-[14px] text-muted">You&apos;re all caught up.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
