import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { site } from "@/site.config";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import Shell from "@/components/portal/Shell";
import type { SessionUser } from "@/components/portal/SessionContext";
import { db } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";
import { MetaPixelHead, MetaPixelNoscript } from "@/components/MetaPixel";
import "./portal.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: `Dashboard · ${site.name}`, template: `%s · ${site.name}` },
  robots: { index: false },
};

const themeScript = `try{if(localStorage.getItem('portal-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

// Every portal page sits behind a valid signed session of an active trader.
async function requireUser(): Promise<SessionUser> {
  const userId = readSessionUserId(await cookies());
  const user = userId ? await db.getUserById(userId) : null;
  if (!user || user.status !== "active" || user.role === "collaborator") {
    const next = (await headers()).get("x-pathname") || "/dashboard";
    redirect(`/auth/signin?next=${encodeURIComponent(next)}`);
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    country: user.country || "",
    role: user.role,
    emailVerified: user.emailVerified !== false,
  };
}

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <MetaPixelHead />
      </head>
      <body>
        <MetaPixelNoscript />
        <Shell user={user}>{children}</Shell>
        {/* Zen-try Live Chat Support */}
        <Script src="https://zen-try.site/widget.js" data-workspace-id="0a16652f-4cd3-4a90-8a1c-035ac6d11234" strategy="afterInteractive" />
      </body>
    </html>
  );
}
