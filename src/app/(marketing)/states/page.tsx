import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { StateGrid } from "@/components/marketing/state-grid";
import { Badge } from "@/components/ui/badge";
import { textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { CalendarDate } from "@/components/visual/calendar-date";
import { UsTileMap, UsTileMapLegend } from "@/components/visual/us-tile-map";
import { isStateVerified, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { dueGroups, feeSummary } from "@/lib/seo/content";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Business Filings by State",
  description:
    "All 50 states and DC, with an honest status for each. Pennsylvania is supported. Other states are listed as not yet verified, with a link to the official agency.",
  path: "/states",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "States", path: "/states" },
];

export default function StatesPage() {
  const supported = listJurisdictions().filter((j) => isStateVerified(j.code));

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />

      <section aria-labelledby="states-title" className="overflow-hidden">
        <Container className="grid grid-cols-1 items-start gap-10 pb-14 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:pb-20 lg:pt-12">
          <div className="grid content-start gap-5">
            <Breadcrumbs items={CRUMBS} />
            <h1
              id="states-title"
              className="max-w-[12ch] text-[40px] font-semibold leading-[1.03] tracking-[-0.03em] text-fg sm:text-[56px] lg:text-[64px]"
            >
              Browse by <span className="mark-highlight">state</span>
            </h1>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-muted sm:text-lg">
              We support a state once we have checked its filing requirements against official government sources. Until
              then, its page shows only the official agency, with no due dates or fees.
            </p>
            <UsTileMapLegend className="mt-1" />
            {supported.map((j) => {
              const rules = rulesForState(j.code).filter((r) => r.verificationStatus === "verified");
              const groups = dueGroups(rules);
              return (
                <div key={j.code} className="mt-3 grid gap-4 rounded-[var(--radius-surface)] border border-accent/25 bg-accent-soft/60 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <p className="font-display text-xl font-semibold text-fg">{j.name}</p>
                      <Badge tone="success">Filing supported</Badge>
                    </div>
                    <div aria-hidden className="flex gap-1.5">
                      {groups.map((g) => (
                        <CalendarDate key={g.day} month={g.month} day={g.dayOfMonth} size="sm" />
                      ))}
                    </div>
                  </div>
                  <p className="text-[14px] leading-6 text-muted">
                    Annual reports, due {groups.map((g) => g.day).join(", ").replace(/, ([^,]*)$/, " or $1")} depending on the
                    entity type. State fee {feeSummary(rules).split(",")[0]}.
                  </p>
                  <div className="-my-1 flex flex-wrap gap-x-6">
                    <Link href={`/states/${j.slug}`} className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5`}>
                      {j.name} filings
                      <ArrowRight size={15} weight="bold" aria-hidden />
                    </Link>
                    <Link href={`/annual-report/${j.slug}`} className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5`}>
                      Annual report guide
                      <ArrowRight size={15} weight="bold" aria-hidden />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-[var(--radius-surface)] border border-border bg-surface p-2 shadow-card sm:p-6 lg:p-7">
            <UsTileMap basePath="/states" />
          </div>
        </Container>
      </section>

      <section aria-labelledby="directory-title" className="grain bg-surface-2 py-14 sm:py-20">
        <Container className="grid gap-8">
          <div className="grid max-w-2xl gap-3">
            <h2 id="directory-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              Every state and DC
            </h2>
            <p className="text-[17px] leading-relaxed text-muted">
              Each page links to the state&apos;s official business filing agency. Supported states also show verified due
              dates and fees.
            </p>
          </div>
          <StateGrid basePath="/states" />
          <DisclaimerNote />
        </Container>
      </section>
    </>
  );
}
