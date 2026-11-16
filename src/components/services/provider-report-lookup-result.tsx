import Link from "next/link";
import type { ReactNode } from "react";
import { GuestStartForm } from "@/app/(auth)/auth-forms";
import { formatCents } from "@/lib/domain/money";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";

const START = "/dashboard/services/annual-report/start";

/**
 * The lookup result where our partner files the annual report: the all-in price and one step
 * to the order, which opens with the business filled in from what the visitor looked up.
 */
export function ProviderReportLookupResult({
  stateName,
  reportName,
  totalCents,
  stateFeeCents,
  entered,
  signedIn,
  stateCode,
  entityType,
}: {
  stateName: string;
  reportName: string;
  totalCents: number;
  stateFeeCents: number;
  entered: ReactNode;
  signedIn: boolean;
  stateCode: string;
  entityType: string;
}) {
  return (
    <Container className="max-w-2xl pb-16 pt-6 sm:pb-24 sm:pt-10">
      <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[40px]">
        We file your {stateName} {reportName.toLowerCase()}
      </h1>
      <div className="mt-5 grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-6">
        <p className="text-[17px] text-fg">
          <span className="tnum font-display text-[28px] font-semibold">{formatCents(totalCents, { trimZeros: true })}</span>
          <span className="text-muted"> all in, including the {formatCents(stateFeeCents, { trimZeros: true })} state fee. Same price every year, and nothing renews on its own.</span>
        </p>
        {signedIn ? (
          // A plain link: START is a route that redirects, so the browser loads it itself.
          <a href={START} className={buttonClasses("primary", "lg", "w-full")}>
            Continue
          </a>
        ) : (
          <>
            <GuestStartForm next={START} buttonLabel="Continue" bare track={{ event: "filing_cta_clicked", stateCode, entityType }} />
            <p className="text-center text-sm text-muted">
              Have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(START)}`} className={textLinkClasses}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
      <div className="mt-8">{entered}</div>
    </Container>
  );
}
