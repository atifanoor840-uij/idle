import { Mail, MessageCircle, Users } from "lucide-react";
import PageShell, { PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { contact } from "@/content.config";

export const metadata = {
  title: `Contact Us — ${site.name}`,
  description: `Reach the ${site.name} support team 24/7 by live chat, email or Discord.`,
};

export default function ContactPage() {
  const channels = [
    { icon: MessageCircle, title: "Live chat", text: "Fastest answer — use the chat bubble at the bottom right of any page.", cta: "24/7" },
    { icon: Mail, title: "Email", text: "For account, KYC and payout questions.", cta: contact.email, href: `mailto:${contact.email}` },
    { icon: Users, title: "Discord", text: "Community, live sessions and announcements.", cta: site.banner.cta, href: site.links.discord },
  ];
  return (
    <PageShell>
      <PageHero eyebrow="Contact Us" title={"We’re Here,\n**Around The Clock**."} sub={contact.hours} seed={11} />

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
            <p>Most answers are already in our FAQ.</p>
            <a href="/faq" className="btn btn-outline">
              Read the FAQ
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
