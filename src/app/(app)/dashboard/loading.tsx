import { Container } from "@/components/ui/surface";

const bar = "animate-pulse rounded-full bg-surface-3/70";

/** Quiet skeleton while dashboard data loads, shaped like the page it stands in for. */
export default function DashboardLoading() {
  return (
    <Container className="py-8 sm:py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard</span>
      <div className="grid gap-3" aria-hidden>
        <div className={`${bar} h-9 w-64 max-w-full`} />
        <div className={`${bar} h-4 w-80 max-w-full`} />
      </div>
      <div
        className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-14"
        aria-hidden
      >
        <div className="grid content-start gap-10">
          <div className="flex items-start justify-between gap-6 rounded-[var(--radius-surface)] border border-border bg-surface-2/60 p-5 sm:p-7">
            <div className="grid flex-1 gap-3">
              <div className={`${bar} h-4 w-44`} />
              <div className={`${bar} h-8 w-3/4`} />
              <div className={`${bar} h-4 w-2/3`} />
              <div className={`${bar} mt-3 h-12 w-40`} />
            </div>
            <div className="size-[84px] shrink-0 animate-pulse rounded-full border-[6px] border-surface-3/70" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="grid gap-5 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
              <div className="flex items-center gap-4">
                <div className="size-12 shrink-0 animate-pulse rounded-[14px] bg-surface-3/70" />
                <div className="grid flex-1 gap-2">
                  <div className={`${bar} h-5 w-56 max-w-full`} />
                  <div className={`${bar} h-3.5 w-32`} />
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-[76px] w-16 shrink-0 animate-pulse rounded-[10px] bg-surface-3/70" />
                <div className="grid flex-1 gap-2 pt-1">
                  <div className={`${bar} h-4 w-40`} />
                  <div className={`${bar} h-4 w-64 max-w-full`} />
                  <div className={`${bar} h-6 w-24`} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid content-start gap-4 max-lg:hidden">
          <div className={`${bar} h-6 w-32`} />
          <div className="h-64 animate-pulse rounded-[var(--radius-surface)] border border-border bg-surface" />
        </div>
      </div>
    </Container>
  );
}
