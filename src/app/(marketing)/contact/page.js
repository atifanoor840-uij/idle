import { Mail, MessageCircle, Users } from "lucide-react";
import PageShell, { PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { contact } from "@/content.config";

export const metadata = {
  title: `Contact Trader Support 24/7 — Trading Challenge Help | ${site.name}`,
  description: `Reach the ${site.name} trader support team 24/7. Get assistance with trading challenges, simulated account setups, and evaluation rules.`,
};

export default function ContactPage() {
  const channels = [
    { icon: MessageCircle, title: "Live Chat Support", text: "Fastest response — click the chat widget at the bottom right of any page.", cta: "24/7 Support" },
    { icon: Mail, title: "Email Desk", text: "For evaluation questions, KYC verification, and payout requests.", cta: contact.email, href: `mailto:${contact.email}` },
    { icon: Users, title: "Discord Community", text: "Educational sessions, trading discussions, and platform announcements.", cta: site.banner.cta, href: site.links.discord },
  ];
  return (
    <PageShell>
      <PageHero
        eyebrow="Contact & Support"
        title={"Here to Support Your\n**Trading Journey**."}
        sub="Have questions about a trading challenge or prop firm evaluation? Our dedicated team is available 24/7."
        seed={11}
      />

      <section className="section">
        <div className="container cards-3">
          {channels.map((c) => (
            <div className="card contact-card" key={c.title} data-reveal>
              <span className="contact-ico">
                <c.icon size={22} />
              </span>
              <h2 className="rule-title">{c.title}</h2>
              <p className="rule-text">{c.text}</p>
              {c.href ? (
                <a href={c.href} className="contact-link">
                  {c.cta}
                </a>
              ) : (
                <span className="contact-link">{c.cta}</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section section-top0">
        <div className="container">
          <div className="banner" data-reveal>
            <p>Find immediate answers to common challenge and evaluation questions.</p>
            <a href="/faq" className="btn btn-outline">
              Read Trader FAQ
            </a>
          </div>
          <p className="note center">
            {site.company} · {contact.address}
          </p>
        </div>
      </section>
    </PageShell>
  );
}
