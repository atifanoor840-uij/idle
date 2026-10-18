import PageShell, { PageHero } from "@/components/PageShell";
import { Checklist } from "@/components/ui";
import { site } from "@/site.config";
import { affiliatePerks, affiliateTiers, contact } from "@/content.config";

export const metadata = {
  title: `Affiliates — ${site.name}`,
  description: `Earn 10% commission referring traders to ${site.name}.`,
};

const steps = [
  { title: "Sign up", text: "Create a client account and open the Affiliate tab — your link is ready instantly." },
  { title: "Share", text: "Post your link or discount code on YouTube, Discord, X or your trading community." },
  { title: "Earn", text: "Get commission on every challenge your referrals buy, retakes included." },
  { title: "Use or withdraw", text: "Spend approved commission on your own challenges, or have it paid out by our team." },
];

export default function AffiliatesPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Affiliate Program"
        title={"Refer Traders.\nEarn **10%** Commission."}
        sub="Commission on every challenge your audience buys, tracked live in your dashboard."
        seed={26}
      >
        <a href="/auth/signup" className="btn btn-primary">
          Become an Affiliate
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
            How it works
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
              <h2 className="h2">Everything partners get</h2>
              <p className="note">
                Running a large community? Email <a href={`mailto:${contact.partners}`}>{contact.partners}</a> for custom deals.
              </p>
            </div>
            <Checklist items={affiliatePerks} bold />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
