import { DM_Sans } from "next/font/google";
import Script from "next/script";
import { site } from "@/site.config";
import { MetaPixelHead, MetaPixelNoscript } from "@/components/MetaPixel";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800", "900"], variable: "--font-dm" });

export const metadata = {
  metadataBase: new URL("https://idle4ex.com"),
  title: {
    default: `${site.name} | Simulated Trading Evaluations on MT5`,
    template: `%s | ${site.name}`,
  },
  description: `Join ${site.name} simulated trading programs: evaluations on MT5 demo accounts, simulated performance rewards, and up to $200K in simulated capital.`,
  keywords: [
    "trading challenge",
    "simulated trading evaluation",
    "MT5 demo account",
    "forex evaluation program",
    "simulated accounts",
    "skill-based programs",
    "educational purposes",
    "trader evaluation platform",
    "simulated trading program",
  ],
  authors: [{ name: site.name }],
  creator: site.name,
  publisher: site.legalEntity.name,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://idle4ex.com",
    siteName: site.name,
    title: `${site.name} | Simulated Trading Evaluations on MT5`,
    description: `Join ${site.name} simulated trading programs: evaluations on MT5 demo accounts, simulated performance rewards, and up to $200K in simulated capital.`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} | Simulated Trading Evaluations on MT5`,
    description: `Join ${site.name} simulated trading programs: evaluations on MT5 demo accounts with up to $200K in simulated capital.`,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <head>
        <MetaPixelHead />
      </head>
      <body>
        <MetaPixelNoscript />
        {children}
        {/* Zen-try Live Chat Support */}
        <Script src="https://zen-try.site/widget.js" data-workspace-id="0a16652f-4cd3-4a90-8a1c-035ac6d11234" strategy="afterInteractive" />
      </body>
    </html>
  );
}
