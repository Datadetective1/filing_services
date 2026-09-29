import { BellRinging, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";

function stopLabel(offset: number): string {
  if (offset === 0) return "Due";
  return offset < 0 ? String(Math.abs(offset)) : `+${offset}`;
}

function stopLongLabel(offset: number): string {
  if (offset === 0) return "On the due date";
  const n = Math.abs(offset);
  return `${n} ${n === 1 ? "day" : "days"} ${offset < 0 ? "before" : "after"}`;
}

/**
 * The reminder schedule as a track of stops (days before and after the due date),
 * told as a story: reminders arrive, the owner marks it filed, the rest stop.
 * `filedAt` is the offset where the example filing happens.
 */
export function ReminderTimeline({
  offsets,
  filedAt = -14,
  exampleFiling = "annual report",
  className,
}: {
  offsets: readonly number[];
  filedAt?: number;
  exampleFiling?: string;
  className?: string;
}) {
  const stops = [...offsets].sort((a, b) => a - b);
  const filedIndex = stops.indexOf(filedAt);
  const reminderIndex = Math.max(0, filedIndex - 1);

  return (
    <div className={cn("rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-7", className)}>
      {/* Wide: horizontal track */}
      <div className="hidden md:block">
        <div className="grid grid-cols-11 items-end gap-0" aria-hidden>
          <div
            className="relative mb-3 mr-3 rounded-[var(--radius-control)] border border-border bg-bg px-3 py-2.5 shadow-card"
            style={{ gridColumn: `${Math.max(1, filedIndex - 2)} / span 3` }}
          >
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
              <BellRinging size={14} weight="fill" className="text-highlight-strong" />
              Reminder · {stopLongLabel(stops[reminderIndex])}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold leading-snug text-fg">Your {exampleFiling} is due in {Math.abs(stops[reminderIndex])} days</p>
          </div>
          <div
            className="relative mb-3 rounded-[var(--radius-control)] border border-accent/25 bg-accent-soft px-3 py-2.5"
            style={{ gridColumn: `${filedIndex + 1} / span 3` }}
          >
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-accent-soft-fg">
              <CheckCircle size={14} weight="fill" />
              Marked as filed
            </p>
            <p className="mt-0.5 text-[13px] font-semibold leading-snug text-fg">Reminders for this year stop here</p>
          </div>
        </div>

        <ol className="relative grid grid-cols-11">
          {stops.map((o, i) => {
            const stopped = filedIndex >= 0 && i > filedIndex;
            const isDue = o === 0;
            const isFiled = i === filedIndex;
            return (
              <li key={o} className="relative grid justify-items-center gap-2.5 pt-1">
                {/* track segment to the next stop */}
                {i < stops.length - 1 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-1/2 top-[13px] h-0.5 w-full",
                      filedIndex >= 0 && i >= filedIndex ? "border-t-2 border-dashed border-border-strong" : "bg-accent",
                    )}
                  />
                ) : null}
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 grid size-6 place-items-center rounded-full border-2",
                    isFiled
                      ? "border-accent bg-accent text-accent-fg"
                      : stopped
                        ? "border-border-strong bg-surface"
                        : isDue
                          ? "border-highlight-strong bg-highlight"
                          : "border-accent bg-surface",
                  )}
                >
                  {isFiled ? <CheckCircle size={14} weight="bold" /> : null}
                </span>
                <span
                  className={cn(
                    "tnum text-center text-[13px] font-semibold",
                    stopped ? "text-subtle line-through decoration-border-strong" : "text-fg",
                  )}
                >
                  <span className="sr-only">{stopLongLabel(o)}{stopped ? " (not sent: already filed)" : ""}</span>
                  <span aria-hidden>{stopLabel(o)}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex justify-between text-[12px] font-medium text-subtle" aria-hidden>
          <span>Days before the due date</span>
          <span>Days after, only if still open</span>
        </div>
      </div>

      {/* Narrow: vertical list */}
      <ol className="grid gap-0 md:hidden">
        {stops.map((o, i) => {
          const stopped = filedIndex >= 0 && i > filedIndex;
          const isFiled = i === filedIndex;
          return (
            <li key={o} className="relative flex min-h-10 items-center gap-3 pl-1">
              {i < stops.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[12px] top-[26px] h-[calc(100%-14px)] w-0.5",
                    filedIndex >= 0 && i >= filedIndex ? "border-l-2 border-dashed border-border-strong" : "bg-accent",
                  )}
                />
              ) : null}
              <span
                aria-hidden
                className={cn(
                  "relative z-10 grid size-[18px] shrink-0 place-items-center rounded-full border-2",
                  isFiled ? "border-accent bg-accent" : stopped ? "border-border-strong bg-surface" : o === 0 ? "border-highlight-strong bg-highlight" : "border-accent bg-surface",
                )}
              />
              <span className={cn("tnum text-[15px]", stopped ? "text-subtle line-through" : "text-fg")}>
                {stopLongLabel(o)}
              </span>
              {isFiled ? (
                <span className="ml-auto rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent-soft-fg">
                  Marked as filed
                </span>
              ) : null}
              {stopped ? <span className="sr-only">(not sent: already filed)</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
