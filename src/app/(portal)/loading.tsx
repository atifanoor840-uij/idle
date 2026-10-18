import { Skeleton } from "@/components/portal/ui";

export default function Loading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[110px] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded-card" />
    </div>
  );
}
