import { ArrowSquareOut, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";
import { CountdownRing } from "@/components/visual/countdown-ring";
import { getJurisdiction } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { verifiedText } from "@/lib/compliance/view";
import { formatLongDate, formatShortDate, todayInTimeZone } from "@/lib/domain/dates";
import { deadlineAriaLabel, deadlineCopy } from "@/lib/domain/deadline-copy";
import { filingWindowOpensOn, isFilingWindowOpen, type FilingPeriod } from "@/lib/domain/deadlines";
import { formatCents } from "@/lib/domain/money";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";

/**
 * Compact, live filing status for one verified rule (the homepage hero). Every
 * number on it comes from the verified rule and the current date. After this
 * year's deadline, `missed` is the report that can still be filed; the card shows
 * it first and next year's due date as secondary information.
 */
export function HeroStatusCard({
  rule,
  period,
  missed = null,
  stateName,
  agency,
  className,
}: {
  rule: ComplianceRuleDef;
  period: FilingPeriod;
  missed?: FilingPeriod | null;
  stateName: string;
  agency: string;
  className?: string;
}) {
  const shown = missed ?? period;
  const today = todayInTimeZone(getJurisdiction(rule.stateCode)?.timezone ?? "America/New_York");
  const open = isFilingWindowOpen(rule, shown.periodYear, shown.dueDate, today);
  const opensOn = filingWindowOpensOn(rule, shown.periodYear, shown.dueDate);
  const dueLong = formatLongDate(shown.dueDate);
  const copy = deadlineCopy(shown.daysRemaining, shown.dueDate, { rule, stateName });
  const status =
    copy.passed && open
      ? (copy.note ?? "The report can still be filed.")
      : open
        ? "Filing window is open"
        : `Filing for the ${shown.periodYear} report opens ${formatShortDate(opensOn)}`;

  return (
    <div className={cn("w-full max-w-[22rem] rounded-[var(--radius-surface)] bg-surface p-5 shadow-lift", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
            <span className="rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-fg">
              {rule.stateCode}
            </span>
            {stateName} · {ENTITY_TYPE_LABELS[rule.entityType]}
          </p>
          <p className="mt-2 font-display text-lg font-semibold leading-snug text-fg">
            {shown.periodYear} {rule.filingName.toLowerCase()}
          </p>
          <p className="tnum mt-0.5 text-[15px] text-muted">{copy.passed ? copy.label : `Due ${dueLong}`}</p>
        </div>
        <CountdownRing days={shown.daysRemaining} size={68} label={deadlineAriaLabel(shown.daysRemaining, shown.dueDate)} />
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2 text-[13px] font-medium text-fg">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", open ? "bg-accent" : "bg-highlight")} />
        {status}
      </div>
      {missed ? (
        <p className="tnum mt-2 px-1 text-[13px] text-muted">
          Next: {period.periodYear} report due {formatLongDate(period.dueDate)}
        </p>
      ) : null}

      <dl className="tnum mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="grid gap-0.5">
          <dt className="text-muted">State fee</dt>
          <dd className="font-display text-xl font-semibold text-fg">{formatCents(rule.stateFeeCents, { trimZeros: true })}</dd>
        </div>
        <div className="grid gap-0.5">
          <dt className="text-muted">State late fee</dt>
          <dd className="font-display text-xl font-semibold text-fg">
            {rule.lateFeeCents ? formatCents(rule.lateFeeCents, { trimZeros: true }) : "None"}
          </dd>
        </div>
      </dl>

      <a
        href={rule.officialInfoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex items-start gap-2 border-t border-border pt-3 text-[13px] leading-5 text-muted hover:text-fg"
      >
        <SealCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <span>
          Source: <span className="font-semibold text-fg underline decoration-border-strong underline-offset-2">{agency}</span>
          <ArrowSquareOut size={12} weight="bold" aria-hidden className="ml-0.5 inline align-[-1px]" />
          <span className="sr-only"> (opens the government website in a new tab)</span>
          <span className="block">Verified {verifiedText(rule.lastVerifiedAt)}</span>
        </span>
      </a>
    </div>
  );
}
