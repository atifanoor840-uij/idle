import { DM_Sans } from "next/font/google";
import { site } from "@/site.config";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800", "900"], variable: "--font-dm" });

export const metadata = {
  title: `${site.name} — Simulated Trading & Evaluation Platform`,
  description: `${site.name}: educational and simulated trader evaluation platform with accounts up to $200K and up to 90% reward split.`,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>{children}</body>
    </html>
  );
}
