"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, ShieldCheck, Tag as TagIcon } from "lucide-react";
import { money } from "@/lib/mock";
import { api, ApiError, checkoutTotal, goToSignin, type PlanModel, type PricingPlan } from "@/lib/propApi";
import { MODEL_LABEL, useApi } from "@/lib/portal-data";
import { CHALLENGE_RULES, normalizeChallengeRuleKey, WEEKEND_HOLDING_ADDON_PERCENT } from "@/lib/rulebook";
import { MANUAL_CRYPTO_PAYMENT_METHOD, MANUAL_WALLETS } from "@/config/manualWallets";
import { btnPrimary, btnSecondary, Card, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Field, inputCls, KV, PageHeader, Segmented, Tabs } from "@/components/portal/kit";

const k = (n: number) => (n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}K`);
const MODEL_ORDER: PlanModel[] = ["Two Step", "One Step", "Instant"];
const PLATFORMS = ["MT5", "MT4", "cTrader"] as const;
const CARD = "Paddle";

export default function ChallengesView() {
  const { data, error, loading, reload } = useApi(async () => {
    const [plans, geo] = await Promise.all([api.pricingPlans(), api.geo().catch(() => null)]);
    return { plans: plans.plans.filter((p) => String(p.status).toLowerCase() === "active"), cardOk: geo?.cardPaymentAvailable !== false };
  });

  const models = useMemo(() => MODEL_ORDER.filter((m) => data?.plans.some((p) => p.model === m)), [data]);
  const [model, setModel] = useState<PlanModel>("Two Step");
  const sizes = useMemo(() => (data?.plans ?? []).filter((p) => p.model === model).sort((a, b) => a.size - b.size), [data, model]);
  const [planId, setPlanId] = useState("");
  const plan: PricingPlan | undefined = sizes.find((p) => p.id === planId) ?? sizes[0];

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("MT5");
  const methods = [
    ...(data?.cardOk ? [{ key: CARD, label: "Card / Apple Pay / Google Pay" }] : []),
    ...(MANUAL_WALLETS.length ? [{ key: MANUAL_CRYPTO_PAYMENT_METHOD, label: "Crypto (USDT / BTC)" }] : []),
  ];
  const [method, setMethod] = useState("");
  const payMethod = methods.find((m) => m.key === method)?.key ?? methods[0]?.key ?? "";

  const [weekend, setWeekend] = useState(false);
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; pct: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null);

  useEffect(() => {
    if (models.length && !models.includes(model)) setModel(models[0]);
  }, [models, model]);
  // Any change to what is being bought invalidates a pending price confirmation.
  useEffect(() => setConfirmAmount(null), [plan?.id, weekend, coupon, payMethod]);

  const rule = CHALLENGE_RULES[normalizeChallengeRuleKey(model)];
  const base = plan ? plan.price * (weekend ? 1 + WEEKEND_HOLDING_ADDON_PERCENT / 100 : 1) : 0;
  const total = plan ? checkoutTotal(plan.price, { weekendHoldingAddon: weekend, discountPercent: coupon?.pct }) : 0;

  const applyCoupon = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setCouponMsg("");
    try {
      const r = await api.checkCoupon(c);
      setCoupon({ code: r.coupon.code, pct: Number(r.coupon.discountPercent) });
    } catch {
      // Not a coupon — may still be an affiliate code, which the server checks at checkout.
      setCoupon({ code: c, pct: 0 });
      setCouponMsg("Code not recognised as a coupon. If it is a referral code, the discount is applied at checkout.");
    }
  };

  const buy = async () => {
    if (!plan || !payMethod) return;
    setBusy(true);
    setErr("");
    try {
      const { order } = await api.orders.create({
        planId: plan.id,
        paymentMethod: payMethod,
        couponUsed: coupon?.code || undefined,
        weekendHoldingAddon: weekend,
        expectedAmount: confirmAmount ?? total,
      });
      window.location.href = `/pay?orderId=${encodeURIComponent(order.id)}&platform=${platform}`;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return goToSignin();
      if (e instanceof ApiError && e.data?.code === "PRICE_CHANGED") {
        setConfirmAmount(Number(e.data.amount));
        setErr(`The final total is ${money(Number(e.data.amount))}. Review it and confirm to continue.`);
      } else {
        setErr(e instanceof Error ? e.message : "Could not create your order.");
      }
      setBusy(false);
    }
  };

  if (loading || error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Challenges" sub="Pick a program and simulated account size. Pass the evaluation and earn performance rewards." />
        <LoadState loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  if (!models.length) {
    return (
      <div className="space-y-5">
        <PageHeader title="Challenges" />
        <FormMessage tone="info">No challenges are on sale right now. Please check back soon.</FormMessage>
      </div>
    );
  }

  const shownTotal = confirmAmount ?? total;
  return (
    <div className="space-y-5">
      <PageHeader title="Challenges" sub="Pick a program and simulated account size. Pass the evaluation and earn performance rewards." />

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">Account type</h3>
            <Segmented
              label="Account type"
              options={models}
              value={model}
              onChange={(m) => {
                setModel(m);
                setPlanId("");
              }}
              render={(m) => MODEL_LABEL[m]}
              cols="grid-cols-3"
            />

            <h3 className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-wide text-muted">Account size</h3>
            <Segmented
              label="Account size"
              options={sizes.map((p) => p.id)}
              value={plan?.id ?? ""}
              onChange={setPlanId}
              render={(id) => k(sizes.find((p) => p.id === id)?.size ?? 0)}
              cols="grid-cols-3 sm:grid-cols-6"
            />
          </Card>

          <Card title={`${MODEL_LABEL[model]} rules`}>
            <ul className="grid gap-3 text-[14px] text-ink-2">
              {rule.features.map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <Check size={16} className="mt-0.5 shrink-0 text-success" /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[13px] text-muted">
              Full details: <a href="/rules" target="_blank" className="font-medium text-brand-strong hover:underline">Trading rules</a>
            </p>
          </Card>
        </div>

        <Card className="h-fit xl:sticky xl:top-24">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-muted">Your challenge</p>
          <p className="mt-2 text-[24px] font-bold text-ink">
            {MODEL_LABEL[model]} · {plan ? k(plan.size) : "—"}
          </p>

          <h3 className="mb-2.5 mt-6 text-[13px] font-medium text-ink-2">Platform</h3>
          <Segmented label="Platform" options={[...PLATFORMS]} value={platform} onChange={setPlatform} />

          <h3 className="mb-2.5 mt-6 text-[13px] font-medium text-ink-2">Payment method</h3>
          {methods.length ? (
            <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
              {methods.map((m) => (
                <label key={m.key} className={cx("flex cursor-pointer items-center gap-3 rounded-tile border px-4 py-3 text-[14px]", payMethod === m.key ? "border-brand-strong bg-brand-soft" : "border-line")}>
                  <input type="radio" name="method" checked={payMethod === m.key} onChange={() => setMethod(m.key)} className="accent-[var(--brand-strong)]" />
                  {m.label}
                </label>
              ))}
            </div>
          ) : (
            <FormMessage tone="error">No payment method is available yet. Please contact support.</FormMessage>
          )}

          <label className="mt-5 flex items-start gap-2.5 text-[14px] text-ink-2">
            <input type="checkbox" checked={weekend} onChange={(e) => setWeekend(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand-strong)]" />
            <span>
              Weekend holding add-on <span className="text-muted">(+{WEEKEND_HOLDING_ADDON_PERCENT}%)</span>
            </span>
          </label>

          <div className="mt-5">
            <Field label="Coupon or referral code" hint={coupon?.pct ? `${coupon.code}: ${coupon.pct}% off` : couponMsg}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <TagIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code" className={cx(inputCls, "pl-9 uppercase placeholder:normal-case")} />
                </div>
                <button type="button" onClick={applyCoupon} className={btnSecondary}>
                  Apply
                </button>
              </div>
            </Field>
          </div>

          <div className="mt-6 space-y-2.5 rounded-tile bg-surface-2 p-4">
            <KV k="Challenge fee" v={money(plan?.price ?? 0)} />
            {weekend && <KV k="Weekend add-on" v={money(base - (plan?.price ?? 0))} />}
            {!!coupon?.pct && <KV k={`Discount (${coupon.code})`} v={<span className="text-success">-{money(base - total)}</span>} />}
            <div className="border-t border-line pt-2.5">
              <KV k={<span className="font-semibold text-ink">Total</span>} v={<span className="text-[20px]">{money(shownTotal)}</span>} />
            </div>
          </div>

          <label className="mt-5 flex items-start gap-2.5 text-[13px] text-ink-2">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand-strong)]" />
            <span>
              I agree to the <a href="/terms" target="_blank" className="underline">Terms of Service</a> and the{" "}
              <a href="/rules" target="_blank" className="underline">trading rules</a>.
            </span>
          </label>

          {err && <div className="mt-4"><FormMessage tone={confirmAmount ? "info" : "error"}>{err}</FormMessage></div>}

          <button type="button" disabled={!agree || !plan || !payMethod || busy} onClick={buy} className={cx(btnPrimary, "mt-5 w-full")}>
            {busy ? "Creating order…" : confirmAmount ? `Confirm · ${money(confirmAmount)}` : `Continue to payment · ${money(total)}`}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted">
            <ShieldCheck size={14} /> Secure checkout
          </p>
        </Card>
      </div>
    </div>
  );
}
