import AuthShell, { safeNext } from "@/components/auth/AuthShell";
import SigninForm from "@/components/auth/SigninForm";
import { site } from "@/site.config";

export const metadata = { title: `Sign In — ${site.name}`, robots: { index: false } };

export default async function SigninPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <AuthShell
      title="Welcome back"
      sub="Sign in to your trader dashboard."
      footer={
        <>
          New here? <a href={`/auth/signup${sp.ref ? `?ref=${encodeURIComponent(sp.ref)}` : ""}`}>Create an account</a>
          <span aria-hidden="true"> · </span>
          Forgot your password? <a href="/contact">Contact support</a>
        </>
      }
    >
      <SigninForm next={next} notice={sp.next ? "Please sign in to continue." : undefined} />
    </AuthShell>
  );
}
