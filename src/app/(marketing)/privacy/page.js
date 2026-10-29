import PageShell, { LegalDoc, PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { legalUpdated, privacy } from "@/content.config";

export const metadata = {
  title: `Privacy Policy — Trader Data Protection & Security | ${site.name}`,
  description: `How ${site.name} collects, protects and manages your personal data and simulated trading evaluation analytics.`,
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Data Privacy"
        title="Privacy **Policy**"
        sub="How we collect, protect, and handle your personal data in full compliance with international privacy standards."
        seed={4}
      />
      <LegalDoc
        updated={legalUpdated}
        intro={`This policy explains what personal data ${site.company} collects, how it is processed and protected, and the legal choices you have under GDPR and applicable data protection regulations.`}
        sections={privacy}
      />
    </PageShell>
  );
}
