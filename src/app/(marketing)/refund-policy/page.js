import PageShell, { LegalDoc, PageHero } from "@/components/PageShell";
import { site } from "@/site.config";
import { legalUpdated, refundPolicy } from "@/content.config";

export const metadata = {
  title: `Refund & Fee Reimbursement Policy — Trading Challenges | ${site.name}`,
  description: `Official cancellation and fee reimbursement policy for ${site.name} trading challenges and simulated evaluation programs.`,
};

export default function RefundPolicyPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Evaluation Policy"
        title="Refund &amp; Cancellation **Policy**"
        sub="Clear, transparent terms regarding evaluation fees, 14-day cancellations, and fee reimbursements."
        seed={5}
      />
      <LegalDoc
        updated={legalUpdated}
        intro={`This policy outlines the conditions under which challenge registration fees on ${site.company} may be cancelled, refunded, or reimbursed upon passing your evaluation.`}
        sections={refundPolicy}
      />
    </PageShell>
  );
}
