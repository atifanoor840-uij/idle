import PageShell, { PageHero } from "@/components/PageShell";
import Pricing from "@/components/Pricing";
import { Checklist } from "@/components/ui";
import { site } from "@/site.config";
import { getPublicPricing } from "@/lib/publicPricing";
import { SPLIT_SUMMARY, WEEKEND_HOLDING_ADDON_PERCENT, OVERNIGHT_HOLDING_ADDON_PERCENT } from "@/lib/publicRules";

export const metadata = {
  title: `Trading Challenge Pricing & Plans — Prop Firm Evaluation | ${site.name}`,
  description: `Compare ${site.name} trading challenge pricing from $5K to $200K. Choose 1-Step, 2-Step, or Instant simulated accounts with transparent evaluation rules and up to 90% reward split.`,
};

// Prices come from the same pricing_plans table checkout uses; refresh every minute.
export const revalidate = 60;

const included = [
  `Performance reward split from ${SPLIT_SUMMARY.first}% up to ${SPLIT_SUMMARY.max}%`,
  "Access to a funded account upon successful evaluation",
  "No time limits on trading evaluations",
  "News trading allowed during evaluation stages",
  `Optional weekend holding add-on (+${WEEKEND_HOLDING_ADDON_PERCENT}%)`,
  `Optional overnight holding add-on (+${OVERNIGHT_HOLDING_ADDON_PERCENT}%)`,
  "MetaTrader 5, MetaTrader 4 or cTrader",
  "Real-time trader dashboard with every rule tracked",
  "Professional skill-based programs on simulated accounts",
];

export default async function PricingPage() {
  const models = await getPublicPricing();
  return (
    <PageShell>
      <PageHero
        eyebrow="Evaluation Plans & Pricing"
        title={`Choose Your **Trading Challenge**.\nUnlock Up To **${SPLIT_SUMMARY.max}%** Rewards.`}
        sub="Transparent one-time evaluation fees with no monthly subscriptions. Pass the evaluation to gain access to a funded account upon successful completion."
        seed={14}
      />
      <Pricing models={models} />

      <section className="section section-top0">
        <div className="container">
          <div className="card card-center" data-reveal>
            <h2 className="h2">Included With Every Trading Evaluation Account</h2>
            <Checklist items={included} bold className="grid-3" />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
