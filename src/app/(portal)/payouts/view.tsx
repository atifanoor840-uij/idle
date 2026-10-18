"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BadgeCheck, CalendarClock, CheckCircle2, Percent, Wallet } from "lucide-react";
import { money } from "@/lib/mock";
import { api, ApiError, goToSignin } from "@/lib/propApi";
import { fmtDate, toUiAccount, useApi } from "@/lib/portal-data";
import { PAYOUT_PERIOD_DAYS } from "@/lib/payoutRules";
import { PROFIT_SPLIT_BY_WITHDRAWAL } from "@/lib/rulebook";
import { btnPrimary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, Field, inputCls, NoticeStrip, PageHeader, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

const MIN_PAYOUT = 100; // enforced by POST /api/payouts
const METHODS = [
  { id: "USDT (TRC20)", label: "Crypto · USDT (TRC20)" },
  { id: "Bank Transfer", label: "Bank transfer" },
] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function PayoutsView() {
  const { data, error, loading, reload } = useApi(async () => {
    const [acc, ord, pay, kyc] = await Promise.all([api.accounts.list(), api.orders.list(), api.payouts.list(), api.kyc.get()]);
    const accounts = acc.accounts.map((a) => toUiAccount(a, ord.orders));
    return { accounts, payouts: pay.payouts, kyc: kyc.kyc, kycEligible: kyc.isEligible };
  });

  const funded = (data?.accounts ?? []).filter((a) => a.phase === "Funded" && a.status === "Active" && !a.pendingDelivery);
  const [accountId, setAccountId] = useState("");
  const account = funded.find((a) => a.id === accountId) ?? funded[0];
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>(METHODS[0].id);
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [bank, setBank] = useState({ accountName: "", bankName: "", iban: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string>("");

  const kycOk = data?.kyc?.status === "approved";
  const profit = account ? Math.max(0, account.balance - account.size) : 0;
  const paidCount = (data?.payouts ?? []).filter((p) => p.accountId === account?.id && p.status === "paid").length;
  const split = PROFIT_SPLIT_BY_WITHDRAWAL[Math.min(paidCount, PROFIT_SPLIT_BY_WITHDRAWAL.length - 1)];
  const lastPayout = (data?.payouts ?? []).filter((p) => p.accountId === account?.id && p.status !== "rejected").map((p) => new Date(p.createdAt).getTime()).sort((a, b) => b - a)[0];
  const nextWindow = lastPayout ? new Date(lastPayout + PAYOUT_PERIOD_DAYS * 86400000) : null;

  const amt = Number(amount);
  const details = method === "Bank Transfer" ? bank : { address: address.trim() };
  const detailsOk = method === "Bank Transfer" ? bank.accountName.trim() && bank.bankName.trim() && bank.iban.trim().length >= 8 : address.trim().length >= 26;
  const amountErr = amount && (!(amt > 0) ? "Enter an amount." : amt < MIN_PAYOUT ? `Minimum payout is ${money(MIN_PAYOUT, 0)}.` : "");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!account || amountErr || !detailsOk) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.payouts.request({ accountId: account.id, amount: amt, paymentMethod: method, paymentDetails: details });
      setDone(
        r.withdrawal?.wasAdjusted
          ? `Requested ${money(r.withdrawal.adjustedAmount)} — adjusted from ${money(r.withdrawal.requestedAmount)} to fit this period's withdrawal cap.`
          : `Requested ${money(Number(r.payout.amount))}. We'll email you when it's sent.`,
      );
      setAmount("");
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return goToSignin();
      setErr(e instanceof Error ? e.message : "Payout request failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Payouts" sub="Withdraw your profit split from funded accounts." />
      <LoadState loading={loading} error={error} onRetry={reload} />

      {data && (
        <>
          {!kycOk && (
            <NoticeStrip tone="warning">
              {data.kyc?.status === "pending" || data.kyc?.status === "needs_review"
                ? "Your identity check is under review. You can request payouts once it is approved."
                : data.kycEligible
                  ? "Identity verification (KYC) is required before your first payout."
                  : "Payouts unlock once you have a funded account and complete identity verification."}{" "}
              <Link href="/profile" className="underline">
                Go to Profile &amp; KYC
              </Link>
            </NoticeStrip>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: Wallet, label: "Profit on account", value: money(profit), sub: account ? `#${account.login}` : "No funded account yet" },
              { icon: Percent, label: "Your profit split", value: `${split}%`, sub: `Rises to ${PROFIT_SPLIT_BY_WITHDRAWAL.at(-1)}% by your ${PROFIT_SPLIT_BY_WITHDRAWAL.length}rd payout` },
              { icon: CalendarClock, label: "Next payout window", value: nextWindow && nextWindow.getTime() > Date.now() ? fmtDate(nextWindow.toISOString()) : "Open", sub: `One request every ${PAYOUT_PERIOD_DAYS} days` },
            ].map((s) => (
              <div key={s.label} className="flex items-start gap-4 rounded-card bg-surface p-5">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-strong">
                  <s.icon size={19} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-muted">{s.label}</p>
                  <p className="mt-1 text-[24px] font-bold text-ink">{s.value}</p>
                  <p className="text-[12.5px] text-muted">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <Card title="Request a payout">
              {!funded.length ? (
                <p className="text-[14px] text-muted">You need an active funded account to request a payout.</p>
              ) : done ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <CheckCircle2 size={40} className="text-success" />
                  <p className="mt-3 text-[17px] font-semibold text-ink">Payout requested</p>
                  <p className="mt-1 text-[14px] text-muted">{done}</p>
                  <button type="button" onClick={() => setDone("")} className={cx(btnPrimary, "mt-5")}>
                    Done
                  </button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={submit}>
                  <Field label="Funded account">
                    <select className={inputCls} value={account?.id ?? ""} onChange={(e) => setAccountId(e.target.value)}>
                      {funded.map((a) => (
                        <option key={a.id} value={a.id}>
                          #{a.login} · {money(a.size, 0)} {a.program}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Method">
                    <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                      {METHODS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Amount (USD)" hint={amountErr || `Minimum ${money(MIN_PAYOUT, 0)}. Larger requests are trimmed to the period cap.`}>
                    <input type="number" inputMode="decimal" min={MIN_PAYOUT} step="0.01" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Field>
                  {method === "Bank Transfer" ? (
                    <>
                      <Field label="Account holder name">
                        <input className={inputCls} autoComplete="name" value={bank.accountName} onChange={(e) => setBank({ ...bank, accountName: e.target.value })} />
                      </Field>
                      <Field label="Bank name">
                        <input className={inputCls} value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
                      </Field>
                      <Field label="IBAN / account number">
                        <input className={inputCls} value={bank.iban} onChange={(e) => setBank({ ...bank, iban: e.target.value })} spellCheck={false} />
                      </Field>
                    </>
                  ) : (
                    <Field label="USDT (TRC20) wallet address" hint="Double-check the network. Crypto payouts can't be reversed.">
                      <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="T…" spellCheck={false} autoComplete="off" />
                    </Field>
                  )}
                  {err && <FormMessage tone="error">{err}</FormMessage>}
                  <button type="submit" disabled={!kycOk || busy || !amount || !!amountErr || !detailsOk} className={cx(btnPrimary, "w-full")}>
                    <BadgeCheck size={16} /> {busy ? "Submitting…" : "Request payout"}
                  </button>
                </form>
              )}
            </Card>

            <Card title="Payout history" className="min-w-0">
              {data.payouts.length ? (
                <div className={tableWrap}>
                  <table className="w-full min-w-[600px] border-collapse">
                    <thead className="bg-surface-2">
                      <tr>
                        <th className={thCls}>ID</th>
                        <th className={thCls}>Date</th>
                        <th className={thCls}>Method</th>
                        <th className={cx(thCls, "text-right")}>Requested</th>
                        <th className={cx(thCls, "text-right")}>Your share</th>
                        <th className={thCls}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payouts.map((p) => (
                        <tr key={p.id} className={trCls}>
                          <td className={cx(tdCls, "text-muted")}>{p.id}</td>
                          <td className={tdCls}>{fmtDate(p.createdAt)}</td>
                          <td className={tdCls}>{p.paymentMethod}</td>
                          <td className={cx(tdCls, "text-right")}>{money(Number(p.amount) || 0)}</td>
                          <td className={cx(tdCls, "text-right font-semibold text-ink")}>{money(Number(p.profitSplitAmount) || 0)}</td>
                          <td className={tdCls}>
                            <Badge>{cap(p.status)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-[14px] text-muted">No payouts yet.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
