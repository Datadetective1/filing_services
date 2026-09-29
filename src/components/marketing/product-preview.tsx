import { BellSimple, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { LogoMark } from "@/components/layout/logo";
import { cn } from "@/components/ui/cn";
import { CountdownRing } from "@/components/visual/countdown-ring";
import { DocumentSheet } from "@/components/visual/document-tile";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { formatLongDate, formatShortDate } from "@/lib/domain/dates";
import type { FilingPeriod } from "@/lib/domain/deadlines";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";

/**
 * A still of the customer dashboard, drawn with real rule data and today's date
 * for an example business. It is an illustration (role="img"), not a working UI.
 */
export function ProductPreview({
  rule,
  period,
  stateName,
  nextReminder,
  className,
}: {
  rule: ComplianceRuleDef;
  period: FilingPeriod;
  stateName: string;
  nextReminder: string | null;
  className?: string;
}) {
  const due = formatLongDate(period.dueDate);
  const label = `Example of the ${stateName} dashboard: the ${period.periodYear} ${rule.filingName.toLowerCase()} is due ${due}, with options to have it filed or mark it filed yourself.`;

  return (
    <figure className={cn("overflow-hidden rounded-[var(--radius-surface)] border border-border bg-bg shadow-lift", className)}>
      <div role="img" aria-label={label}>
        <div aria-hidden className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-2">
            <LogoMark className="scale-75" />
            <span className="text-[13px] font-semibold text-fg">Your businesses</span>
          </div>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted">Example</span>
        </div>

        <div aria-hidden className="grid gap-3 p-4 sm:p-5">
          <div>
            <p className="font-display text-[17px] font-semibold text-fg">Maple &amp; Main Goods LLC</p>
            <p className="text-[13px] text-muted">
              {stateName} · {ENTITY_TYPE_LABELS[rule.entityType]}
            </p>
          </div>

          <div className="rounded-[14px] border border-highlight/50 bg-highlight-soft p-4">
            <p className="text-[12px] font-semibold text-highlight-fg/80">What do I need to do next?</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="font-display text-[17px] font-semibold leading-snug text-fg">
                File the {period.periodYear} {rule.filingName.toLowerCase()} by {formatShortDate(period.dueDate).replace(/, \d{4}$/, "")}
              </p>
              <CountdownRing days={period.daysRemaining} size={56} label="" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-[13px] font-semibold text-accent-fg">
                Have us file it
              </span>
              <span className="inline-flex h-9 items-center rounded-full border border-border-strong bg-surface px-4 text-[13px] font-semibold text-fg">
                I filed it myself
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <BellSimple size={18} weight="fill" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] text-muted">Next reminder</p>
                <p className="tnum truncate text-[13px] font-semibold text-fg">
                  {nextReminder ? formatShortDate(nextReminder) : "On the due date"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3">
              <DocumentSheet title="Last year's report" size="xs" />
              <div className="min-w-0">
                <p className="text-[12px] text-muted">{period.periodYear - 1} report</p>
                <p className="flex items-center gap-1 text-[13px] font-semibold text-fg">
                  <CheckCircle size={14} weight="fill" className="text-accent" />
                  Accepted
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
