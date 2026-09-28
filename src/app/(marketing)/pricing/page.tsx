import { ArrowRight, Check, Minus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section, SectionHeading } from "@/components/marketing/section";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/ui/table";
import { publicQuote } from "@/lib/compliance/public-quote";
import { isStateVerified, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { formatCents } from "@/lib/domain/money";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { sortByDue } from "@/lib/seo/content";
import { ENTITY_COPY, joinList } from "@/lib/seo/entities";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Pricing: State Fee Plus Our Service Fee",
  description:
    "Transparent pricing for annual report filing. The state fee is passed through at cost and our service fee is shown separately. You can always file directly with the state for the state fee alone.",
  path: "/pricing",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Pricing", path: "/pricing" },
];

const INCLUDED = [
  "A check of your answers against the state's requirements before anything is filed",
  "Preparing the report from the information you provide and confirm",
  "Submitting it to the state and paying the state fee on your behalf",
  "Email updates when it's submitted and when the state accepts it",
  "The state's confirmation, kept in your dashboard",
  "If the state sends it back, we fix what we can and ask you for anything else",
  "Reminders ahead of next year's deadline",
];

const NOT_INCLUDED = ["Legal or tax advice", "Registered agent service", "Filings other than the one you order"];

export default async function PricingPage() {
  const states = listJurisdictions().filter((j) => isStateVerified(j.code));
  const tables = await Promise.all(
    states.map(async (j) => {
      const rules = sortByDue(rulesForState(j.code).filter((r) => r.verificationStatus === "verified"));
      const quotes = await Promise.all(rules.map((r) => publicQuote(r)));
      return { j, rules, quotes };
    }),
  );

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title="Pricing"
        lede={
          <p>
            Two parts, always on separate lines: the state&apos;s filing fee, passed through at cost, and our service fee for
            preparing and submitting the filing. You see both before you pay.
          </p>
        }
      />

      {tables.map(({ j, rules, quotes }) => {
        const anyQuote = quotes.some(Boolean);
        const npFree = rules
          .filter((r) => r.stateFeeCents > 0 && r.nonprofitStateFeeCents === 0)
          .map((r) => ENTITY_COPY[r.entityType].plural);
        return (
          <Section key={j.code} labelledBy={`pricing-${j.code}`}>
            <div className="grid gap-8">
              <SectionHeading
                id={`pricing-${j.code}`}
                title={`${j.name} annual report`}
                lede={
                  anyQuote
                    ? "Prices per filing. The state fee comes from the state's published fee schedule."
                    : "The state fee comes from the state's published fee schedule. Our service fee is shown before checkout."
                }
              />
              <TableScroll>
                <Table>
                  <THead>
                    <tr>
                      <TH>Entity type</TH>
                      <TH className="text-right">State fee</TH>
                      <TH className="text-right">Our service fee</TH>
                      <TH className="text-right">Total</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {rules.map((r, i) => {
                      const q = quotes[i];
                      return (
                        <TR key={r.ruleKey}>
                          <TD>
                            <Link
                              href={`/annual-report/${j.slug}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                              className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                            >
                              {ENTITY_TYPE_LABELS[r.entityType]}
                            </Link>
                          </TD>
                          <TD className="tnum whitespace-nowrap text-right">{formatCents(q?.governmentFeeCents ?? r.stateFeeCents)}</TD>
                          <TD className="tnum whitespace-nowrap text-right">
                            {q ? formatCents(q.serviceFeeCents) : <span className="text-muted">Shown before checkout</span>}
                          </TD>
                          <TD className="tnum whitespace-nowrap text-right font-semibold">
                            {q ? formatCents(q.totalCents) : <span className="font-normal text-muted">State fee + service fee</span>}
                          </TD>
                        </TR>
                      );
                    })}
                  </tbody>
                </Table>
              </TableScroll>
              <div className="grid gap-2 text-sm leading-6 text-muted">
                {npFree.length ? (
                  <p>
                    {joinList(npFree).replace(/^./, (c) => c.toUpperCase())} with a not-for-profit purpose pay no state fee, so
                    their total is lower by the state fee.
                  </p>
                ) : null}
                <p>
                  Filing directly with the state costs only the state fee. We&apos;re an optional service, and the state&apos;s own
                  online filing is always available.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <FilingCtaLink href={`/find?state=${j.code}`} stateCode={j.code}>
                  Have us file it
                </FilingCtaLink>
                <Link
                  href={`/annual-report/${j.slug}`}
                  className="inline-flex min-h-11 items-center gap-1.5 px-1 text-[15px] font-medium text-fg hover:underline hover:underline-offset-4"
                >
                  {j.name} due dates and requirements
                  <ArrowRight size={16} aria-hidden />
                </Link>
              </div>
            </div>
          </Section>
        );
      })}

      <Section band labelledBy="included-title">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16">
          <div className="grid content-start gap-6">
            <SectionHeading id="included-title" title="What the service fee covers" />
            <ul className="grid gap-3.5">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-7 text-muted">
                  <Check size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-10">
            <div className="grid content-start gap-6">
              <h2 className="text-xl font-semibold tracking-tight text-fg">Not included</h2>
              <ul className="grid gap-3.5">
                {NOT_INCLUDED.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-7 text-muted">
                    <Minus size={18} weight="bold" aria-hidden className="mt-1 shrink-0 text-subtle" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid content-start gap-3 rounded-[var(--radius-surface)] border border-border bg-bg p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-fg">Refunds</h2>
              <p className="text-[15px] leading-7 text-muted">
                Cancel before we submit to the state and you get a full refund. Once it&apos;s submitted, the state keeps its
                fee, so that part can&apos;t be refunded. We refund our service fee if we made an error or can&apos;t complete
                the filing.
              </p>
              <Link
                href="/legal/refunds"
                className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[15px] font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
              >
                Read the refund policy
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <DisclaimerNote
          stateName={tables[0]?.j.name}
          filingUrl={tables[0]?.rules[0]?.officialFilingUrl}
        />
      </Section>
    </>
  );
}
