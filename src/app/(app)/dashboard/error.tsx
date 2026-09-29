"use client";

import { ArrowClockwise, CloudWarning } from "@phosphor-icons/react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";

/** Friendly fallback when a dashboard page fails to load. */
export default function DashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto grid max-w-md justify-items-center gap-5 text-center">
        <span aria-hidden className="grid size-16 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
          <CloudWarning size={30} weight="duotone" />
        </span>
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold text-fg sm:text-[28px]">We couldn&apos;t load this page</h1>
          <p className="text-[15px] leading-7 text-muted">
            Something went wrong on our side. Your filings and data are safe. Please try again in a moment.
          </p>
        </div>
        <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Button onClick={() => retry()}>
            <ArrowClockwise size={16} weight="bold" aria-hidden />
            Try again
          </Button>
          <ButtonLink href="/dashboard" variant="secondary">
            Back to dashboard
          </ButtonLink>
        </div>
        <p className="text-sm text-muted">
          Still stuck?{" "}
          <Link href="/help" className="font-semibold text-accent underline decoration-accent/30 decoration-2 underline-offset-4 hover:decoration-accent">
            Get help
          </Link>
        </p>
      </div>
    </Container>
  );
}
