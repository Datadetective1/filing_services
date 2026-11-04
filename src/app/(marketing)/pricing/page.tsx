import { ArrowRight, ArrowsClockwise, Check, Receipt, UserCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { PlanCards } from "@/components/marketing/plan-cards";
import { PriceFinder } from "@/components/marketing/price-finder";
import { textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import type { FaqItem } from "@/lib/compliance/types";
import { annualReportPrices, planOffers } from "@/lib/services/plan-offers";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: "Pricing: State Fee Plus Our Service Fee",
  description:
    "Registered agent service, annual report filing and the bundle, priced up front. State fees are passed through at cost on their own line.",
  path: "/pricing",
});

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Pricing", path: "/pricing" },
];

const INCLUDED = [
  "A check of your answers before anything is filed",
  "We submit it and pay the state fee for you",
  "Email updates until the state accepts it",
  "The state's confirmation, kept in your dashboard",
  "Fixes if the state sends it back",
  "Reminders before next year's deadline",
];

const PROMISES = [
  { icon: Receipt, title: "State fee at cost", body: "Always its own line." },
  { icon: ArrowsClockwise, title: "Same price at renewal", body: "No first-year teaser." },
  { icon: UserCheck, title: "A person checks it", body: "Before anything is filed." },
];

const REFUND_TEXT =
  "Cancel before we submit to the state and you get a full refund. Once it's submitted, the state keeps its fee, so that part can't be refunded. We refund our service fee if we made an error or can't complete the filing.";

export default async function PricingPage() {
  const [offers, statePrices] = await Promise.all([planOffers(), annualReportPrices()]);

  const faq: FaqItem[] = [
    {
      q: "Is the state fee marked up?",
      a: "No. We pass the state fee through at cost and pay it to the state on your behalf. It is always its own line, separate from our service fee.",
    },
    {
      q: "Can I file it myself instead?",
      a: "Yes, you can file directly with the state. If you'd rather not deal with it, we prepare and submit it, pay the state fee for you and keep the records.",
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

      {/* Hero: one promise, then the plans */}
      <section aria-labelledby="pricing-title" className="grain overflow-hidden bg-surface-2">
        <Container className="grid gap-12 pb-16 pt-6 sm:pt-10 lg:pb-24 lg:pt-12">
          <div className="grid justify-items-center gap-5 text-center">
            <Breadcrumbs items={CRUMBS} />
            <h1
              id="pricing-title"
              className="max-w-[16ch] text-[40px] font-semibold leading-[1.03] tracking-[-0.03em] text-fg sm:text-[56px] lg:text-[64px]"
            >
              Clear prices. <span className="mark-highlight">No surprises.</span>
            </h1>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-muted sm:text-lg">
              The state&apos;s fee is passed through at cost. You see the full total before you pay.
            </p>
          </div>

          <PlanCards offers={offers} className="pt-3" />

          <ul className="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-3" aria-label="Our pricing promises">
            {PROMISES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-center gap-3 rounded-full border border-border bg-surface/70 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
                  <Icon size={18} weight="fill" aria-hidden />
                </span>
                <span className="grid leading-tight">
                  <span className="text-[15px] font-semibold text-fg">{title}</span>
                  <span className="text-sm text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Annual report: the all-in price for the visitor's state */}
      {statePrices.length > 0 ? (
        <section id="cost" aria-labelledby="cost-title" className="scroll-mt-24 py-16 sm:py-24">
          <Container className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-16">
            <div className="grid content-start gap-4">
              <h2 id="cost-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
                What will my annual report cost?
              </h2>
              <p className="text-[17px] leading-relaxed text-muted">
                Pick your state. The total includes the state fee.
              </p>
              <Link href="/annual-report" className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5 justify-self-start`}>
                Due dates by state
                <ArrowRight size={16} weight="bold" aria-hidden />
              </Link>
            </div>
            <PriceFinder states={statePrices} initialCode="PA" />
          </Container>
        </section>
      ) : null}

      {/* What the fee covers */}
      <section aria-labelledby="included-title" className="grain bg-surface-2 py-16 sm:py-24">
        <Container className="grid gap-8">
          <h2 id="included-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            Every filing includes
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-[var(--radius-surface)] border border-border bg-surface px-5 py-4 text-[15px] leading-6 text-fg">
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
                  <Check size={13} weight="bold" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Questions */}
      <section aria-labelledby="pricing-faq-title" className="py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <div className="grid content-start gap-4">
            <h2 id="pricing-faq-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              Pricing questions
            </h2>
            <Link href="/legal/refunds" className={`${textLinkClasses} inline-flex min-h-11 items-center justify-self-start`}>
              Refund policy
            </Link>
          </div>
          <FaqList items={faq} />
        </Container>
        <Container className="mt-14">
          <DisclaimerNote />
        </Container>
      </section>
    </>
  );
}
