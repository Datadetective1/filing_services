/** Loading state for console pages while server data is fetched. */
export default function AdminLoading() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading</p>
      <div className="h-8 w-48 animate-pulse rounded-[var(--radius-control)] bg-surface-2" />
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-surface)] border border-border bg-border min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[5.75rem] bg-surface" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[var(--radius-surface)] border border-border bg-surface" />
    </div>
  );
}
