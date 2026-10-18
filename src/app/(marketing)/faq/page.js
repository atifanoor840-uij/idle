import PageShell, { PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { faq } from "@/content.config";

export const metadata = {
  title: `FAQ — ${site.name}`,
  description: `Answers to common questions about ${site.name} challenges, rules, payouts and platforms.`,
};

export default function FaqPage() {
  return (
    <PageShell>
      <PageHero eyebrow="FAQ" title={"Questions,\n**Answered**."} sub="Can’t find what you need? Our team is on live chat 24/7." seed={5} />
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
            <p>Still have a question?</p>
            <a href={site.links.contact} className="btn btn-outline">
              Contact Us
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
