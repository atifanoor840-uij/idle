import PageShell, { LegalDoc, PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { legalUpdated, terms } from "@/content.config";

export const metadata = { title: `Terms of Service — ${site.name}` };

export default function TermsPage() {
  return (
    <PageShell>
      <PageHero eyebrow="Legal" title="Terms of **Service**" seed={3} />
      <LegalDoc updated={legalUpdated} sections={terms} />
    </PageShell>
  );
}
