import Link from "next/link";
import type { ReactNode } from "react";
import { formatCents } from "@/lib/domain/money";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container, Notice } from "@/components/ui/surface";

/**
 * The lookup result for a visitor who came for a registered agent: the price at a glance and
 * one button to the order, which opens with their business filled in. Signing up, when they
 * need to, happens on the way and brings them straight back.
 */
export function RaLookupResult({
  legalName,
  stateName,
  entered,
  signedIn,
  agentPriceCents,
  changeFeeCents,
  unavailableReason,
}: {
  legalName: string;
  stateName: string;
  entered: ReactNode;
  signedIn: boolean;
  agentPriceCents: number | null;
  changeFeeCents: number | null;
  unavailableReason: string | null;
}) {
  const next = "/dashboard/services/start";
  return (
    <Container className="max-w-2xl pb-16 pt-6 sm:pb-24 sm:pt-10">
      <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg [overflow-wrap:anywhere] sm:text-[40px]">
        Registered agent for {legalName}
      </h1>
      {unavailableReason ? (
        <Notice className="mt-5" tone="warning" title={`Not open in ${stateName} yet`}>
          <p>{unavailableReason} Nothing has been charged.</p>
          <p className="mt-2">
            <Link href="/registered-agent" className={textLinkClasses}>
              Back to registered agent service
            </Link>
          </p>
        </Notice>
      ) : (
        <div className="mt-5 grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-6">
          {agentPriceCents !== null ? (
            <p className="text-[17px] text-fg">
              <span className="tnum font-display text-[28px] font-semibold">{formatCents(agentPriceCents, { trimZeros: true })}</span>
              <span className="text-muted"> a year, same price every year</span>
            </p>
          ) : null}
          <p className="text-[15px] leading-6 text-muted">
            {changeFeeCents !== null
              ? `Switching is free from us. ${stateName} charges ${changeFeeCents === 0 ? "no fee" : formatCents(changeFeeCents, { trimZeros: true })} to record the change, paid at checkout. `
              : ""}
            You&apos;ll see the full total before you pay, and you can turn off renewal any time.
          </p>
          <Link href={signedIn ? next : `/signup?next=${encodeURIComponent(next)}`} prefetch={false} className={buttonClasses("primary", "lg", "w-full")}>
            Continue
          </Link>
          {!signedIn ? (
            <p className="text-center text-sm text-muted">
              Have an account?{" "}
              <Link href={`/login?next=${encodeURIComponent(next)}`} className={textLinkClasses}>
                Sign in
              </Link>
            </p>
          ) : null}
        </div>
      )}
      <div className="mt-4">{entered}</div>
    </Container>
  );
}
