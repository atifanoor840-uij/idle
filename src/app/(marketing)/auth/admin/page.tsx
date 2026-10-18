import AuthShell, { safeNext } from "@/components/auth/AuthShell";
import SigninForm from "@/components/auth/SigninForm";
import { site } from "@/site.config";

export const metadata = { title: `Admin Sign In — ${site.name}`, robots: { index: false, follow: false } };

export default async function AdminSigninPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, "/admin");
  return (
    <AuthShell title="Admin sign in" sub="Staff access to the CRM.">
      <SigninForm
        mode="admin"
        next={next.startsWith("/admin") ? next : "/admin"}
        notice={sp.denied ? "This account does not have admin access. Sign in with an admin account." : undefined}
      />
    </AuthShell>
  );
}
