"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { BadgeCheck, CalendarClock, CheckCircle2, Percent, Wallet } from "lucide-react";
import { money } from "@/lib/mock";
import { api, ApiError, goToSignin } from "@/lib/propApi";
import { fmtDate, toUiAccount, useApi } from "@/lib/portal-data";
import { calculateMinimumWithdrawal, getFirstPayoutEligibleAt, PAYOUT_PERIOD_DAYS, WITHDRAWAL_CAP_PERCENT } from "@/lib/payoutRules";
import {
  FLEX_PROFIT_SPLIT_PERCENT,
  FLEX_REDUCED_PROFIT_SPLIT_PERCENT,
  getProfitSplitPercent,
  PROFIT_SPLIT_BY_WITHDRAWAL,
} from "@/lib/rulebook";
import { btnPrimary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Badge, Field, inputCls, NoticeStrip, PageHeader, tableWrap, tdCls, thCls, trCls } from "@/components/portal/kit";

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 100 >= 11 && n % 100 <= 13 ? 0 : n % 10] ?? "th"}`;
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
  const isFlex = account?.model === "Flex";
  const profit = account ? Math.max(0, account.balance - account.size) : 0;
  // Mirrors POST /api/payouts: the split steps up per clean paid withdrawal and a
  // rejected one restarts it; Flex is a flat 85% (50% after a floating-cap hit).
  const accountPayouts = (data?.payouts ?? []).filter((p) => p.accountId === account?.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const lastRejected = accountPayouts.map((p) => p.status).lastIndexOf("rejected");
  const cleanPaid = accountPayouts.slice(lastRejected + 1).filter((p) => p.status === "paid").length;
  const split = isFlex ? (account?.rules.flexReducedSplit ? FLEX_REDUCED_PROFIT_SPLIT_PERCENT : FLEX_PROFIT_SPLIT_PERCENT) : getProfitSplitPercent(cleanPaid);
  const lastPayout = accountPayouts.filter((p) => p.status !== "rejected").map((p) => new Date(p.createdAt).getTime()).sort((a, b) => b - a)[0];
  const nextWindow = lastPayout ? new Date(lastPayout + PAYOUT_PERIOD_DAYS * 86400000) : null;
  const minPayout = account ? calculateMinimumWithdrawal(account.size, isFlex) : 100;
  const eligibleAt = account ? getFirstPayoutEligibleAt(account.raw.deliveredAt || account.raw.createdAt) : null;
  const inProgress = accountPayouts.some((p) => p.status === "pending" || p.status === "approved" || p.status === "processing");
  const checklist = account
    ? [
        { ok: !eligibleAt || eligibleAt.getTime() <= Date.now(), label: `${PAYOUT_PERIOD_DAYS} days since funded`, hint: eligibleAt && eligibleAt.getTime() > Date.now() ? `Opens ${fmtDate(eligibleAt.toISOString())}` : "" },
        { ok: account.rules.winningDays >= account.rules.minDays, label: `${account.rules.minDays} ${isFlex ? "profitable" : "Winning"} Days this cycle`, hint: `${Math.min(account.rules.winningDays, account.rules.minDays)}/${account.rules.minDays}` },
        { ok: profit - account.rules.newsProfitToDeduct >= minPayout, label: `Realized profit ≥ ${money(minPayout, 0)}`, hint: isFlex ? "" : "1% of the account size" },
        { ok: !account.rules.checks.some((c) => c.id === "overnight-holding" && c.status === "warning"), label: "No overnight holding", hint: "" },
        ...(isFlex ? [{ ok: !account.rules.checks.some((c) => c.id === "profit-consistency" && c.status === "warning"), label: "No day above 20% of profit", hint: "Consistency" }] : []),
        { ok: kycOk, label: "KYC approved & Trader Agreement signed", hint: "" },
        { ok: !inProgress, label: "No withdrawal already in progress", hint: "" },
      ]
    : [];

  const amt = Number(amount);
  const details = method === "Bank Transfer" ? bank : { address: address.trim() };
  const detailsOk = method === "Bank Transfer" ? bank.accountName.trim() && bank.bankName.trim() && bank.iban.trim().length >= 8 : address.trim().length >= 26;
  const amountErr = amount && (!(amt > 0) ? "Enter an amount." : amt < minPayout ? `Minimum payout is ${money(minPayout, 0)}.` : "");

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
              {
                icon: Percent,
                label: "Your profit split",
                value: `${split}%`,
                sub: isFlex
                  ? account?.rules.flexReducedSplit
                    ? "Reduced after a floating loss cap hit"
                    : "Fixed Flex split"
                  : `Rises to ${PROFIT_SPLIT_BY_WITHDRAWAL.at(-1)}% from your ${ordinal(PROFIT_SPLIT_BY_WITHDRAWAL.length)} clean payout`,
              },
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
                  <ul className="space-y-1.5 rounded-tile border border-line p-3">
                    {checklist.map((c) => (
                      <li key={c.label} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className={cx("flex items-center gap-2", c.ok ? "text-ink" : "text-muted")}>
                          <CheckCircle2 size={15} className={c.ok ? "text-success" : "text-line"} /> {c.label}
                        </span>
                        {c.hint && <span className="text-[12px] text-muted">{c.hint}</span>}
                      </li>
                    ))}
                  </ul>
                  <Field
                    label="Amount (USD)"
                    hint={amountErr || (isFlex ? `Minimum ${money(minPayout, 0)}. All trades must be closed. No withdrawal cap.` : `Minimum ${money(minPayout, 0)}. Larger requests are trimmed to the ${WITHDRAWAL_CAP_PERCENT}% period cap.`)}
                  >
                    <input type="number" inputMode="decimal" min={minPayout} step="0.01" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
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
