import AuthShell from "@/components/auth/AuthShell";
import VerifyEmail from "@/components/auth/VerifyEmail";
import { site } from "@/site.config";

export const metadata = { title: `Verify Email — ${site.name}`, robots: { index: false } };

// status comes from the /api/auth/verify-email redirect or the sign-up response
const COPY: Record<string, { title: string; text: string }> = {
  success: { title: "Email verified", text: "Your account is ready and you are signed in." },
  invalid: { title: "Link not valid", text: "This verification link was already used or is incorrect. Request a new one below." },
  expired: { title: "Link expired", text: "Verification links last 24 hours. Request a new one below." },
  error: { title: "Something went wrong", text: "We couldn't verify your email. Request a new link below." },
  "email-failed": { title: "Account created", text: "We couldn't send the verification email just now. Request it again below." },
  pending: { title: "Check your inbox", text: "We sent a verification link to your email. Click it to activate your account, then sign in." },
};

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = sp.status && COPY[sp.status] ? sp.status : "pending";
  const copy = COPY[status];
  return (
    <AuthShell title={copy.title} sub={copy.text}>
      <VerifyEmail status={status} email={sp.email || ""} />
    </AuthShell>
  );
}
