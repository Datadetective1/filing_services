import { ArrowRight, ArrowSquareOut, Check, Minus, SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { buttonClasses, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { Receipt } from "@/components/visual/receipt";
import { publicQuote } from "@/lib/compliance/public-quote";
import { isRuleSellable, isStateVerified, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import type { FaqItem } from "@/lib/compliance/types";
import { verifiedText } from "@/lib/compliance/view";
import { formatCents } from "@/lib/domain/money";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { agencyShortName, sortByDue } from "@/lib/seo/content";
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

const REFUND_TEXT =
  "Cancel before we submit to the state and you get a full refund. Once it's submitted, the state keeps its fee, so that part can't be refunded. We refund our service fee if we made an error or can't complete the filing.";

export default async function PricingPage() {
  // Only states where Filewell actually sells filing (approved price + live switch decide checkout).
  const states = listJurisdictions().filter((j) => isStateVerified(j.code) && rulesForState(j.code).some((r) => isRuleSellable(r)));
  const tables = await Promise.all(
    states.map(async (j) => {
      const rules = sortByDue(rulesForState(j.code).filter((r) => r.verificationStatus === "verified"));
      const quotes = await Promise.all(rules.map((r) => publicQuote(r)));
      return { j, rules, quotes };
    }),
  );

  // The side-by-side example: an LLC in the first supported state (or its first rule).
  const featured = tables[0] ?? null;
  const exampleIndex = featured ? Math.max(0, featured.rules.findIndex((r) => r.entityType === "llc")) : -1;
  const exampleRule = featured && exampleIndex >= 0 ? featured.rules[exampleIndex] : null;
  const exampleQuote = featured && exampleIndex >= 0 ? featured.quotes[exampleIndex] : null;
  const exampleState = featured?.j ?? null;

  const faq: FaqItem[] = [
    {
      q: "Is the state fee marked up?",
      a: "No. We pass the state fee through at cost and pay it to the state on your behalf. It is always its own line, separate from our service fee.",
    },
    {
      q: "Can I file it myself instead?",
      a: "Yes. Filing directly with the state costs only the state fee. We're an optional service, and the state's own online filing is always available.",
    },
    {
      q: "What if the state sends the filing back?",
      a: "We fix what we can and ask you for anything else. That's part of what the service fee covers.",
    },
    { q: "Can I get a refund?", a: REFUND_TEXT },
    {
      q: "Can the price change after I order?",
      a: "No. Prices can change over time, but the price shown at checkout is the price for that order.",
    },
  ];

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS))} />

      {/* Hero: the two ways to file, as two receipts */}
      <section aria-labelledby="pricing-title" className="grain overflow-hidden bg-surface-2">
        <Container className="grid gap-10 pb-16 pt-6 sm:pt-10 lg:pb-24 lg:pt-12">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
            <div className="grid content-start gap-5">
              <Breadcrumbs items={CRUMBS} />
              <h1
                id="pricing-title"
                className="max-w-[12ch] text-[40px] font-semibold leading-[1.03] tracking-[-0.03em] text-fg sm:text-[56px] lg:text-[64px]"
              >
                Pricing, <span className="mark-highlight">line by line</span>
              </h1>
            </div>
            <p className="max-w-[46ch] text-[17px] leading-relaxed text-muted sm:text-lg lg:pb-2">
              Two parts, always on separate lines: the state&apos;s filing fee, passed through at cost, and our service fee for
              preparing and submitting the filing. You see both before you pay.
            </p>
          </div>

          {exampleRule && exampleState ? (
            <div className="grid gap-8 md:grid-cols-2 md:gap-10 lg:mx-auto lg:w-full lg:max-w-5xl lg:gap-14">
              <div className="grid content-start gap-3">
                <p className="px-1 text-[13px] font-semibold uppercase tracking-wider text-subtle">Option 1</p>
                <Receipt
                  title="If you file it yourself"
                  meta={`${exampleState.name} ${ENTITY_TYPE_LABELS[exampleRule.entityType]} annual report`}
                  className="md:rotate-[-1deg]"
                  footer={
                    <span className="flex items-start gap-2">
                      <SealCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
                      State fee verified against the {agencyShortName(exampleState)}, {verifiedText(exampleRule.lastVerifiedAt)}.
                    </span>
                  }
                >
                  <dl className="grid gap-3 text-[15px]">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-fg">
                        State filing fee
                        <span className="block text-[13px] text-muted">Paid directly to {exampleState.name}</span>
                      </dt>
                      <dd className="tnum font-semibold text-fg">{formatCents(exampleRule.stateFeeCents)}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-fg">
                        No service fee
                        <span className="block text-[13px] text-muted">You enter and submit it on the state&apos;s site</span>
                      </dt>
                      <dd className="tnum font-semibold text-subtle">{formatCents(0)}</dd>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-4 border-t-2 border-dashed border-border-strong pt-3.5">
                      <dt className="font-semibold text-fg">Total if you file it</dt>
                      <dd className="tnum font-display text-2xl font-semibold text-fg">{formatCents(exampleRule.stateFeeCents)}</dd>
                    </div>
                  </dl>
                  <div className="mt-5">
                    <a
                      href={exampleRule.officialFilingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClasses("secondary", "lg", "w-full")}
                    >
                      File at {new URL(exampleRule.officialFilingUrl).host}
                      <ArrowSquareOut size={18} aria-hidden />
                      <span className="sr-only">(opens the state&apos;s filing website in a new tab)</span>
                    </a>
                  </div>
                </Receipt>
              </div>

              <div className="grid content-start gap-3">
                <p className="px-1 text-[13px] font-semibold uppercase tracking-wider text-subtle">Option 2</p>
                <Receipt
                  title="If we file it for you"
                  meta={`${exampleState.name} ${ENTITY_TYPE_LABELS[exampleRule.entityType]} annual report`}
                  className="md:rotate-[1deg]"
                  footer={
                    <span className="flex items-start gap-2">
                      <SealCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
                      The state fee is passed through at cost. Our fee is its own line.
                    </span>
                  }
                >
                  {exampleQuote ? (
                    <PriceBreakdown quote={exampleQuote} stateName={exampleState.name} totalLabel="Total if we file it" />
                  ) : (
                    <p className="text-[15px] leading-6 text-muted">
                      State fee {formatCents(exampleRule.stateFeeCents)}. Our service fee is shown as its own line before
                      checkout.
                    </p>
                  )}
                  <div className="mt-5">
                    <FilingCtaLink
                      href={`/find?state=${exampleState.code}&entity=${exampleRule.entityType}`}
                      stateCode={exampleState.code}
                      entityType={exampleRule.entityType}
                      className="w-full"
                    >
                      Have us file it
                    </FilingCtaLink>
                  </div>
                </Receipt>
              </div>
            </div>
          ) : null}
        </Container>
      </section>

      {/* Every entity type, per state */}
      {tables.map(({ j, rules, quotes }) => {
        const anyQuote = quotes.some(Boolean);
        const npFree = rules
          .filter((r) => r.stateFeeCents > 0 && r.nonprofitStateFeeCents === 0)
          .map((r) => ENTITY_COPY[r.entityType].plural);
        return (
          <section key={j.code} aria-labelledby={`pricing-${j.code}`} className="py-16 sm:py-24">
            <Container className="grid gap-8">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="grid max-w-2xl gap-3">
                  <h2 id={`pricing-${j.code}`} className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
                    {j.name} annual report
                  </h2>
                  <p className="text-[17px] leading-relaxed text-muted">
                    {anyQuote
                      ? "Prices per filing. The state fee comes from the state's published fee schedule."
                      : "The state fee comes from the state's published fee schedule. Our service fee is shown before checkout."}
                  </p>
                </div>
                <Link href={`/annual-report/${j.slug}`} className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5`}>
                  {j.name} due dates and requirements
                  <ArrowRight size={16} weight="bold" aria-hidden />
                </Link>
              </div>

              {/* Wide: a real table */}
              <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface shadow-card max-md:hidden">
                <table className="w-full border-collapse text-left text-[15px]">
                  <thead className="bg-surface-2/70 text-[13px] text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">Entity type</th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">State fee</th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">Our service fee</th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r, i) => {
                      const q = quotes[i];
                      return (
                        <tr key={r.ruleKey} className="border-t border-border">
                          <th scope="row" className="px-5 py-3.5 font-normal">
                            <Link
                              href={`/annual-report/${j.slug}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                              className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                            >
                              {ENTITY_TYPE_LABELS[r.entityType]}
                            </Link>
                          </th>
                          <td className="tnum whitespace-nowrap px-5 py-3.5 text-right text-fg">
                            {formatCents(q?.governmentFeeCents ?? r.stateFeeCents)}
                          </td>
                          <td className="tnum whitespace-nowrap px-5 py-3.5 text-right text-fg">
                            {q ? formatCents(q.serviceFeeCents) : <span className="text-muted">Shown before checkout</span>}
                          </td>
                          <td className="tnum whitespace-nowrap px-5 py-3.5 text-right font-display text-[17px] font-semibold text-fg">
                            {q ? formatCents(q.totalCents) : <span className="font-sans text-[15px] font-normal text-muted">State fee + service fee</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Narrow: one line item per entity type */}
              <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface md:hidden">
                {rules.map((r, i) => {
                  const q = quotes[i];
                  return (
                    <li key={r.ruleKey} className="grid gap-2 p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={`/annual-report/${j.slug}/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                          className="font-semibold text-fg underline decoration-border-strong underline-offset-4"
                        >
                          {ENTITY_TYPE_LABELS[r.entityType]}
                        </Link>
                        <span className="tnum shrink-0 font-display text-lg font-semibold text-fg">
                          {q ? formatCents(q.totalCents) : null}
                        </span>
                      </div>
                      <p className="tnum text-[14px] text-muted">
                        State fee {formatCents(q?.governmentFeeCents ?? r.stateFeeCents)} +{" "}
                        {q ? `our service fee ${formatCents(q.serviceFeeCents)}` : "our service fee, shown before checkout"}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="grid max-w-[72ch] gap-2 text-[15px] leading-7 text-muted">
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
              </div>
            </Container>
          </section>
        );
      })}

      {/* What the fee covers */}
      <section aria-labelledby="included-title" className="grain bg-surface-2 py-16 sm:py-24">
        <Container className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-16">
          <div className="grid content-start gap-6">
            <h2 id="included-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              What the service fee covers
            </h2>
            <ul className="grid gap-0 overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 border-b border-dashed border-border px-5 py-3.5 text-[15px] leading-6 text-fg last:border-b-0">
                  <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
                    <Check size={12} weight="bold" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-8 md:pt-[4.5rem]">
            <div className="grid content-start gap-4">
              <h2 className="text-xl font-semibold tracking-tight text-fg">Not included</h2>
              <ul className="grid gap-3">
                {NOT_INCLUDED.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-6 text-muted">
                    <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-muted">
                      <Minus size={12} weight="bold" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid content-start gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
              <h2 className="text-xl font-semibold tracking-tight text-fg">Refunds</h2>
              <p className="text-[15px] leading-7 text-muted">{REFUND_TEXT}</p>
              <Link href="/legal/refunds" className={`${textLinkClasses} inline-flex min-h-11 items-center justify-self-start`}>
                Read the refund policy
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Questions */}
      <section aria-labelledby="pricing-faq-title" className="py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <h2 id="pricing-faq-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            Pricing questions
          </h2>
          <FaqList items={faq} />
        </Container>
        <Container className="mt-14">
          <DisclaimerNote stateName={tables[0]?.j.name} filingUrl={tables[0]?.rules[0]?.officialFilingUrl} />
        </Container>
      </section>
    </>
  );
}
