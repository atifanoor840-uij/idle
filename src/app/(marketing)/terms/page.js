import PageShell, { LegalDoc, PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { legalUpdated, terms } from "@/content.config";

export const metadata = {
  title: `Terms of Service — ${site.name}`,
  description: `Official terms of service governing participation in ${site.name} educational evaluation programs.`,
};

export default function TermsPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Legal"
        title="Terms of **Service**"
        sub="Important legal terms and rules governing your use of the Idle4ex educational and simulated trading platform."
        seed={3}
      />
      <LegalDoc
        updated={legalUpdated}
        intro={`Please review these Terms of Service carefully before purchasing any evaluation challenge or using any services provided by ${site.company}.`}
        sections={terms}
      />
    </PageShell>
  );
}
