import PageShell, { PageHero } from "@/components/PageShell";
import { Checklist } from "@/components/ui";
import { site } from "@/site.config";
import { PAYOUT_PERIOD_DAYS, PAYOUT_STEPS, PAYOUT_TERMS, SPLIT_SUMMARY, WITHDRAWAL_CAP_PERCENT } from "@/lib/publicRules";

export const metadata = {
  title: `Payout Policy — ${site.name}`,
  description: `When and how ${site.name} traders get paid: payout periods, caps, split and methods.`,
};

export default function PayoutPolicyPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Payout Policy"
        title={`Get Paid Every\n**${PAYOUT_PERIOD_DAYS} Days**.`}
        sub={`Withdraw up to ${WITHDRAWAL_CAP_PERCENT}% of your account size each period, with a split that grows from ${SPLIT_SUMMARY.first}% to ${SPLIT_SUMMARY.max}%.`}
        seed={31}
      />

      <section className="section">
        <div className="container center">
          <h2 className="h2" data-reveal>
            How a payout works
          </h2>
          <div className="steps">
            {PAYOUT_STEPS.map((s, i) => (
              <div className="step" key={s.title} data-reveal>
                <span className="step-num">{i + 1}</span>
                <h3 className="step-title">{s.title}</h3>
                <p className="step-text">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-top0">
        <div className="container cards-2 align-start">
          <div className="card" data-reveal>
            <h2 className="h2">Payout terms</h2>
            <dl className="kv">
              {PAYOUT_TERMS.map((r) => (
                <div key={r.k}>
                  <dt>{r.k}</dt>
                  <dd>{r.v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="card card-dark" data-reveal>
            <div className="world-dots" aria-hidden="true" />
            <h2 className="h2">{site.payouts.title}</h2>
            <Checklist items={site.payouts.items} bold />
            <p className="p-dark">
              Payouts go only to a wallet or bank account in your own verified name. Every request is reviewed by our team before it is sent.
              If a request is larger than what&apos;s left of this period&apos;s cap, it is reduced to fit and the rest stays on your account.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
