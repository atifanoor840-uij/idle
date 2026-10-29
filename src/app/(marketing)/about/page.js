import PageShell, { PageHero } from "@/components/PageShell";
import { FinalCta } from "@/components/Sections";
import { site } from "@/site.config";
import { values } from "@/content.config";

export const metadata = {
  title: `About Us — Prop Firm Evaluation & Skill-Based Programs | ${site.name}`,
  description: `Learn about ${site.name}: an educational trader evaluation platform providing simulated accounts, transparent prop firm evaluations, and pathways to earn performance rewards.`,
};

export default function AboutPage() {
  const stats = [...site.numbers.stats, ...site.proof.stats];
  return (
    <PageShell>
      <PageHero
        eyebrow="About Idle4ex"
        title={"Built By Traders,\n**Focused on Your Growth**."}
        sub="An educational evaluation platform engineered to identify, nurture, and reward consistent trading talent through realistic simulated accounts."
        seed={17}
      />

      <section className="section">
        <div className="container">
          <div className="stat-row" data-reveal>
            {stats.map((s) => (
              <div className="stat-box" key={s.lbl}>
                <div className="num">{s.num}</div>
                <div className="lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-top0">
        <div className="container">
          <div className="card card-2col" data-reveal>
            <h2 className="h2">Our Mission: Clear Pathways to Get Funded as a Trader</h2>
            <div className="prose">
              <p>
                {site.name} is an educational and trader evaluation platform dedicated to assessing trading skill in a realistic
                simulated market environment — without ambiguous clauses, surprise rules, or hidden restrictions.
              </p>
              <p>
                Every account on {site.name} operates as a simulated account with virtual funds for educational purposes. We provide
                transparent trading challenges that allow disciplined traders to prove their strategy and unlock access to a funded
                account upon successful evaluation, backed by bi-weekly performance rewards.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-top0">
        <div className="container">
          <h2 className="h2 sub-h" data-reveal>
            Core Principles of Our Skill-Based Programs
          </h2>
          <div className="cards-3">
            {values.map((v, i) => (
              <div className="card rule-card" key={v.title} data-reveal>
                <span className="step-num">{i + 1}</span>
                <h3 className="rule-title">{v.title}</h3>
                <p className="rule-text">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FinalCta />
    </PageShell>
  );
}
