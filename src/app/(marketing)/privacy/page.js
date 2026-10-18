import PageShell, { LegalDoc, PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { legalUpdated, privacy } from "@/content.config";

export const metadata = { title: `Privacy Policy — ${site.name}` };

export default function PrivacyPage() {
  return (
    <PageShell>
      <PageHero eyebrow="Legal" title="Privacy **Policy**" seed={4} />
      <LegalDoc
        updated={legalUpdated}
        intro={`This policy explains what personal data ${site.company} collects, why, and the choices you have.`}
        sections={privacy}
      />
    </PageShell>
  );
}
