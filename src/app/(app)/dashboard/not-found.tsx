import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";

/** Shown when a business or filing doesn't exist or isn't in this account. */
export default function DashboardNotFound() {
  return (
    <Container className="py-16">
      <div className="mx-auto grid max-w-md gap-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-fg">We couldn&apos;t find that</h1>
        <p className="text-[15px] text-muted">
          It may have been removed, or it belongs to a different account. Check that you&apos;re signed in with the
          right email.
        </p>
        <div className="flex justify-center">
          <ButtonLink href="/dashboard" className="min-h-11">
            Back to dashboard
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
