import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import type { JurisdictionDef } from "@/lib/compliance/types";
import { DirectoryListing } from "./directory-listing";
import { DisclaimerNote } from "./disclaimer";
import { WaitlistForm } from "./waitlist-form";

/**
 * Body of a page for a state we haven't verified: the official agency listing next
 * to the waitlist, then onward links and the disclaimer.
 */
export function UnverifiedStateSections({
  j,
  waitlistLede,
  links,
}: {
  j: JurisdictionDef;
  waitlistLede: string;
  links: { href: string; label: string }[];
}) {
  return (
    <>
      <section aria-labelledby="waitlist-title" className="grain bg-surface-2 py-14 sm:py-20">
        <Container className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <DirectoryListing j={j} />
          <div
            id="waitlist"
            className="grid scroll-mt-24 content-start gap-6 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-7"
          >
            <div className="grid gap-3">
              <span aria-hidden className="h-1.5 w-12 rounded-full bg-highlight" />
              <h2 id="waitlist-title" className="text-[26px] font-semibold leading-tight text-fg sm:text-[30px]">
                Get an email when we support {j.name}
              </h2>
              <p className="text-[16px] leading-7 text-muted">{waitlistLede}</p>
            </div>
            <WaitlistForm stateCode={j.code} stateName={j.name} />
          </div>
        </Container>
      </section>

      <Container className="grid gap-6 py-12">
        <div className="flex flex-col gap-1 text-[15px] sm:flex-row sm:gap-8">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5`}>
              {l.label}
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          ))}
        </div>
        <DisclaimerNote />
      </Container>
    </>
  );
}
