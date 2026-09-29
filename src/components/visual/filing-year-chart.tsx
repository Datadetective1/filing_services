import { cn } from "@/components/ui/cn";

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function yearFraction(month: number, day: number, year: number): number {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return (Date.UTC(year, month - 1, day) - start) / (end - start);
}

export interface YearChartRow {
  label: string;
  month: number;
  day: number;
}

const ROW = "grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:gap-4";

/**
 * The filing year as one track per due date: each bar runs from January 1, when the
 * window opens, to the due date, with today marked. It pictures the list printed
 * next to it, so it is described once through its accessible label.
 */
export function FilingYearChart({
  rows,
  today,
  className,
}: {
  rows: YearChartRow[];
  /** ISO date (YYYY-MM-DD) in the state's time zone. */
  today: string;
  className?: string;
}) {
  const [y, m, d] = today.split("-").map(Number);
  const todayAt = yearFraction(m, d, y);
  const todayLeft = `${todayAt * 100}%`;
  const todayLabelLeft = `${Math.min(94, Math.max(6, todayAt * 100))}%`;
  const label = `Filing windows open January 1. ${rows
    .map((r) => `${r.label}: due ${MONTH_NAMES[r.month - 1]} ${r.day}`)
    .join(". ")}.`;

  return (
    <figure
      role="img"
      aria-label={label}
      className={cn("rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-card sm:p-6", className)}
    >
      <div aria-hidden>
        {/* Month scale */}
        <div className={cn(ROW, "pb-2")}>
          <span className="hidden text-[12px] font-semibold text-subtle sm:block">Window opens Jan 1</span>
          <div className="grid grid-cols-12 text-center text-[11px] font-semibold uppercase tracking-wide text-subtle">
            {MONTH_INITIALS.map((mi, i) => (
              <span key={i} className={i + 1 === m ? "text-fg" : undefined}>
                {mi}
              </span>
            ))}
          </div>
        </div>

        {rows.map((row) => {
          const end = yearFraction(row.month, row.day, y);
          const passed = todayAt > end;
          return (
            <div key={row.label} className={cn(ROW, "gap-1")}>
              <span className="pt-2 text-[13px] font-semibold leading-snug text-fg sm:pt-0">{row.label}</span>
              <div className="relative h-11">
                <span className="absolute inset-0 grid grid-cols-12">
                  {MONTH_INITIALS.map((_, i) => (
                    <span key={i} className="border-l border-dashed border-border first:border-l-0" />
                  ))}
                </span>
                <span
                  className={cn(
                    "absolute inset-y-2.5 left-0 rounded-full",
                    passed ? "bg-surface-3" : "bg-accent-soft ring-1 ring-inset ring-accent/25",
                  )}
                  style={{ width: `${end * 100}%` }}
                />
                <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-highlight-strong/70" style={{ left: todayLeft }} />
                <span
                  className={cn(
                    "tnum absolute top-1/2 -translate-x-full -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold",
                    passed ? "bg-surface text-subtle ring-1 ring-border-strong" : "bg-accent text-accent-fg",
                  )}
                  style={{ left: `${end * 100}%` }}
                >
                  {MONTH_NAMES[row.month - 1].slice(0, 3)} {row.day}
                </span>
              </div>
            </div>
          );
        })}

        {/* Today */}
        <div className={ROW}>
          <span className="hidden sm:block" />
          <div className="relative h-7">
            <span
              className="absolute top-1 -translate-x-1/2 whitespace-nowrap rounded-full bg-highlight px-2 py-0.5 text-[11px] font-bold text-highlight-fg"
              style={{ left: todayLabelLeft }}
            >
              Today
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}
