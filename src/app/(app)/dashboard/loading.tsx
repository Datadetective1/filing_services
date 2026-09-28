import { Container } from "@/components/ui/surface";

/** Quiet skeleton while dashboard data loads. */
export default function DashboardLoading() {
  return (
    <Container className="grid gap-10 py-8 sm:py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard</span>
      <div className="grid gap-2" aria-hidden>
        <div className="h-8 w-56 animate-pulse rounded-[var(--radius-control)] bg-surface-2" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-[var(--radius-control)] bg-surface-2" />
      </div>
      <div className="grid gap-4" aria-hidden>
        {[0, 1].map((i) => (
          <div key={i} className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-6">
            <div className="h-5 w-64 max-w-full animate-pulse rounded-[var(--radius-control)] bg-surface-2" />
            <div className="h-4 w-40 animate-pulse rounded-[var(--radius-control)] bg-surface-2" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded-[var(--radius-control)] bg-surface-2" />
          </div>
        ))}
      </div>
    </Container>
  );
}
