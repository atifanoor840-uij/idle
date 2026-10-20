import PageShell, { PageHero } from "@/components/PageShell";
import Pricing from "@/components/Pricing";
import { Checklist } from "@/components/ui";
import { site } from "@/site.config";
import { getPublicPricing } from "@/lib/publicPricing";
import { SPLIT_SUMMARY, WEEKEND_HOLDING_ADDON_PERCENT, OVERNIGHT_HOLDING_ADDON_PERCENT } from "@/lib/publicRules";

export const metadata = {
  title: `Pricing — ${site.name}`,
  description: `Challenge prices and rules for every ${site.name} account size.`,
};

// Prices come from the same pricing_plans table checkout uses; refresh every minute.
export const revalidate = 60;

const included = [
  `Profit split from ${SPLIT_SUMMARY.first}% up to ${SPLIT_SUMMARY.max}%`,
  "No time limit on evaluations",
  "News trading allowed during evaluations",
  `Optional weekend holding add-on (+${WEEKEND_HOLDING_ADDON_PERCENT}%)`,
  `Optional overnight holding add-on (+${OVERNIGHT_HOLDING_ADDON_PERCENT}%)`,
  "MetaTrader 5, MetaTrader 4 or cTrader",
  "Real-time dashboard with every rule tracked",
];

export default async function PricingPage() {
  const models = await getPublicPricing();
  return (
    <PageShell>
      <PageHero
        eyebrow="Pricing"
        title={`Pick Your **Challenge**.\nKeep Up To **${SPLIT_SUMMARY.max}%**.`}
        sub="One-time fee, no subscriptions. Choose a model and an account size."
        seed={14}
      />
      <Pricing models={models} />

      <section className="section section-top0">
        <div className="container">
          <div className="card card-center" data-reveal>
            <h2 className="h2">Included with every account</h2>
            <Checklist items={included} bold className="grid-3" />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
