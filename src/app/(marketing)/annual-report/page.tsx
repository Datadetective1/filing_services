import { ArrowRight, CheckCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { PhotoHero } from "@/components/marketing/photo-hero";
import { StateGrid } from "@/components/marketing/state-grid";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { CalendarDate } from "@/components/visual/calendar-date";
import { UsTileMapLegend } from "@/components/visual/us-tile-map";
import { isStateVerified, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { stateFeeText } from "@/lib/compliance/view";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { dueDayText, dueGroups, sortByDue } from "@/lib/seo/content";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Annual Reports by State: What They Are and When They're Due",
  description:
    "What a business annual report is, and which states we support. Pennsylvania due dates and fees are verified against official sources; other states are listed as not yet verified.",
  path: "/annual-report",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Annual reports", path: "/annual-report" },
];

/** The hub's status object: what an annual report usually confirms, drawn as the paper itself. */
function WhatItConfirms() {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-border bg-surface px-5 pb-5 pt-6 shadow-lift sm:px-6">
      <span
        aria-hidden
        className="absolute right-0 top-0 size-9 rounded-bl-[8px] bg-[linear-gradient(225deg,var(--bg)_50%,var(--surface-3)_50%)] shadow-[-1px_1px_2px_rgb(23_35_29/0.08)]"
      />
      <p className="font-mono text-[11px] uppercase tracking-wider text-subtle">Annual report</p>
      <p className="mt-1 border-b-2 border-fg/80 pb-3 pr-8 font-display text-lg font-semibold leading-snug text-fg">
        What it usually confirms
      </p>
      <ul className="grid">
        {["The business's legal name", "Its addresses", "The people who manage it"].map((item) => (
          <li key={item} className="flex items-center gap-3 border-b border-dashed border-border py-3 text-[15px] text-fg last:border-b-0">
            <CheckCircle size={18} weight="fill" aria-hidden className="shrink-0 text-accent" />
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] leading-5 text-muted">The name, schedule, due date and fee differ by state.</p>
    </div>
  );
}

export default function AnnualReportHubPage() {
  const verified = listJurisdictions().filter((j) => isStateVerified(j.code));

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />

      <PhotoHero
        id="hub-title"
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title={
          <>
            Annual <span className="mark-highlight">reports</span>
          </>
        }
        lede={
          <p>
            Many states ask registered businesses to confirm their basic details on a regular schedule. Here is what that
            filing is, and where we can help today.
          </p>
        }
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/find" size="lg">
              Find my business
              <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
            <ButtonLink href="#states-title" size="lg" variant="secondary">
              Browse states
            </ButtonLink>
          </div>
        }
        photo="reliefDocument"
        focus="45% 35%"
        focusWide="4% 35%"
        panel={<WhatItConfirms />}
      />

      <section aria-labelledby="what-title" className="pb-16 sm:pb-24">
        <Container className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-16">
          <div className="grid content-start gap-6">
            <h2 id="what-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              What an annual report is
            </h2>
            <div className="grid max-w-[64ch] gap-4 text-[16px] leading-7 text-muted sm:text-[17px] sm:leading-8">
              <p>
                An annual report is a short filing that keeps a business entity&apos;s record with a state up to date. It
                usually confirms details such as the business&apos;s legal name, its addresses and the people who manage
                it.
              </p>
              <p>
                Each state sets its own rules. The name of the filing, who has to file, how often, the due date and the
                fee can all differ from state to state and between entity types. Some states use a different name, such
                as a biennial report.
              </p>
            </div>
            <div className="flex max-w-[64ch] gap-3.5 rounded-[var(--radius-surface)] bg-accent-soft/70 p-5">
              <ShieldCheck size={22} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[16px] leading-7 text-fg">
                Because the details vary, we only state due dates and fees for a state after checking them against that
                state&apos;s official publications. For every other state, we point you to the official agency instead of
                guessing.
              </p>
            </div>
          </div>

          <div className="grid content-start gap-4">
            {verified.map((j) => {
              const rules = rulesForState(j.code);
              const groups = dueGroups(rules);
              return (
                <div key={j.code} className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
                  <div className="grid gap-4 px-5 pb-4 pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-xl font-semibold tracking-tight text-fg">{j.name}</h3>
                      <Badge tone="success">Filing supported</Badge>
                    </div>
                    <div aria-hidden className="flex gap-2">
                      {groups.map((g) => (
                        <CalendarDate key={g.day} month={g.month} day={g.dayOfMonth} size="sm" />
                      ))}
                    </div>
                  </div>
                  <ul className="divide-y divide-border border-t border-border">
                    {sortByDue(rules).map((r) => (
                      <li key={r.ruleKey}>
                        <Link
                          href={`/annual-report/${j.slug}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                          className="group flex min-h-12 items-center justify-between gap-4 px-5 py-2.5 text-[15px] transition-colors hover:bg-surface-2/70"
                        >
                          <span className="font-medium text-fg group-hover:text-accent">{ENTITY_TYPE_LABELS[r.entityType]}</span>
                          <span className="tnum shrink-0 text-right text-sm text-muted">
                            {dueDayText(r)}
                            <span className="block text-xs text-subtle">{stateFeeText({ ...r, nonprofitStateFeeCents: null })}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={`/annual-report/${j.slug}`}
                    className="flex min-h-14 items-center justify-between gap-2 border-t border-border bg-accent px-5 text-[15px] font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
                  >
                    {j.name} annual report guide
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </Link>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      <section aria-labelledby="states-title" className="grain scroll-mt-20 bg-surface-2 py-14 sm:py-20">
        <Container className="grid gap-8">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="grid max-w-2xl gap-3">
              <h2 id="states-title" className="scroll-mt-24 text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
                Annual reports by state
              </h2>
              <p className="text-[17px] leading-relaxed text-muted">
                Supported means we have verified the state&apos;s requirements and can file for you. Not yet verified means we
                haven&apos;t, so those pages show only the official agency link.
              </p>
            </div>
            <UsTileMapLegend />
          </div>
          <StateGrid basePath="/annual-report" />
          <DisclaimerNote />
          <p className="text-[15px] text-muted">
            Prefer a map?{" "}
            <Link href="/states" className={textLinkClasses}>
              Browse states on the map
            </Link>
          </p>
        </Container>
      </section>
    </>
  );
}
