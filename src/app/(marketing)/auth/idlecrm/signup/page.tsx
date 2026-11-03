import AuthShell from "@/components/auth/AuthShell";
import AdminSignupForm from "@/components/auth/AdminSignupForm";
import { site } from "@/site.config";

export const metadata = { title: `Admin Sign Up — ${site.name}`, robots: { index: false, follow: false } };

export default function AdminSignupPage() {
  return (
    <AuthShell
      title="Create admin account"
      sub="Staff access to the CRM. You need the admin security passcode."
      footer={
        <>
          Already have an admin account? <a href="/auth/idlecrm">Sign in</a>
        </>
      }
    >
      <AdminSignupForm next="/idlecrm" />
    </AuthShell>
  );
}
