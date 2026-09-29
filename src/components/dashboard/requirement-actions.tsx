import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, CalendarCheck, CaretDown, CaretRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { markFiledElsewhereAction, startFilingAction } from "@/app/(app)/dashboard/actions";
import { formatCents } from "@/lib/domain/money";
import { formatLongDate } from "@/lib/domain/dates";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/components/ui/cn";
import type { BusinessView, RequirementView } from "@/app/(app)/dashboard/_lib/data";
import { canMarkFiled, requirementAction } from "./requirement-state";
import { filingHref } from "./steps";

type ReturnPath = "/dashboard" | `/dashboard/businesses/${string}`;

/**
 * The primary action for an open requirement plus the "already filed" escape hatch:
 *   no filing yet          -> "Have us file it" (only once the state's filing window is open)
 *   draft / waiting on you -> "Continue"
 *   in our hands           -> "View filing"
 * `size="panel"` is the larger treatment used in the "what do I need to do next?" panel.
 */
export function RequirementActions({
  business,
  requirement,
  returnTo,
  className,
  size = "card",
}: {
  business: BusinessView;
  requirement: RequirementView;
  returnTo: ReturnPath;
  className?: string;
  size?: "card" | "panel";
}) {
  const action = requirementAction(business, requirement);
  const panel = size === "panel";
  const buttonSize = panel ? "lg" : "md";

  let primary: ReactNode = null;
  let secondary: ReactNode = null;
  switch (action.kind) {
    case "continue":
      primary = (
        <ButtonLink href={action.href} size={buttonSize} className="w-full sm:w-auto">
          {panel ? (action.step.cta ?? "Continue") : "Continue"}
          <ArrowRight size={16} weight="bold" aria-hidden />
        </ButtonLink>
      );
      secondary = (
        <Link
          href={filingHref(action.filing.id)}
          className="inline-flex min-h-11 items-center gap-1 rounded-full text-sm font-semibold text-muted transition-colors hover:text-fg"
        >
          View filing details
          <CaretRight size={14} weight="bold" aria-hidden />
        </Link>
      );
      break;
    case "view":
      primary = (
        <ButtonLink href={action.href} variant="secondary" size={buttonSize} className="w-full sm:w-auto">
          View filing
          <ArrowRight size={16} weight="bold" aria-hidden />
        </ButtonLink>
      );
      break;
    case "opens_later":
      primary = (
        <p className="flex max-w-[42ch] items-start gap-2 text-sm leading-6 text-muted">
          <CalendarCheck size={18} weight="duotone" aria-hidden className="mt-0.5 shrink-0 text-accent" />
          <span>
            Filing for the {requirement.periodYear} report opens {formatLongDate(action.opensOn)}. We&apos;ll remind you
            before it&apos;s due.
          </span>
        </p>
      );
      break;
    case "start":
      primary = (
        <form action={startFilingAction} className="w-full sm:w-auto">
          <input type="hidden" name="businessId" value={business.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton size={buttonSize} className="w-full sm:w-auto" pendingLabel="Starting…">
            Have us file it
          </SubmitButton>
        </form>
      );
      break;
    case "none":
      break;
  }

  return (
    <div className={cn("grid gap-1", className)}>
      {primary ? <div className="flex flex-wrap items-center gap-x-5 gap-y-1">{primary}{secondary}</div> : null}
      {canMarkFiled(requirement) ? <MarkFiledDisclosure requirement={requirement} returnTo={returnTo} /> : null}
    </div>
  );
}

/** A confirm step (no JavaScript needed) before marking a period as filed elsewhere. */
export function MarkFiledDisclosure({ requirement, returnTo }: { requirement: RequirementView; returnTo: ReturnPath }) {
  return (
    <details className="group text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full font-semibold text-muted transition-colors hover:text-fg [&::-webkit-details-marker]:hidden">
        <CheckCircle size={17} aria-hidden />
        Already filed it yourself?
        <CaretDown size={12} weight="bold" aria-hidden className="transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="mb-1 mt-1 grid max-w-sm gap-3 rounded-[14px] border border-border bg-surface p-4 text-left shadow-card">
        <p className="text-sm leading-6 text-muted">
          Filed the {requirement.periodYear} {requirement.filingName.toLowerCase()} yourself? We&apos;ll stop reminders for
          this period and start tracking next year&apos;s report.
        </p>
        <form action={markFiledElsewhereAction}>
          <input type="hidden" name="requirementId" value={requirement.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <SubmitButton variant="secondary" size="sm" className="min-h-11" pendingLabel="Saving…">
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
    <p className={cn("text-[13px] leading-5 text-muted", className)}>
      You can also file directly with the state at{" "}
      <a
        href={rule.officialFilingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 font-semibold text-fg underline decoration-border-strong underline-offset-2 hover:decoration-fg"
      >
        {host}
        <ArrowUpRight size={12} weight="bold" aria-hidden />
        <span className="sr-only"> (opens the state website in a new tab)</span>
      </a>{" "}
      {fee}.
    </p>
  );
}
