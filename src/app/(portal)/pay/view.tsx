"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Copy, CreditCard, ShieldCheck, Wallet } from "lucide-react";
import { money } from "@/lib/mock";
import { api, ApiError, goToSignin } from "@/lib/propApi";
import { MODEL_LABEL, planInfo, useApi } from "@/lib/portal-data";
import { getTxidError, isManualCryptoMethod, MANUAL_WALLETS } from "@/config/manualWallets";
import { btnPrimary, btnSecondary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Field, inputCls, KV, PageHeader } from "@/components/portal/kit";

const RETURN_COPY: Record<string, { tone: "success" | "info" | "error"; text: string }> = {
  success: { tone: "success", text: "Payment received. Your account is being prepared — we'll email your login details." },
  pending: { tone: "info", text: "Your payment is still being confirmed. This page updates once the provider confirms it." },
  cancelled: { tone: "error", text: "Payment was cancelled. You can try again below." },
};

function CryptoPayment({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [walletId, setWalletId] = useState(MANUAL_WALLETS[0]?.id ?? "");
  const wallet = MANUAL_WALLETS.find((w) => w.id === walletId);
  const [txid, setTxid] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const copy = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const txErr = getTxidError(walletId, txid);
    if (txErr) return setErr(txErr);
    if (!file) return setErr("Attach a screenshot of the transfer.");
    if (file.size > 5 * 1024 * 1024) return setErr("Screenshot must be 5 MB or smaller.");
    setBusy(true);
    setErr("");
    try {
      await api.orders.submitManualPayment({ orderId, walletId, txid: txid.trim(), screenshot: file });
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return goToSignin();
      setErr(e instanceof Error ? e.message : "Could not submit your payment.");
      setBusy(false);
    }
  };

  if (!MANUAL_WALLETS.length) return <FormMessage tone="error">Crypto payments are not available right now. Please contact support.</FormMessage>;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Network">
        {MANUAL_WALLETS.map((w) => (
          <button
            key={w.id}
            type="button"
            role="radio"
            aria-checked={walletId === w.id}
            onClick={() => setWalletId(w.id)}
            className={cx("rounded-tile border px-3 py-2.5 text-left text-[13px]", walletId === w.id ? "border-ink bg-surface-2" : "border-line hover:border-muted")}
          >
            <span className="block font-semibold text-ink">{w.label}</span>
            <span className="block text-muted">{w.network}</span>
          </button>
        ))}
      </div>

      {wallet && (
        <div className="rounded-tile bg-surface-2 p-4">
          <p className="text-[13px] text-muted">
            Send exactly the order total in <strong className="text-ink">{wallet.asset}</strong> on <strong className="text-ink">{wallet.network}</strong>. Sending on another network loses the funds.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-3 py-2 text-[13px] text-ink">{wallet.address}</code>
            <button type="button" onClick={copy} className={btnSecondary} aria-label="Copy address">
              <Copy size={16} /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <Field label="Transaction ID (TXID / hash)">
        <input value={txid} onChange={(e) => setTxid(e.target.value)} required className={inputCls} spellCheck={false} autoComplete="off" />
      </Field>
      <Field label="Screenshot of the transfer" hint="PNG, JPG or WEBP, up to 5 MB.">
        <input type="file" accept="image/png,image/jpeg,image/webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-[14px] text-ink-2 file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:font-medium" />
      </Field>
      {err && <FormMessage tone="error">{err}</FormMessage>}
      <button type="submit" disabled={busy} className={cx(btnPrimary, "w-full")}>
        {busy ? "Submitting…" : "I have sent the payment"}
      </button>
    </form>
  );
}

export default function PayView({ orderId, platform, returnState }: { orderId: string; platform: string; returnState: string }) {
  const { data, error, loading, reload } = useApi(() => api.orders.list(), [orderId]);
  const order = data?.orders.find((o) => o.id === orderId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const payCard = async () => {
    setBusy(true);
    setErr("");
    try {
      const { checkoutUrl } = await api.orders.pay(orderId, platform);
      window.location.href = checkoutUrl;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return goToSignin();
      setErr(e instanceof ApiError && e.status === 503 ? "Card payments are temporarily unavailable. Please try again later or contact support." : e instanceof Error ? e.message : "Could not start the payment.");
      setBusy(false);
    }
  };

  const header = <PageHeader title="Checkout" sub={orderId ? `Order ${orderId}` : undefined} />;
  if (!orderId) {
    return (
      <div className="space-y-5">
        {header}
        <FormMessage tone="error">No order selected. <Link href="/challenges" className="underline">Choose a challenge</Link>.</FormMessage>
      </div>
    );
  }
  if (loading || error) return <div className="space-y-5">{header}<LoadState loading={loading} error={error} onRetry={reload} /></div>;
  if (!order) {
    return (
      <div className="space-y-5">
        {header}
        <FormMessage tone="error">We couldn&apos;t find this order on your account.</FormMessage>
      </div>
    );
  }

  const { model, size } = planInfo(order);
  const crypto = isManualCryptoMethod(order.paymentMethod);
  const awaitingReview = crypto && String(order.gatewayRef || "").startsWith("manual:");
  const pending = order.status.toLowerCase() === "pending";
  const ret = RETURN_COPY[returnState];

  return (
    <div className="space-y-5">
      {header}
      {ret && pending && <FormMessage tone={ret.tone}>{ret.text}</FormMessage>}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card title={crypto ? "Pay with crypto" : "Pay with card"}>
          {!pending ? (
            <div className="flex items-start gap-3 text-[15px] text-ink">
              <CheckCircle2 className="mt-0.5 shrink-0 text-success" />
              <div>
                <p className="font-semibold">This order is {order.status.toLowerCase()}.</p>
                <p className="mt-1 text-ink-2">Your trading account appears under My Accounts as soon as it is ready.</p>
                <Link href="/accounts" className={cx(btnPrimary, "mt-4")}>Go to My Accounts</Link>
              </div>
            </div>
          ) : submitted || awaitingReview ? (
            <div className="flex items-start gap-3 text-[15px] text-ink">
              <CheckCircle2 className="mt-0.5 shrink-0 text-success" />
              <div>
                <p className="font-semibold">Payment submitted for review</p>
                <p className="mt-1 text-ink-2">Our team checks the transaction on-chain, usually within a few hours. You&apos;ll get an email when your account is ready.</p>
                <Link href="/dashboard" className={cx(btnSecondary, "mt-4")}>Back to dashboard</Link>
              </div>
            </div>
          ) : crypto ? (
            <CryptoPayment orderId={order.id} onDone={() => { setSubmitted(true); reload(); }} />
          ) : (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-[14px] text-ink-2">
                <CreditCard size={18} /> You&apos;ll be redirected to our secure payment provider to finish.
              </p>
              {err && <FormMessage tone="error">{err}</FormMessage>}
              <button type="button" onClick={payCard} disabled={busy} className={cx(btnPrimary, "w-full")}>
                {busy ? "Redirecting…" : `Pay ${money(order.amountPaid)}`}
              </button>
            </div>
          )}
        </Card>

        <Card className="h-fit" title="Order summary">
          <div className="space-y-2.5">
            <KV k="Challenge" v={`${MODEL_LABEL[model]} · ${size ? money(size, 0) : "—"}`} />
            <KV k="Platform" v={platform} />
            <KV k="Method" v={<span className="inline-flex items-center gap-1.5">{crypto ? <Wallet size={14} /> : <CreditCard size={14} />}{crypto ? "Crypto" : "Card"}</span>} />
            {order.couponUsed && <KV k="Code" v={order.couponUsed} />}
            {order.weekendHoldingAddon && <KV k="Weekend add-on" v="Included" />}
            <div className="border-t border-line pt-2.5">
              <KV k={<span className="font-semibold text-ink">Total</span>} v={<span className="text-[20px]">{money(order.amountPaid)}</span>} />
            </div>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted">
            <ShieldCheck size={14} /> Payments are processed securely. We never see your card details.
          </p>
        </Card>
      </div>
    </div>
  );
}
