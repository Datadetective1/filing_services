import { formatLongDate } from "@/lib/domain/dates";
import type { GovFeeEvaluation } from "@/lib/domain/government-fees";
import { formatCents } from "@/lib/domain/money";
import { cn } from "@/components/ui/cn";

/**
 * Itemized government charges for one business: what's due now, what applies only if the
 * state's own record shows a status we haven't confirmed, and what a verified date-based
 * charge can still be avoided by. No countdowns, no fear: plain conditions.
 */
export function GovernmentFeeList({
  evaluation,
  stateName,
  className,
  notesOnly = false,
}: {
  evaluation: GovFeeEvaluation;
  stateName: string;
  className?: string;
  /** Only the late-charge conditions (when the amounts are already shown in a receipt). */
  notesOnly?: boolean;
}) {
  return (
    <div className={cn("grid gap-3 text-[15px]", className)}>
      {notesOnly ? null : <dl className="grid gap-2.5">
        {evaluation.due.map((l) => (
          <div key={l.key} className="flex items-baseline justify-between gap-4">
            <dt className="text-fg">
              {l.label}
              <span className="block text-[13px] text-muted">
                {l.kind === "government_late_fee" ? `${stateName} charge: ${l.reason}` : `Paid to ${stateName}`}
              </span>
            </dt>
            <dd className="tnum font-semibold text-fg">{formatCents(l.cents)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2.5">
          <dt className="font-semibold text-fg">State total</dt>
          <dd className="tnum font-display text-xl font-semibold text-fg">{formatCents(evaluation.totalCents)}</dd>
        </div>
      </dl>}
      {evaluation.possible.length || evaluation.avoidable.some((a) => a.fileBy) ? (
        <ul className="grid gap-1.5 text-sm leading-6 text-muted">
          {evaluation.possible.map((l) =>
            l.dueBy ? (
              <li key={l.key}>
                If the report due {formatLongDate(l.dueBy)} hasn&apos;t been filed yet, {stateName} adds a {formatCents(l.cents)}{" "}
                {l.label.toLowerCase()}.
              </li>
            ) : (
              <li key={l.key}>
                {stateName} adds a {formatCents(l.cents)} {l.label.toLowerCase()} only if its own record shows the business as{" "}
                {(l.requiresStatus ?? []).join(" or ")}. We haven&apos;t confirmed the current status.
              </li>
            ),
          )}
          {evaluation.avoidable
            .filter((a) => a.fileBy)
            .map((a) => (
              <li key={a.line.key}>
                File by {formatLongDate(a.fileBy!)} to avoid {stateName}&apos;s {formatCents(a.line.cents)} {a.line.label.toLowerCase()}.
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
