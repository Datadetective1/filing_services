import { CalendarBlank, CheckCircle, Info } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { getJurisdiction } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { dueRuleText, lateFeeText, stateFeeText } from "@/lib/compliance/view";
import { describeDaysRemaining, formatLongDate } from "@/lib/domain/dates";
import type { FilingPeriod } from "@/lib/domain/deadlines";
import type { Quote } from "@/lib/domain/pricing";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { cn } from "@/components/ui/cn";
import { OfficialSource } from "./official-source";
import { PriceBreakdown } from "./price-breakdown";

/**
 * The core answer card: what's required, when, what it costs, from which official
 * source — with facts visibly separated from our service offer.
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
  const urgent = period && (period.phase === "overdue" || period.phase === "due_today" || period.phase === "due_soon");

  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card", className)}>
      <div className="grid gap-4 p-5 sm:p-6">
        <div className="grid gap-1">
          <p className="text-sm text-muted">
            {businessName ? `${businessName} · ` : ""}
            {stateName} {ENTITY_TYPE_LABELS[rule.entityType]}
          </p>
          <Heading className="text-xl font-semibold tracking-tight text-fg">
            {stateName} {rule.filingName}
            {rule.formNumber ? <span className="ml-2 text-sm font-normal text-subtle">{rule.formNumber}</span> : null}
          </Heading>
        </div>

        {period ? (
          <div
            className={cn(
              "flex items-start gap-3 rounded-[var(--radius-control)] px-3 py-2.5",
              period.phase === "overdue" ? "bg-warning-soft" : urgent ? "bg-accent-soft" : "bg-surface-2",
            )}
          >
            <CalendarBlank size={20} className="mt-0.5 shrink-0 text-fg" aria-hidden />
            <div className="text-[15px]">
              {period.phase === "first_report_later" ? (
                <>
                  <p className="font-medium text-fg">No report due this year</p>
                  <p className="text-muted">
                    Your first report is due by {formatLongDate(period.dueDate)}.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-fg">
                    {period.periodYear} report due {formatLongDate(period.dueDate)}
                  </p>
                  <p className="tnum text-muted">{describeDaysRemaining(period.daysRemaining)}</p>
                </>
              )}
            </div>
          </div>
        ) : null}

        <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[9rem_1fr]">
          <dt className="text-muted">Due</dt>
          <dd className="text-fg">{dueRuleText(rule.dueRule)}</dd>
          <dt className="text-muted">State fee</dt>
          <dd className="text-fg">{stateFeeText(rule)}</dd>
          <dt className="text-muted">Late fee</dt>
          <dd className="text-fg">{lateFeeText(rule)}</dd>
        </dl>

        <OfficialSource
          href={rule.officialInfoUrl}
          agency={state?.agency.name.split(" - ")[0] ?? `${stateName} state agency`}
          lastVerifiedAt={rule.lastVerifiedAt}
        />
      </div>

      <div className="grid gap-4 border-t border-border bg-surface-2/60 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-fg">
          <CheckCircle size={18} weight="fill" className="text-accent" aria-hidden />
          We can file this for you
        </div>
        {quote ? (
          <PriceBreakdown quote={quote} stateName={stateName} totalLabel="Total if we file it" />
        ) : (
          <p className="text-sm text-muted">Our service fee is shown before you pay.</p>
        )}
        {actions ? <div className="flex flex-col gap-2 sm:flex-row">{actions}</div> : null}
        <p className="flex gap-2 text-xs text-muted">
          <Info size={16} className="shrink-0" aria-hidden />
          <span>
            You can also file directly with the state at{" "}
            <a className="underline underline-offset-2" href={rule.officialFilingUrl} target="_blank" rel="noopener noreferrer">
              {new URL(rule.officialFilingUrl).host}
            </a>{" "}
            for the state fee alone. Online filings there are approved automatically.
          </span>
        </p>
      </div>
    </div>
  );
}
