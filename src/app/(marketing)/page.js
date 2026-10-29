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
  title: `${site.name} — Prop Firm Evaluation, Trading Challenges & Simulated Accounts`,
  description: `Get funded as a trader with ${site.name}. Take our trading challenge or forex evaluation program, trade on simulated accounts up to $200K, and unlock access to a funded account upon successful evaluation.`,
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
