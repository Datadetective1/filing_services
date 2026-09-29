import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { DocumentSheet } from "@/components/visual/document-tile";

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
        <Container className="grid grid-cols-1 items-center gap-12 py-16 sm:py-24 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
          <div className="grid max-w-2xl content-start gap-6">
            <p className="tnum inline-flex items-center gap-2 justify-self-start rounded-full bg-highlight-soft px-3 py-1 text-[13px] font-bold text-highlight-fg">
              404
            </p>
            <h1 className="text-[40px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg text-balance sm:text-[60px]">
              We couldn&apos;t find that page.
            </h1>
            <p className="max-w-[52ch] text-[17px] leading-relaxed text-muted sm:text-lg">
              The link may be old, or the address may have a typo. If you were looking for a state&apos;s filing requirements,
              the state list is a good place to start.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/" size="lg">
                Go to the home page
              </ButtonLink>
              <ButtonLink href="/states" size="lg" variant="secondary">
                Browse by state
                <ArrowRight size={18} weight="bold" aria-hidden />
              </ButtonLink>
            </div>
            <ul className="grid gap-1 border-t border-border pt-5 text-[15px] sm:flex sm:flex-wrap sm:gap-x-6">
              <li>
                <Link href="/annual-report/pennsylvania" className={`${textLinkClasses} inline-flex min-h-11 items-center`}>
                  Pennsylvania annual report
                </Link>
              </li>
              <li>
                <Link href="/pricing" className={`${textLinkClasses} inline-flex min-h-11 items-center`}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/help" className={`${textLinkClasses} inline-flex min-h-11 items-center`}>
                  Get help
                </Link>
              </li>
            </ul>
            <p className="text-sm text-muted">
              Signed in?{" "}
              <Link href="/dashboard" className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                Go to your dashboard
              </Link>
            </p>
          </div>

          {/* A few papers, one of them not where it should be. */}
          <div aria-hidden className="relative mx-auto h-64 w-full max-w-sm max-lg:hidden sm:h-80">
            <div className="absolute inset-x-6 bottom-0 h-24 rounded-[var(--radius-surface)] bg-surface-2" />
            <div className="absolute bottom-10 left-[10%] rotate-[-10deg] scale-110">
              <DocumentSheet title="Annual report" />
            </div>
            <div className="absolute bottom-12 left-[36%] rotate-[4deg] scale-110">
              <DocumentSheet title="Receipt" />
            </div>
            <div className="absolute bottom-20 right-[6%] rotate-[14deg] scale-125">
              <DocumentSheet title="Page not found" stamp="Not on file" />
            </div>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
