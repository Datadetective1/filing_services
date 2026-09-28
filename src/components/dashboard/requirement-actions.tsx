import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CaretRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { markFiledElsewhereAction, startFilingAction } from "@/app/(app)/dashboard/actions";
import { formatCents } from "@/lib/domain/money";
import { formatLongDate, todayInTimeZone } from "@/lib/domain/dates";
import { filingWindowOpensOn, isFilingWindowOpen } from "@/lib/domain/deadlines";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/components/ui/cn";
import type { BusinessView, RequirementView } from "@/app/(app)/dashboard/_lib/data";
import { continueHref, filingHref, isCustomerEditable } from "./steps";

type ReturnPath = "/dashboard" | `/dashboard/businesses/${string}`;

/**
 * The primary action for an open requirement plus the "already filed" escape hatch:
 *   no filing yet        -> "Have us file it"
 *   draft / waiting on you -> "Continue"
 *   in our hands          -> "View filing"
 */
export function RequirementActions({
  business,
  requirement,
  returnTo,
  className,
}: {
  business: BusinessView;
  requirement: RequirementView;
  returnTo: ReturnPath;
  className?: string;
}) {
  const filing = requirement.activeFiling;
  const canMarkFiled = requirement.status === "open" && (!filing || filing.status === "draft");

  let primary: ReactNode = null;
  if (filing && isCustomerEditable(filing.status)) {
    primary = (
      <ButtonLink href={continueHref(filing)} className="min-h-11 w-full sm:w-auto">
        Continue
        <ArrowRight size={16} weight="bold" aria-hidden />
      </ButtonLink>
    );
  } else if (filing) {
    primary = (
      <ButtonLink href={filingHref(filing.id)} variant="secondary" className="min-h-11 w-full sm:w-auto">
        View filing
      </ButtonLink>
    );
  } else if (
    requirement.status === "open" &&
    business.sellable &&
    business.rule &&
    !isFilingWindowOpen(business.rule, requirement.periodYear, requirement.dueDate, todayInTimeZone("America/New_York"))
  ) {
    primary = (
      <p className="text-sm text-muted">
        Filing for the {requirement.periodYear} report opens{" "}
        {formatLongDate(filingWindowOpensOn(business.rule, requirement.periodYear, requirement.dueDate))}. We&apos;ll remind you
        before it&apos;s due.
      </p>
    );
  } else if (requirement.status === "open" && business.sellable) {
    primary = (
      <form action={startFilingAction} className="w-full sm:w-auto">
        <input type="hidden" name="businessId" value={business.id} />
        <input type="hidden" name="returnTo" value={returnTo} />
        <SubmitButton className="min-h-11 w-full sm:w-auto" pendingLabel="Starting…">
          Have us file it
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className={cn("grid gap-3", className)}>
      {primary ? <div className="flex flex-wrap items-center gap-3">{primary}</div> : null}
      {filing && isCustomerEditable(filing.status) ? (
        <Link
          href={filingHref(filing.id)}
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted underline-offset-4 hover:text-fg hover:underline sm:min-h-0"
        >
          View filing details
          <CaretRight size={14} aria-hidden />
        </Link>
      ) : null}
      {canMarkFiled ? <MarkFiledDisclosure requirement={requirement} returnTo={returnTo} /> : null}
    </div>
  );
}

/** A confirm step (no JavaScript needed) before marking a period as filed elsewhere. */
export function MarkFiledDisclosure({ requirement, returnTo }: { requirement: RequirementView; returnTo: ReturnPath }) {
  return (
    <details className="group text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-control)] text-muted hover:text-fg sm:min-h-8 [&::-webkit-details-marker]:hidden">
        <CheckCircle size={16} aria-hidden />
        Mark as already filed
      </summary>
      <div className="mt-2 grid max-w-sm gap-3 rounded-[var(--radius-control)] border border-border bg-surface-2 p-3 text-left">
        <p className="text-muted">
          Filed the {requirement.periodYear} {requirement.filingName.toLowerCase()} yourself? We&apos;ll stop reminders for
          this period and start tracking next year&apos;s report.
        </p>
        <form action={markFiledElsewhereAction}>
          <input type="hidden" name="requirementId" value={requirement.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton variant="secondary" className="min-h-11" pendingLabel="Saving…">
            Yes, it&apos;s already filed
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}

/** Small "file directly with the state" note, required wherever we offer to file. */
export function FileDirectlyNote({ business, className }: { business: BusinessView; className?: string }) {
  const rule = business.rule;
  if (!rule) return null;
  let host = rule.officialFilingUrl;
  try {
    host = new URL(rule.officialFilingUrl).host;
  } catch {
    // keep the raw URL
  }
  const noFee = rule.stateFeeCents === 0 || (business.isNonprofit && rule.nonprofitStateFeeCents === 0);
  const fee = noFee ? "with no state fee" : `for the ${formatCents(rule.stateFeeCents, { trimZeros: true })} state fee`;
  return (
    <p className={cn("text-xs leading-relaxed text-subtle", className)}>
      You can also file directly with the state at{" "}
      <a
        href={rule.officialFilingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-fg"
      >
        {host}
        <span className="sr-only"> (opens the state website in a new tab)</span>
      </a>{" "}
      {fee}.
    </p>
  );
}
