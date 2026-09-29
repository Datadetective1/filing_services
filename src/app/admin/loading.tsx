/** Loading state for console pages while server data is fetched. */
export default function AdminLoading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading</p>
      <div className="grid gap-2.5">
        <div className="h-8 w-44 animate-pulse rounded-full bg-surface-3" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-surface-2" />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid gap-px overflow-hidden rounded-[var(--radius-surface)] border border-border bg-border">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 bg-surface px-5 py-4">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-surface-2" />
              <div className="grid flex-1 gap-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-surface-2" />
                <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-3" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-[var(--radius-surface)] border border-border bg-surface" />
      </div>
    </div>
  );
}
