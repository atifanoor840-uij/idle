"use client";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { btnPrimary, Card, EmptyState } from "@/components/portal/ui";

export default function PortalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card>
      <EmptyState
        icon={TriangleAlert}
        title="Something went wrong"
        text="We couldn't load this page. Please try again in a moment."
        action={
          <button type="button" onClick={reset} className={btnPrimary}>
            <RotateCcw size={16} /> Try again
          </button>
        }
      />
    </Card>
  );
}
