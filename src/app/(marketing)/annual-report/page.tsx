import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { StateGrid } from "@/components/marketing/state-grid";
import { Badge } from "@/components/ui/badge";
import { isStateVerified, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { stateFeeText } from "@/lib/compliance/view";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { dueDayText } from "@/lib/seo/content";
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

export default function AnnualReportHubPage() {
  const verified = listJurisdictions().filter((j) => isStateVerified(j.code));

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title="Annual reports"
        lede={
          <p>
            Many states ask registered businesses to confirm their basic details on a regular schedule. Here is what that
            filing is, and where we can help today.
          </p>
        }
      />

      <Section labelledBy="what-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-20">
          <div className="grid content-start gap-6">
            <SectionHeading id="what-title" title="What an annual report is" />
            <div className="grid max-w-[68ch] gap-4 text-[15px] leading-7 text-muted sm:text-base">
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
              <p>
                Because the details vary, we only state due dates and fees for a state after checking them against that
                state&apos;s official publications. For every other state, we point you to the official agency instead of
                guessing.
              </p>
            </div>
          </div>

          <div className="grid content-start gap-4">
            {verified.map((j) => {
              const rules = rulesForState(j.code);
              return (
                <div key={j.code} className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card">
                  <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-5">
                    <h3 className="text-lg font-semibold tracking-tight text-fg">{j.name}</h3>
                    <Badge tone="success">Supported</Badge>
                  </div>
                  <ul className="divide-y divide-border border-t border-border">
                    {rules.map((r) => (
                      <li key={r.ruleKey}>
                        <Link
                          href={`/annual-report/${j.slug}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                          className="flex min-h-12 items-center justify-between gap-4 px-5 py-2.5 text-[15px] hover:bg-surface-2"
                        >
                          <span className="text-fg">{ENTITY_TYPE_LABELS[r.entityType]}</span>
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
                    className="flex min-h-12 items-center justify-between gap-2 border-t border-border bg-surface-2/60 px-5 text-[15px] font-medium text-fg hover:bg-surface-2"
                  >
                    {j.name} annual report guide
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Section labelledBy="states-title" band>
        <SectionHeading
          id="states-title"
          title="Annual reports by state"
          lede="Supported means we have verified the state's requirements and can file for you. Not yet verified means we haven't, so those pages show only the official agency link."
        />
        <StateGrid basePath="/annual-report" className="mt-10" />
        <DisclaimerNote className="mt-10" />
      </Section>
    </>
  );
}
