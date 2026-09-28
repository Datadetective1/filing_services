import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/** Friendly 404. Renders inside the root layout only, so it brings its own header and footer. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Container className="py-20 sm:py-28">
          <div className="grid max-w-3xl gap-6">
          <p className="tnum text-sm font-medium text-muted">404</p>
          <h1 className="text-3xl font-semibold tracking-tight text-fg text-balance sm:text-5xl sm:leading-tight">
            We couldn&apos;t find that page.
          </h1>
          <p className="max-w-[52ch] text-base leading-relaxed text-muted sm:text-lg">
            The link may be old, or the address may have a typo. If you were looking for a state&apos;s filing requirements, the
            state list is a good place to start.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/" size="lg">
              Go to the home page
            </ButtonLink>
            <ButtonLink href="/states" size="lg" variant="secondary">
              Browse by state
              <ArrowRight size={18} aria-hidden />
            </ButtonLink>
          </div>
          <p className="text-sm text-muted">
            Signed in?{" "}
            <Link href="/dashboard" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              Go to your dashboard
            </Link>
          </p>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
