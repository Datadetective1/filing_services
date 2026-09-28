import Link from "next/link";
import { formatLongDate, parseISODate } from "@/lib/domain/dates";
import { Badge, FilingStatusBadge } from "@/components/ui/badge";
import type { BusinessView, RequirementView } from "@/app/(app)/dashboard/_lib/data";
import { DaysRemaining } from "./due-info";
import { businessHref, filingHref } from "./steps";

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

function DateChip({ value }: { value: string }) {
  const { year, month, day } = parseISODate(value);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    <div
      aria-hidden
      className="grid size-14 shrink-0 place-content-center rounded-[var(--radius-control)] bg-surface-2 text-center leading-none"
    >
      <span className="text-xs font-medium text-muted">{monthFormat.format(d)}</span>
      <span className="tnum mt-1 text-xl font-semibold text-fg">{day}</span>
    </div>
  );
}

/** Open filing deadlines across all businesses, earliest first. */
export function UpcomingEvents({
  items,
  businesses,
}: {
  items: RequirementView[];
  businesses: Map<string, BusinessView>;
}) {
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
      {items.map((req) => {
        const business = businesses.get(req.businessId);
        const href = req.activeFiling ? filingHref(req.activeFiling.id) : businessHref(req.businessId);
        return (
          <li key={req.id} className="flex items-start gap-4 p-4 sm:items-center">
            <DateChip value={req.dueDate} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="font-medium text-fg">
                <Link href={href} className="rounded-[var(--radius-control)] hover:text-accent">
                  {req.periodYear} {business ? `${business.stateName} ` : ""}
                  {req.filingName}
                </Link>
              </p>
              <p className="truncate text-sm text-muted">{business?.legalName ?? "Your business"}</p>
              <p className="text-sm">
                <span className="sr-only">Due </span>
                <time dateTime={req.dueDate} className="tnum text-muted">
                  {formatLongDate(req.dueDate)}
                </time>
                <span aria-hidden className="mx-1.5 text-subtle">
                  ·
                </span>
                <DaysRemaining requirement={req} />
              </p>
              <div className="mt-1.5 sm:hidden">
                {req.activeFiling ? <FilingStatusBadge status={req.activeFiling.status} /> : <Badge>Not ordered</Badge>}
              </div>
            </div>
            <div className="hidden shrink-0 sm:block">
              {req.activeFiling ? <FilingStatusBadge status={req.activeFiling.status} /> : <Badge>Not ordered</Badge>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
