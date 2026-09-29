import { cn } from "@/components/ui/cn";
import { DateTile } from "@/components/visual/date-tile";
import { formatShortDate } from "@/lib/domain/dates";
import { deadlineLabel } from "@/lib/domain/deadline-copy";

/**
 * The filing being worked on, as a small ticket: business, filing, report year and
 * how long until it's due. Shown beside each step of the order so the customer never
 * loses track of what they're filing.
 */
export function FilingTicket({
  businessName,
  stateName,
  filingName,
  periodYear,
  dueDate,
  daysRemaining,
  className,
}: {
  businessName: string;
  stateName: string;
  filingName: string;
  periodYear: number;
  dueDate: string;
  daysRemaining: number;
  className?: string;
}) {
  const overdue = daysRemaining < 0;
  const soon = daysRemaining <= 30;
  return (
    <div className={cn("rounded-[var(--radius-surface)] border border-border bg-surface p-4", className)}>
      <div className="flex items-start gap-3.5">
        <DateTile date={dueDate} size="sm" />
        <div className="grid min-w-0 gap-0.5">
          <p className="font-display text-[17px] font-semibold leading-snug text-fg [overflow-wrap:anywhere]">{businessName}</p>
          <p className="text-sm leading-5 text-muted">
            <span className="tnum">{periodYear}</span> {stateName} {filingName.toLowerCase()}
          </p>
        </div>
      </div>
      <p className="tnum mt-3.5 flex items-center gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-[13px] font-medium text-fg">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", overdue ? "bg-warning" : soon ? "bg-highlight-strong" : "bg-accent")} />
        <span className="sr-only">Due {formatShortDate(dueDate)}, </span>
        {deadlineLabel(daysRemaining, dueDate)}
      </p>
    </div>
  );
}
