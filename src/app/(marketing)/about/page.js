import PageShell, { PageHero } from "@/components/PageShell";
import { FinalCta } from "@/components/Sections";
import { site } from "@/site.config";
import { values } from "@/content.config";

export const metadata = {
  title: `About Us — ${site.name}`,
  description: site.footer.mission,
};

export default function AboutPage() {
  const stats = [...site.numbers.stats, ...site.proof.stats];
  return (
    <PageShell>
      <PageHero eyebrow="About Us" title={"Built By Traders,\n**For Traders**."} sub={site.footer.mission} seed={17} />

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
            <h2 className="h2">Why we exist</h2>
            <div className="prose">
              <p>
                {site.name} is an educational and trader evaluation platform built to assess trading discipline in a realistic
                simulated market environment — without hidden clauses, surprise rules, or unclear conditions.
              </p>
              <p>
                Every account on {site.name} operates in a simulated environment with virtual funds. We publish every evaluation
                rule on a single page, review every performance reward request by hand, and process approved rewards within 24 hours.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-top0">
        <div className="container">
          <h2 className="h2 sub-h" data-reveal>
            What we stand for
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
