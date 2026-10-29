import { DM_Sans } from "next/font/google";
import Script from "next/script";
import { site } from "@/site.config";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800", "900"], variable: "--font-dm" });

export const metadata = {
  metadataBase: new URL("https://idle4ex.com"),
  title: {
    default: `${site.name} — Prop Firm Evaluation & Trading Challenges`,
    template: `%s | ${site.name}`,
  },
  description: `Pass our trading challenge and get funded as a trader. ${site.name} offers skill-based programs, simulated accounts up to $200K, and up to 90% performance rewards for educational purposes.`,
  keywords: [
    "trading challenge",
    "prop firm evaluation",
    "get funded as a trader",
    "forex evaluation program",
    "simulated accounts",
    "skill-based programs",
    "educational purposes",
    "trader evaluation platform",
    "prop firm challenge",
  ],
  authors: [{ name: site.name }],
  creator: site.name,
  publisher: site.company,
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://idle4ex.com",
    siteName: site.name,
    title: `${site.name} — Prop Firm Evaluation & Trading Challenges`,
    description: `Pass our trading challenge and get funded as a trader. ${site.name} provides skill-based programs, simulated accounts up to $200K, and up to 90% performance rewards for educational purposes.`,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — Prop Firm Evaluation & Trading Challenges`,
    description: `Pass our trading challenge and get funded as a trader. Explore skill-based programs on simulated accounts up to $200K.`,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>
        {children}
        {/* Zen-try Live Chat Support */}
        <Script src="https://zen-try.site/widget.js" data-workspace-id="0a16652f-4cd3-4a90-8a1c-035ac6d11234" strategy="afterInteractive" />
      </body>
    </html>
  );
}
