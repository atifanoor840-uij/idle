import PageShell, { LegalDoc, PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { legalUpdated, risk } from "@/content.config";

export const metadata = { title: `Risk Disclosure — ${site.name}` };

export default function RiskPage() {
  return (
    <PageShell>
      <PageHero eyebrow="Legal" title="Risk **Disclosure**" seed={6} />
      <LegalDoc updated={legalUpdated} intro={site.footer.riskWarning} sections={risk} />
    </PageShell>
  );
}
