import { CheckCircle, Info } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { getJurisdiction } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { dueRuleText, lateFeeText, stateFeeText } from "@/lib/compliance/view";
import { describeDaysRemaining, formatLongDate } from "@/lib/domain/dates";
import type { FilingPeriod } from "@/lib/domain/deadlines";
import type { Quote } from "@/lib/domain/pricing";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { cn } from "@/components/ui/cn";
import { CalendarDate } from "@/components/visual/calendar-date";
import { CountdownRing } from "@/components/visual/countdown-ring";
import { OfficialSource } from "./official-source";
import { PriceBreakdown } from "./price-breakdown";

/**
 * The core answer card: when it's due and how long is left, the facts and the
 * official source they come from, then (visibly separate) our optional offer to
 * file it with the price broken down.
 */
export function RequirementCard({
  rule,
  period,
  quote,
  actions,
  businessName,
  className,
  headingAs = "h3",
}: {
  rule: ComplianceRuleDef;
  period?: FilingPeriod | null;
  quote?: Quote | null;
  actions?: ReactNode;
  businessName?: string | null;
  className?: string;
  headingAs?: "h2" | "h3";
}) {
  const Heading = headingAs;
  const state = getJurisdiction(rule.stateCode);
  const stateName = state?.name ?? rule.stateCode;
  const later = period?.phase === "first_report_later";
  const tone =
    period?.phase === "overdue"
      ? "bg-warning-soft ring-warning/25"
      : period?.phase === "due_today" || period?.phase === "due_soon"
        ? "bg-highlight-soft ring-highlight/50"
        : later
          ? "bg-surface-2 ring-border"
          : "bg-accent-soft/70 ring-accent/20";
  const dueParts = period ? period.dueDate.split("-").map(Number) : null;

  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card", className)}>
      <div className="grid gap-5 p-5 sm:p-6">
        <div className="grid gap-1.5">
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-muted">
            <span className="shrink-0 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-fg">
              {rule.stateCode}
            </span>
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {businessName ? `${businessName} · ` : ""}
              {stateName} {ENTITY_TYPE_LABELS[rule.entityType]}
            </span>
          </p>
          <Heading className="text-[22px] font-semibold leading-tight tracking-tight text-fg">
            {stateName} {rule.filingName}
            {rule.formNumber ? (
              <span className="ml-2 align-middle font-mono text-[12px] font-normal uppercase tracking-wider text-subtle">
                {rule.formNumber}
              </span>
            ) : null}
          </Heading>
        </div>

        {period ? (
          <div className={cn("flex items-center gap-4 rounded-[14px] p-4 ring-1 ring-inset", tone)}>
            {later && dueParts ? (
              <CalendarDate month={dueParts[1]} day={dueParts[2]} size="lg" />
            ) : (
              <CountdownRing
                days={period.daysRemaining}
                size={72}
                label={`${Math.abs(period.daysRemaining)} days ${period.daysRemaining < 0 ? "past" : "until"} the ${formatLongDate(period.dueDate)} due date`}
              />
            )}
            <div className="grid min-w-0 gap-0.5">
              {later ? (
                <>
                  <p className="font-display text-lg font-semibold leading-snug text-fg">No report due this year</p>
                  <p className="text-[15px] leading-6 text-muted">Your first report is due by {formatLongDate(period.dueDate)}.</p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-semibold text-muted">{period.periodYear} report due</p>
                  <p className="tnum font-display text-xl font-semibold leading-tight text-fg">{formatLongDate(period.dueDate)}</p>
                  <p
                    className={cn(
                      "tnum text-[15px] font-semibold",
                      period.phase === "overdue" ? "text-warning" : period.phase === "upcoming" ? "text-accent" : "text-highlight-fg",
                    )}
                  >
                    {describeDaysRemaining(period.daysRemaining)}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}

        <dl className="divide-y divide-border border-y border-border text-[15px]">
          {[
            { term: "Due", value: dueRuleText(rule.dueRule) },
            { term: "State fee", value: stateFeeText(rule) },
            { term: "Late fee", value: lateFeeText(rule) },
          ].map((f) => (
            <div key={f.term} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 py-2.5 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <dt className="text-muted">{f.term}</dt>
              <dd className="font-medium leading-6 text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>

        <OfficialSource
          href={rule.officialInfoUrl}
          agency={state?.agency.name.split(" - ")[0] ?? `${stateName} state agency`}
          lastVerifiedAt={rule.lastVerifiedAt}
        />
      </div>

      <div className="grid gap-4 border-t-2 border-dashed border-border bg-surface-2/70 p-5 sm:p-6">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <CheckCircle size={20} weight="fill" className="text-accent" aria-hidden />
          We can file this for you
        </p>
        {quote ? (
          <div className="rounded-[var(--radius-control)] border border-border bg-surface p-4">
            <PriceBreakdown quote={quote} stateName={stateName} totalLabel="Total if we file it" />
          </div>
        ) : (
          <p className="text-sm text-muted">Our service fee is shown before you pay.</p>
        )}
        {actions ? <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{actions}</div> : null}
        <p className="flex gap-2 text-[13px] leading-5 text-muted">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            You can also file directly with the state at{" "}
            <a
              className="font-semibold text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
              href={rule.officialFilingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {new URL(rule.officialFilingUrl).host}
            </a>{" "}
            for the state fee alone. Online filings there are approved automatically.
          </span>
        </p>
      </div>
    </div>
  );
}
