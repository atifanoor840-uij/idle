import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";
import MetaPixel from "@/components/MetaPixel";
import { site } from "@/site.config";

export const metadata = { title: `Create Account — ${site.name}`, robots: { index: false } };

// ?ref=<affiliate code> and ?collab=<collaborator code> are forwarded to the
// API so referral and collaborator attribution is recorded.
export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const clean = (v?: string) => (v || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  return (
    <AuthShell
      title="Create your account"
      sub="Start your simulated trading evaluation in minutes."
      footer={
        <>
          Already have an account? <a href="/auth/signin">Sign in</a>
        </>
      }
    >
      <SignupForm referralCode={clean(sp.ref)} collaboratorCode={clean(sp.collab)} />
      <MetaPixel />
    </AuthShell>
  );
}
