import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { DocumentSheet } from "@/components/visual/document-tile";

/** Shown when a business or filing doesn't exist or isn't in this account. */
export default function DashboardNotFound() {
  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto grid max-w-md justify-items-center gap-6 text-center">
        <div aria-hidden className="relative h-[104px] w-[132px]">
          <span className="absolute left-2 top-3 -rotate-[9deg] opacity-60">
            <DocumentSheet title="" size="sm" />
          </span>
          <span className="absolute right-2 top-0 rotate-[6deg]">
            <DocumentSheet title="" size="sm" />
          </span>
        </div>
        <div className="grid gap-2">
          <h1 className="text-2xl font-semibold text-fg sm:text-[28px]">We couldn&apos;t find that</h1>
          <p className="text-[15px] leading-7 text-muted">
            It may have been removed, or it belongs to a different account. Check that you&apos;re signed in with the
            right email.
          </p>
        </div>
        <ButtonLink href="/dashboard">Back to dashboard</ButtonLink>
        <p className="text-sm text-muted">
          Think something&apos;s wrong?{" "}
          <Link href="/help" className="font-semibold text-accent underline decoration-accent/30 decoration-2 underline-offset-4 hover:decoration-accent">
            Get help
          </Link>
        </p>
      </div>
    </Container>
  );
}
