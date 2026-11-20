import PageShell, { PageHero } from "@/components/PageShell";
import { PayoutGrid } from "@/components/Payouts";
import { PAYOUTS, fmtUsd } from "@/lib/payouts";
import { site } from "@/site.config";

export const metadata = {
  title: "Payouts — Trader Reward Certificates",
  description: `Recent performance reward certificates issued to ${site.name} traders around the world.`,
  alternates: { canonical: "/payout-certificates" },
};

export default function PayoutsPage() {
  const total = PAYOUTS.reduce((s, p) => s + p.amount, 0);
  const countries = new Set(PAYOUTS.map((p) => p.country)).size;
  return (
    <PageShell>
      <PageHero
        eyebrow="Payouts"
        title="Rewards Paid To **Our Traders**"
        sub="Every certificate below is a performance reward issued to a qualified trader. Tap any certificate to view it full size."
      >
        <div className="po-stats">
          <div>
            <b>{fmtUsd(total)}</b>
            <span>Recently paid</span>
          </div>
          <div>
            <b>{PAYOUTS.length}</b>
            <span>Certificates</span>
          </div>
          <div>
            <b>{countries}</b>
            <span>Countries</span>
          </div>
        </div>
      </PageHero>
      <PayoutGrid />
    </PageShell>
  );
}
