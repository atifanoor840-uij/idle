import PageShell, { PageHero } from "@/components/PageShell";
import { Checklist } from "@/components/ui";
import { site } from "@/site.config";
import { PAYOUT_PERIOD_DAYS, PAYOUT_STEPS, PAYOUT_TERMS, SPLIT_SUMMARY, WITHDRAWAL_CAP_PERCENT } from "@/lib/publicRules";

export const metadata = {
  title: `Performance Rewards & Payout Policy — Prop Firm Evaluation | ${site.name}`,
  description: `Understand how performance rewards work at ${site.name}: bi-weekly 14-day reward cycles, up to 90% reward split, and payout guidelines for simulated funded accounts.`,
};

export default function PayoutPolicyPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Performance Reward Policy"
        title={`Bi-Weekly Rewards Every\n**${PAYOUT_PERIOD_DAYS} Calendar Days**.`}
        sub={`Withdraw up to ${WITHDRAWAL_CAP_PERCENT}% of your simulated account size each period, with a reward split that grows from ${SPLIT_SUMMARY.first}% to ${SPLIT_SUMMARY.max}%.`}
        seed={31}
      />

      <section className="section">
        <div className="container center">
          <h2 className="h2" data-reveal>
            How the Performance Reward Process Works
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
            <h2 className="h2">Evaluation Reward Terms &amp; Guidelines</h2>
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
              Performance rewards are disbursed exclusively to a wallet or bank account registered under your own verified legal name. Every withdrawal
              request is reviewed manually by our compliance team before disbursement.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
