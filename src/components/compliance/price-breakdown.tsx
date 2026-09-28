import { formatCents } from "@/lib/domain/money";
import type { Quote } from "@/lib/domain/pricing";
import { cn } from "@/components/ui/cn";

/**
 * The transparent price display required before payment:
 *   Government filing fee / Our service fee / Total today.
 * The state fee is never folded into our fee.
 */
export function PriceBreakdown({
  quote,
  stateName,
  className,
  totalLabel = "Total today",
}: {
  quote: Pick<Quote, "governmentFeeCents" | "serviceFeeCents" | "totalCents">;
  stateName: string;
  className?: string;
  totalLabel?: string;
}) {
  return (
    <dl className={cn("grid gap-2 text-[15px]", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted">
          Government filing fee
          <span className="block text-xs text-subtle">Paid to {stateName}, passed through at cost</span>
        </dt>
        <dd className="tnum font-medium text-fg">{formatCents(quote.governmentFeeCents)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-muted">
          Our service fee
          <span className="block text-xs text-subtle">Preparation, submission and records</span>
        </dt>
        <dd className="tnum font-medium text-fg">{formatCents(quote.serviceFeeCents)}</dd>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-3">
        <dt className="font-medium text-fg">{totalLabel}</dt>
        <dd className="tnum text-lg font-semibold text-fg">{formatCents(quote.totalCents)}</dd>
      </div>
    </dl>
  );
}
