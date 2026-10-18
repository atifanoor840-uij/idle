import Link from "next/link";
import { Compass } from "lucide-react";
import { btnPrimary, Card, EmptyState } from "@/components/portal/ui";

export default function NotFound() {
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Page not found"
        text="This page doesn't exist or the account isn't yours."
        action={
          <Link href="/dashboard" className={btnPrimary}>
            Back to dashboard
          </Link>
        }
      />
    </Card>
  );
}
