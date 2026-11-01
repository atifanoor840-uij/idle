import { Nav, TopBar } from "@/components/Header";
import Hero from "@/components/Hero";
import QuoteBoard from "@/components/QuoteBoard";
import Pricing from "@/components/Pricing";
import {
  AppCard,
  Banner,
  FeatureCards,
  FinalCta,
  MarketsCard,
  NumbersBand,
  Payouts,
  PlatformsCard,
  ProofBand,
  Steps,
} from "@/components/Sections";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import Reveal from "@/components/Reveal";
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
      <TopBar />
      <Nav />
      <main>
        <Hero />
        <QuoteBoard />
        <Pricing models={models} showHeader />
        <FeatureCards />
        <ProofBand />
        <PlatformsCard />
        <MarketsCard />
        <NumbersBand />
        <Payouts />
        <Steps />
        <AppCard />
        <Banner />
        <FinalCta />
      </main>
      <Footer />
      <ChatWidget />
      <Reveal />
    </>
  );
}
