import { Nav, OfferTicker } from "@/components/Header";
import Hero from "@/components/Hero";
import Pricing from "@/components/Pricing";
import { HomeCta, HowItWorks, Rewards, TradeYourWay } from "@/components/HomeSections";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import Reveal from "@/components/Reveal";
import { PayoutStrip } from "@/components/Payouts";
import { getPublicPricing } from "@/lib/publicPricing";
import { site } from "@/site.config";

export const metadata = {
  title: `${site.name} | Simulated Trading Evaluations on MT5`,
  description: `Join ${site.name} simulated trading programs: evaluations on MT5 demo accounts, simulated performance rewards, and up to $200K in simulated capital.`,
  alternates: {
    canonical: "/",
  },
};

export const revalidate = 60;

export default async function Home() {
  const models = await getPublicPricing();
  return (
    <>
      <OfferTicker />
      <Nav />
      <main>
        <Hero />
        <PayoutStrip />
        <Pricing models={models} showHeader />
        <Rewards />
        <HowItWorks />
        <TradeYourWay />
        <HomeCta />
      </main>
      <Footer />
      <ChatWidget />
      <Reveal />
    </>
  );
}
