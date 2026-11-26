"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, Check, Headphones, Lock, Tag as TagIcon, Zap } from "lucide-react";
import { money } from "@/lib/mock";
import { api, ApiError, checkoutTotal, goToSignin, type PlanModel, type PricingPlan } from "@/lib/propApi";
import { MODEL_LABEL, useApi } from "@/lib/portal-data";
import { flexPriceSplit, WEEKEND_HOLDING_ADDON_PERCENT, OVERNIGHT_HOLDING_ADDON_PERCENT } from "@/lib/rulebook";
import { MANUAL_CRYPTO_PAYMENT_METHOD, MANUAL_WALLETS } from "@/config/manualWallets";
import { trackPixel } from "@/components/MetaPixel";
import { CRYPTO_ICONS, PaymentIcons } from "@/components/portal/PaymentIcons";
import { btnPrimary, btnSecondary, cx, FormMessage, LoadState } from "@/components/portal/ui";
import { Field, inputCls, KV, PageHeader } from "@/components/portal/kit";

const k = (n: number) => (n >= 1_000_000 ? `$${n / 1_000_000}M` : `$${n / 1000}K`);
const MODEL_ORDER: PlanModel[] = ["Two Step", "One Step", "Instant", "Flex"];
const PLATFORMS = ["MT5", "MT4", "cTrader"] as const;
// Hosted NOWPayments invoice; /api/orders/pay routes any non-manual "crypto" method there.
const CRYPTO_GATEWAY = "Crypto (NOWPayments)";

export default function ChallengesView() {
  const { data, error, loading, reload } = useApi(async () => {
    const [plans, geo] = await Promise.all([api.pricingPlans(), api.geo().catch(() => null)]);
    return {
      plans: plans.plans.filter((p) => String(p.status).toLowerCase() === "active"),
      cryptoGatewayOk: geo?.cryptoGatewayAvailable === true,
    };
  });

  const models = useMemo(() => MODEL_ORDER.filter((m) => data?.plans.some((p) => p.model === m)), [data]);
  const [model, setModel] = useState<PlanModel>("Two Step");
  const sizes = useMemo(() => (data?.plans ?? []).filter((p) => p.model === model).sort((a, b) => a.size - b.size), [data, model]);
  const [planId, setPlanId] = useState("");
  const plan: PricingPlan | undefined = sizes.find((p) => p.id === planId) ?? sizes[0];

  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>("MT5");
  const methods = [
    ...(data?.cryptoGatewayOk ? [{ key: CRYPTO_GATEWAY, label: "Crypto — 100+ coins (NOWPayments)", icons: CRYPTO_ICONS }] : []),
    ...(MANUAL_WALLETS.length
      ? [{ key: MANUAL_CRYPTO_PAYMENT_METHOD, label: "Crypto (USDT / BTC)", icons: [...new Set(MANUAL_WALLETS.map((w) => w.asset.toLowerCase()))] }]
      : []),
  ];
  const [method, setMethod] = useState("");
  const payMethod = methods.find((m) => m.key === method)?.key ?? methods[0]?.key ?? "";

  const [weekend, setWeekend] = useState(false);
  const [overnight, setOvernight] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("weekend") === "1" || params.get("weekend") === "true") setWeekend(true);
      if (params.get("overnight") === "1" || params.get("overnight") === "true") setOvernight(true);
      const sizeParam = Number(params.get("size"));
      if (sizeParam && sizes.length) {
        const matchingPlan = sizes.find((p) => p.size === sizeParam);
        if (matchingPlan) setPlanId(matchingPlan.id);
      }
    }
  }, [sizes]);
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
  useEffect(() => setConfirmAmount(null), [plan?.id, weekend, overnight, coupon, payMethod]);

  // Flex: pay the upfront fee now, the rest after passing; it already allows overnight/weekend holding.
  const isFlex = model === "Flex";
  const flex = plan && isFlex ? flexPriceSplit(plan.price, plan.upfrontPrice, coupon?.pct) : null;
  const weekendOn = weekend && !isFlex;
  const overnightOn = overnight && !isFlex;
  const weekendFee = plan && weekendOn ? plan.price * (WEEKEND_HOLDING_ADDON_PERCENT / 100) : 0;
  const overnightFee = plan && overnightOn ? plan.price * (OVERNIGHT_HOLDING_ADDON_PERCENT / 100) : 0;
  const base = (plan?.price ?? 0) + weekendFee + overnightFee;
  const total = flex ? flex.upfront : plan ? checkoutTotal(plan.price, { weekendHoldingAddon: weekendOn, overnightHoldingAddon: overnightOn, discountPercent: coupon?.pct }) : 0;

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
        weekendHoldingAddon: weekendOn,
        overnightHoldingAddon: overnightOn,
        expectedAmount: confirmAmount ?? total,
      });
      trackPixel("InitiateCheckout", { value: order.amountPaid, currency: "USD", content_ids: [plan.id], content_type: "product" }, `checkout_${order.id}`);
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
        <PageHeader title="Buy a Challenge" sub="Pick a program and simulated account size. Pass the evaluation and earn performance rewards." />
        <LoadState loading={loading} error={error} onRetry={reload} />
      </div>
    );
  }

  if (!models.length) {
    return (
      <div className="space-y-5">
        <PageHeader title="Buy a Challenge" />
        <FormMessage tone="info">No challenges are on sale right now. Please check back soon.</FormMessage>
      </div>
    );
  }

  const shownTotal = confirmAmount ?? total;
  const fromPrice = (m: PlanModel) => Math.min(...(data?.plans ?? []).filter((p) => p.model === m).map((p) => p.price));
  const discounted = (price: number) => (coupon?.pct ? price * (1 - coupon.pct / 100) : price);

  return (
    <div className="space-y-6">
      <PageHeader title="Buy a Challenge" sub="Configure your simulated evaluation account in a few steps. Pass the evaluation and earn performance rewards." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── Configuration ── */}
        <div className="min-w-0 space-y-5">
          <Step n={1} title="Choose your program" sub="Select the evaluation model that fits your trading style.">
            <div role="radiogroup" aria-label="Program" className={cx("grid gap-3", models.length > 3 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 sm:grid-cols-3")}>
              {models.map((m) => (
                <OptionCard
                  key={m}
                  selected={model === m}
                  onSelect={() => {
                    setModel(m);
                    setPlanId("");
                  }}
                >
                  <span className="text-[16px] font-bold text-ink">{MODEL_LABEL[m]}</span>
                  <span className="text-[12.5px] text-muted">from {money(fromPrice(m))}</span>
                </OptionCard>
              ))}
            </div>
          </Step>

          <Step n={2} title="Select account size" sub="Simulated capital for your evaluation account.">
            <div role="radiogroup" aria-label="Account size" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {sizes.map((p) => (
                <OptionCard key={p.id} selected={plan?.id === p.id} onSelect={() => setPlanId(p.id)}>
                  <span className="text-[20px] font-bold tracking-tight text-ink">{k(p.size)}</span>
                  <span className="flex items-baseline gap-1.5 text-[13px]">
                    {coupon?.pct ? <span className="text-muted line-through">{money(p.price)}</span> : null}
                    <span className="font-semibold text-brand-strong">{money(discounted(p.price))}</span>
                  </span>
                </OptionCard>
              ))}
            </div>
          </Step>

          <Step n={3} title="Trading platform" sub="Your account credentials will be issued for this platform.">
            <div role="radiogroup" aria-label="Platform" className="grid grid-cols-3 gap-3">
              {PLATFORMS.map((p) => (
                <OptionCard key={p} selected={platform === p} onSelect={() => setPlatform(p)} center>
                  <span className="text-[15px] font-bold text-ink">{p}</span>
                </OptionCard>
              ))}
            </div>
          </Step>

          <Step n={4} title="Payment method" sub="All payments are processed securely.">
            {methods.length ? (
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                {methods.map((m) => (
                  <OptionCard key={m.key} selected={payMethod === m.key} onSelect={() => setMethod(m.key)}>
                    <span className="pr-5 text-[14px] font-semibold text-ink">{m.label}</span>
                    <PaymentIcons icons={m.icons} />
                  </OptionCard>
                ))}
              </div>
            ) : (
              <FormMessage tone="error">No payment method is available yet. Please contact support.</FormMessage>
            )}
          </Step>

          <Step n={5} title="Add-ons" sub={isFlex ? undefined : "Optional upgrades for your evaluation account."} badge={isFlex ? undefined : "Optional"}>
            {isFlex ? (
              <p className="rounded-tile border border-line bg-surface-2 p-4 text-[13.5px] leading-relaxed text-ink-2">
                Pay <strong className="text-ink">{money(flex?.upfront ?? 0)}</strong> now to start. Pass the evaluation, then pay the remaining{" "}
                <strong className="text-ink">{money(flex?.activationFee ?? 0)}</strong> to receive your funded account. Overnight and weekend holding are included.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <AddonCard
                  checked={weekend}
                  onChange={setWeekend}
                  title="Weekend Holding"
                  pct={WEEKEND_HOLDING_ADDON_PERCENT}
                  fee={plan && weekend ? money(weekendFee) : ""}
                  text="Keep positions open across the weekend through Friday market close without compliance review."
                />
                <AddonCard
                  checked={overnight}
                  onChange={setOvernight}
                  title="Overnight Holding"
                  pct={OVERNIGHT_HOLDING_ADDON_PERCENT}
                  fee={plan && overnight ? money(overnightFee) : ""}
                  text="Hold swing trades through the daily 00:00 UTC rollover without mandatory end-of-day closure."
                />
              </div>
            )}
          </Step>
        </div>

        {/* ── Order summary ── */}
        <aside className="h-fit overflow-hidden rounded-card border border-line bg-surface xl:sticky xl:top-24">
          <div className="border-b border-line bg-surface-2 px-6 py-5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">Order summary</p>
            <p className="mt-1.5 text-[24px] font-bold tracking-tight text-ink">
              {plan ? k(plan.size) : "—"} <span className="text-brand-strong">{MODEL_LABEL[model]}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-muted">Simulated evaluation account · {platform}</p>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="space-y-2.5 text-[13.5px]">
              <KV k="Program" v={MODEL_LABEL[model]} />
              <KV k="Account size" v={plan ? k(plan.size) : "—"} />
              <KV k="Platform" v={platform} />
              {flex ? (
                <>
                  <KV k="Real price" v={money(flex.real)} />
                  {!!coupon?.pct && <KV k={`Discount (${coupon.code})`} v={<span className="font-semibold text-success">-{money(flex.discount)}</span>} />}
                  <KV k="Due after passing" v={money(flex.activationFee)} />
                </>
              ) : (
                <>
                  <KV k="Challenge fee" v={money(plan?.price ?? 0)} />
                  {weekendOn && <KV k={`Weekend holding (+${WEEKEND_HOLDING_ADDON_PERCENT}%)`} v={money(weekendFee)} />}
                  {overnightOn && <KV k={`Overnight holding (+${OVERNIGHT_HOLDING_ADDON_PERCENT}%)`} v={money(overnightFee)} />}
                  {!!coupon?.pct && <KV k={`Discount (${coupon.code})`} v={<span className="font-semibold text-success">-{money(base - total)}</span>} />}
                </>
              )}
            </div>

            <Field label="Coupon or referral code" hint={coupon?.pct ? `${coupon.code} applied: ${coupon.pct}% off` : couponMsg}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <TagIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyCoupon();
                    }}
                    placeholder="Enter code"
                    className={cx(inputCls, "pl-9 uppercase placeholder:normal-case")}
                  />
                </div>
                <button type="button" onClick={applyCoupon} className={btnSecondary}>
                  Apply
                </button>
              </div>
            </Field>

            <div className="flex items-end justify-between border-t border-dashed border-line pt-5">
              <span className="text-[14px] font-semibold text-ink">{flex ? "Pay now" : "Total"}</span>
              <span className="text-right">
                <span className="block text-[30px] font-bold leading-none tracking-tight text-ink">{money(shownTotal)}</span>
                <span className="mt-1 block text-[11.5px] text-muted">One-time fee · USD</span>
              </span>
            </div>

            <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-2">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--brand-strong)]" />
              <span>
                I agree to the <a href="/terms" target="_blank" className="font-medium text-brand-strong hover:underline">Terms of Service</a> and the{" "}
                <a href="/rules" target="_blank" className="font-medium text-brand-strong hover:underline">trading rules</a>.
              </span>
            </label>

            {err && <FormMessage tone={confirmAmount ? "info" : "error"}>{err}</FormMessage>}

            <button type="button" disabled={!agree || !plan || !payMethod || busy} onClick={buy} className={cx(btnPrimary, "h-12 w-full text-[15px] font-semibold")}>
              {busy ? (
                "Creating order…"
              ) : confirmAmount ? (
                `Confirm · ${money(confirmAmount)}`
              ) : (
                <>
                  Continue to payment <ArrowRight size={16} />
                </>
              )}
            </button>

            <ul className="grid grid-cols-3 gap-2 border-t border-line pt-4 text-center text-[11.5px] text-muted">
              <li className="flex flex-col items-center gap-1.5">
                <Lock size={15} className="text-brand-strong" /> Secure checkout
              </li>
              <li className="flex flex-col items-center gap-1.5">
                <Zap size={15} className="text-brand-strong" /> Fast account setup
              </li>
              <li className="flex flex-col items-center gap-1.5">
                <Headphones size={15} className="text-brand-strong" /> 24/7 support
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Step({ n, title, sub, badge, children }: { n: number; title: string; sub?: string; badge?: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-card border border-line bg-surface p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-brand-ink">{n}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
            {badge && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-strong">{badge}</span>}
          </div>
          {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function OptionCard({ selected, onSelect, center, children }: { selected: boolean; onSelect: () => void; center?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        "relative flex min-h-[4.25rem] flex-col justify-center gap-1 rounded-tile border px-4 py-3 text-left transition",
        center && "items-center text-center",
        selected ? "border-brand-strong bg-brand-soft ring-1 ring-brand-strong" : "border-line bg-surface hover:border-muted"
      )}
    >
      {selected && (
        <span className="absolute right-2.5 top-2.5 grid size-4 place-items-center rounded-full bg-brand-strong text-brand-ink" aria-hidden="true">
          <Check size={11} strokeWidth={3} />
        </span>
      )}
      {children}
    </button>
  );
}

function AddonCard({ checked, onChange, title, pct, fee, text }: { checked: boolean; onChange: (v: boolean) => void; title: string; pct: number; fee: string; text: string }) {
  return (
    <label className={cx("flex cursor-pointer items-start gap-3 rounded-tile border p-4 transition", checked ? "border-brand-strong bg-brand-soft ring-1 ring-brand-strong" : "border-line bg-surface hover:border-muted")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--brand-strong)]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold text-ink">{title}</span>
          <span className="shrink-0 rounded-full border border-brand/20 bg-surface px-2 py-0.5 text-[11px] font-bold text-brand-strong">
            +{pct}%{fee ? ` · ${fee}` : ""}
          </span>
        </span>
        <span className="mt-1 block text-[12.5px] leading-relaxed text-muted">{text}</span>
      </span>
    </label>
  );
}
