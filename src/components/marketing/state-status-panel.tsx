import { ArrowSquareOut, Info, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/config/site";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { CalendarDate } from "@/components/visual/calendar-date";
import type { ComplianceRuleDef, JurisdictionDef } from "@/lib/compliance/types";
import { verifiedText } from "@/lib/compliance/view";
import { deadlineLabel } from "@/lib/domain/deadline-copy";
import { formatCents } from "@/lib/domain/money";
import { agencyShortName, dueGroups, feeSummary, latestVerified } from "@/lib/seo/content";
import { marketingPeriod } from "@/lib/seo/period";

/** Splits "$7 ($0 for nonprofits)" into the headline amount and its note, for display only. */
function splitFee(text: string): { amount: string; note: string | null } {
  const m = /^(\S+)\s*\((.+)\)$/.exec(text);
  return m ? { amount: m[1], note: m[2] } : { amount: text, note: null };
}

/**
 * The at-a-glance status of a verified state's annual report: due dates by entity
 * type, the state fee, the late fee, the official source with its review date, and
 * the private-service statement. Every value comes from the verified rules.
 */
export function StateStatusPanel({
  j,
  rules,
  feeText,
  className,
}: {
  j: JurisdictionDef;
  rules: ComplianceRuleDef[];
  /** The state's own fee wording when a facts module has it, e.g. "$7 ($0 for nonprofits)". */
  feeText?: string;
  className?: string;
}) {
  const agency = agencyShortName(j);
  const first = rules[0];
  const groups = dueGroups(rules).map((g) => ({ ...g, period: marketingPeriod(g.rules[0]).period }));
  const soonest = groups.reduce<(typeof groups)[number] | null>(
    (best, g) => (g.period.daysRemaining >= 0 && (!best || g.period.daysRemaining < best.period.daysRemaining) ? g : best),
    null,
  );
  const fee = splitFee(feeText ?? feeSummary(rules));
  const noLateFee = rules.every((r) => r.lateFeeCents === null);
  const lateFees = [...new Set(rules.filter((r) => r.lateFeeCents !== null).map((r) => r.lateFeeCents as number))];
  const reviewed = latestVerified(rules);

  return (
    <div className={cn("w-full rounded-[var(--radius-surface)] bg-surface p-5 shadow-lift sm:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="rounded-md bg-accent px-1.5 py-0.5 text-[12px] font-bold tracking-wide text-accent-fg">{j.code}</span>
          <div className="min-w-0">
            <p className="font-display text-[17px] font-semibold leading-tight text-fg">
              {j.name} {first.filingName.toLowerCase()}
            </p>
            {first.formNumber ? <p className="font-mono text-[11px] uppercase tracking-wider text-subtle">Form {first.formNumber}</p> : null}
          </div>
        </div>
        <Badge tone="success">Filing supported</Badge>
      </div>

      <p className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-subtle">Due each year, by entity type</p>
      <ul className="mt-2.5 grid gap-2.5">
        {groups.map((g) => {
          const next = soonest?.day === g.day;
          return (
            <li key={g.day} className="flex items-center gap-3.5">
              <CalendarDate month={g.month} day={g.dayOfMonth} size="sm" />
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="text-[15px] font-semibold leading-snug text-fg">{g.who}</p>
                <p className="tnum text-[13px] text-muted">By {g.day}</p>
              </div>
              {next ? (
                <span className="tnum shrink-0 rounded-full bg-highlight-soft px-2.5 py-1 text-[12px] font-bold text-highlight-fg">
                  {deadlineLabel(g.period.daysRemaining, g.period.dueDate)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-control)] border border-border bg-border">
        <div className="grid content-start gap-0.5 bg-surface-2/70 px-3.5 py-3">
          <dt className="text-[12px] font-medium text-muted">State fee</dt>
          <dd className="tnum">
            <span className="font-display text-2xl font-semibold leading-none text-fg">{fee.amount}</span>
            {fee.note ? <span className="mt-1 block text-[12px] leading-4 text-muted">{fee.note}</span> : null}
          </dd>
        </div>
        <div className="grid content-start gap-0.5 bg-surface-2/70 px-3.5 py-3">
          <dt className="text-[12px] font-medium text-muted">State late fee</dt>
          <dd className="tnum font-display text-2xl font-semibold leading-none text-fg">
            {noLateFee ? "None" : lateFees.map((c) => formatCents(c, { trimZeros: true })).join(" / ")}
          </dd>
        </div>
      </dl>

      <a
        href={first.officialInfoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-4 flex items-start gap-2 text-[13px] leading-5 text-muted"
      >
        <SealCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <span>
          Source:{" "}
          <span className="font-semibold text-fg underline decoration-border-strong underline-offset-2 group-hover:decoration-fg">
            {agency}
          </span>
          <ArrowSquareOut size={12} weight="bold" aria-hidden className="ml-0.5 inline align-[-1px]" />
          <span className="sr-only"> (opens the government website in a new tab)</span>
          {reviewed ? <span className="tnum block">Last verified {verifiedText(reviewed)}</span> : null}
        </span>
      </a>

      <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-[13px] leading-5 text-muted">
        <Info size={16} aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <span>{site.disclaimer}</span>
      </p>
    </div>
  );
}
