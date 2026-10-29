import PageShell, { PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { faq } from "@/content.config";

export const metadata = {
  title: `Frequently Asked Questions — Trading Challenges & Evaluations | ${site.name}`,
  description: `Find answers about ${site.name} trading challenges, simulated account sizes, drawdown rules, bi-weekly performance rewards, and evaluation guidelines.`,
};

export default function FaqPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Trader Knowledge Base"
        title={"Trading Challenge & **Evaluation FAQs**."}
        sub="Everything you need to know about our skill-based programs, simulated accounts, and evaluation criteria."
        seed={5}
      />
      <section className="section">
        <div className="container faq">
          {faq.map((c) => (
            <div className="faq-cat" key={c.cat} data-reveal>
              <h2 className="faq-h">{c.cat}</h2>
              {c.items.map((i) => (
                <details className="faq-item" key={i.q}>
                  <summary>{i.q}</summary>
                  <p>{i.a}</p>
                </details>
              ))}
            </div>
          ))}
          <div className="banner" data-reveal>
            <p>Still have questions about our prop firm evaluation?</p>
            <a href={site.links.contact} className="btn btn-outline">
              Contact Trader Support
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
