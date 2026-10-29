import PageShell, { PageHero } from "@/components/PageShell";
import { Checklist } from "@/components/ui";
import { site } from "@/site.config";
import { affiliatePerks, affiliateTiers, contact } from "@/content.config";

export const metadata = {
  title: `Affiliate Partner Program — Earn 10% on Trading Challenges | ${site.name}`,
  description: `Partner with ${site.name}. Refer traders to our prop firm evaluation programs and earn 10% recurring commissions on all trading challenge purchases.`,
};

const steps = [
  { title: "Sign Up", text: "Create an account and access your Affiliate portal — your custom referral link is generated instantly." },
  { title: "Share with Traders", text: "Share your link or discount code with traders seeking a reliable forex evaluation program." },
  { title: "Earn Commissions", text: "Receive 10% commission on every trading challenge and evaluation retake purchased by your audience." },
  { title: "Withdraw Rewards", text: "Withdraw commissions reliably via crypto or bank transfer, or redeem them toward new trading challenges." },
];

export default function AffiliatesPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Affiliate Partnership Program"
        title={"Partner With Idle4ex.\nEarn **10% Commission**."}
        sub="Introduce your trading community to high-standard prop firm evaluation challenges and earn on every evaluation purchase."
        seed={26}
      >
        <a href="/auth/signup" className="btn btn-primary">
          Become an Affiliate Partner
        </a>
      </PageHero>

      <section className="section">
        <div className="container">
          <div className="tiers">
            {affiliateTiers.map((t, i) => (
              <div className={`card tier ${i === affiliateTiers.length - 1 ? "card-dark" : ""}`} key={t.name} data-reveal>
                <span className="plan-tag">{t.name}</span>
                <div className="tier-rate">{t.rate}</div>
                <p className="tier-req">{t.req}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-top0">
        <div className="container center">
          <h2 className="h2" data-reveal>
            How the Affiliate Program Works
          </h2>
          <div className="steps">
            {steps.map((s, i) => (
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
        <div className="container">
          <div className="card card-2col" data-reveal>
            <div>
              <h2 className="h2">Exclusive Perks for Idle4ex Partners</h2>
              <p className="note">
                Running a large trading community? Email <a href={`mailto:${contact.partners}`}>{contact.partners}</a> for custom partner terms.
              </p>
            </div>
            <Checklist items={affiliatePerks} bold />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
