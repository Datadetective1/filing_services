"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";

/** Friendly fallback when a dashboard page fails to load. */
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Container className="py-16">
      <div className="mx-auto grid max-w-md gap-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-fg">We couldn&apos;t load this page</h1>
        <p className="text-[15px] text-muted">
          Something went wrong on our side. Your filings and data are safe. Please try again in a moment.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => retry()} className="min-h-11">
            <ArrowClockwise size={16} weight="bold" aria-hidden />
            Try again
          </Button>
          <ButtonLink href="/dashboard" variant="secondary" className="min-h-11">
            Back to dashboard
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
