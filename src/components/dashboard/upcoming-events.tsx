import Link from "next/link";
import type { BusinessView, RequirementView } from "@/app/(app)/dashboard/_lib/data";
import { DateChip, DaysRemaining, DueDate, isHandledByUs } from "./due-info";
import { businessHref, filingHref } from "./steps";

/** Open filing deadlines across all businesses, earliest first, as a small agenda. */
export function UpcomingEvents({
  items,
  businesses,
}: {
  items: RequirementView[];
  businesses: Map<string, BusinessView>;
}) {
  return (
    <ol className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
      {items.map((req) => {
        const business = businesses.get(req.businessId);
        const href = req.activeFiling ? filingHref(req.activeFiling.id) : businessHref(req.businessId);
        const late = req.daysRemaining < 0 && !isHandledByUs(req);
        return (
          <li key={req.id} className="flex items-start gap-3.5 border-b border-border p-4 last:border-b-0">
            <DateChip value={req.dueDate} size="sm" tone={late ? "late" : "default"} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              <p className="font-semibold leading-snug text-fg">
                <Link href={href} className="rounded-[6px] transition-colors hover:text-accent">
                  {req.periodYear} {business ? `${business.stateName} ` : ""}
                  {req.filingName}
                </Link>
              </p>
              <p className="truncate text-sm text-muted">{business?.legalName ?? "Your business"}</p>
              <p className="text-sm">
                <span className="sr-only">Due </span>
                <span className="text-muted">
                  <DueDate value={req.dueDate} short />
                </span>
                <span aria-hidden className="mx-1.5 text-subtle">
                  ·
                </span>
                <DaysRemaining requirement={req} />
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
