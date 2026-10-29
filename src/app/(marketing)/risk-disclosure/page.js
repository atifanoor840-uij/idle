import PageShell, { LegalDoc, PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { legalUpdated, riskDisclosure } from "@/content.config";

export const metadata = {
  title: `Risk & Educational Disclosure — Trading Challenges | ${site.name}`,
  description: `Comprehensive risk disclosure and educational purpose notice for ${site.name} simulated accounts and trading evaluations.`,
};

export default function RiskPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Educational Notice"
        title="Risk &amp; Educational **Disclosure**"
        sub="Important disclosures regarding simulated trading environments, virtual funds, and skill evaluation."
        seed={6}
      />
      <LegalDoc updated={legalUpdated} intro={site.footer.riskWarning} sections={riskDisclosure} />
    </PageShell>
  );
}
