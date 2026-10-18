import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { site } from "@/site.config";
import CrmShell from "@/components/crm/CrmShell";
import type { SessionUser } from "@/components/portal/SessionContext";
import { db } from "@/lib/db";
import { readSessionUserId } from "@/lib/session";
import "../(portal)/portal.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: { default: `Admin · ${site.name}`, template: `%s · Admin · ${site.name}` },
  robots: { index: false, follow: false },
};

const themeScript = `try{if(localStorage.getItem('portal-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;

// Only active admins get in. Every /api route re-checks the role server-side too.
async function requireAdmin(): Promise<SessionUser> {
  const userId = readSessionUserId(await cookies());
  const user = userId ? await db.getUserById(userId) : null;
  if (!user || user.status !== "active" || user.role !== "admin") {
    const next = (await headers()).get("x-pathname") || "/admin";
    redirect(`/auth/admin?next=${encodeURIComponent(next)}${user ? "&denied=1" : ""}`);
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

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return (
    <html lang="en" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <CrmShell user={user}>{children}</CrmShell>
      </body>
    </html>
  );
}
