import { formatCents } from "@/lib/domain/money";
import type { Quote } from "@/lib/domain/pricing";
import { cn } from "@/components/ui/cn";

/**
 * The transparent price display required before payment:
 *   Government filing fee / Our service fee / Total today.
 * The state fee is never folded into our fee, and it is always listed first.
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
    <dl className={cn("grid gap-3 text-[15px]", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-fg">
          Government filing fee
          <span className="block text-[13px] text-muted">Paid to {stateName}, passed through at cost</span>
        </dt>
        <dd className="tnum font-semibold text-fg">{formatCents(quote.governmentFeeCents)}</dd>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <dt className="text-fg">
          Our service fee
          <span className="block text-[13px] text-muted">Preparation, submission and records</span>
        </dt>
        <dd className="tnum font-semibold text-fg">{formatCents(quote.serviceFeeCents)}</dd>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-4 border-t-2 border-dashed border-border-strong pt-3.5">
        <dt className="font-semibold text-fg">{totalLabel}</dt>
        <dd className="tnum font-display text-2xl font-semibold text-fg">{formatCents(quote.totalCents)}</dd>
      </div>
    </dl>
  );
}
