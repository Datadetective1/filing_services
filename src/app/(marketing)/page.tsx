import { ArrowRight, ArrowUpRight, Bell, BellSlash, CheckCircle, HandPointing } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { TrackView } from "@/components/analytics/track-view";
import { RequirementCard } from "@/components/compliance/requirement-card";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { Section, SectionHeading } from "@/components/marketing/section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { publicQuote } from "@/lib/compliance/public-quote";
import { findRule, getJurisdiction, rulesForState } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import type { FaqItem } from "@/lib/compliance/types";
import { formatLongDate } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import { DEFAULT_REMINDER_OFFSETS } from "@/lib/domain/reminders";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { agencyShortName, dueDayText } from "@/lib/seo/content";
import { graph, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { marketingPeriod } from "@/lib/seo/period";

// The hero card shows the current filing period, so refresh hourly.
export const revalidate = 3600;

export const metadata: Metadata = pageMetadata({
  title: `${site.name}: ${site.tagline}`,
  description: site.description,
  path: "/",
  absoluteTitle: true,
});

const STEPS = [
  {
    title: "Find your business",
    body: "Tell us the state, the entity type and the business name. We match it to that state's verified filing rules.",
  },
  {
    title: "See what's due and what it costs",
    body: "The due date, the state fee and our service fee, each on its own line, with a link to the official source.",
  },
  {
    title: "We prepare and file it",
    body: "You answer a short form and authorize the filing. A person on our team checks it, prepares it and submits it to the state.",
  },
  {
    title: "You get the state receipt",
    body: "We email you when it's submitted and when the state accepts it, and keep the confirmation in your dashboard.",
  },
];

function offsetLabel(offset: number): string {
  if (offset === 0) return "On the due date";
  const n = Math.abs(offset);
  return `${n} ${n === 1 ? "day" : "days"} ${offset < 0 ? "before" : "after"}`;
}

export default async function HomePage() {
  const pa = getJurisdiction("PA");
  const rule = findRule("PA", "llc");
  const paRules = rulesForState("PA");
  const periodInfo = rule ? marketingPeriod(rule) : null;
  const quote = rule ? await publicQuote(rule) : null;
  const agency = pa ? agencyShortName(pa) : "Pennsylvania Department of State";

  const before = DEFAULT_REMINDER_OFFSETS.filter((o) => o < 0);
  const after = DEFAULT_REMINDER_OFFSETS.filter((o) => o > 0);

  const faq: FaqItem[] = [
    {
      q: `Is ${site.name} a government agency?`,
      a: `No. ${site.name} is a private company that prepares and submits filings for businesses. We are not affiliated with or endorsed by any government agency, and you can always file directly with your state.`,
    },
    {
      q: "Do I have to use a filing service?",
      a: `No. You can file directly with your state. Based on the ${agency}'s published requirements, filing a Pennsylvania annual report online costs ${PENNSYLVANIA_FACTS.directFilingFeeText}, and online filings are approved automatically.`,
    },
    {
      q: "What does it cost to have you file?",
      a: "The state fee plus our service fee. We show them as separate lines before you pay, and the state fee is passed through at cost. The pricing page lists every supported filing.",
    },
    {
      q: "Which states do you support?",
      a: "Pennsylvania annual reports today. We add a state only after checking its requirements against official government sources. Until then, we list it as not yet verified and link to the state's own website.",
    },
    {
      q: "Do you give legal advice?",
      a: "No. We're not a law firm. We show published requirements with links to the official sources, and we file the information you provide and confirm.",
    },
  ];

  return (
    <>
      <TrackView event="landing_viewed" />
      <JsonLd data={graph(organizationJsonLd(), websiteJsonLd())} />

      {/* Hero */}
      <section aria-labelledby="hero-title" className="border-b border-border">
        <Container className="grid items-center gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-16 lg:py-24">
          <div className="grid gap-7">
            <h1
              id="hero-title"
              className="max-w-[16ch] text-[42px] font-semibold leading-[1.02] tracking-[-0.03em] text-fg sm:text-6xl lg:text-[72px]"
            >
              Never miss a business filing.
            </h1>
            <p className="max-w-[44ch] text-lg leading-relaxed text-muted text-pretty sm:text-xl">
              Know what your business needs to file, when it&apos;s due, and get it handled.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/find" size="lg">
                Find my business
                <ArrowRight size={18} weight="bold" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/states" size="lg" variant="secondary">
                Browse by state
              </ButtonLink>
            </div>
            <p className="max-w-[52ch] text-sm leading-6 text-muted">
              Pennsylvania annual reports supported today. {site.disclaimer}
            </p>
          </div>

          {rule ? (
            <div className="grid gap-3">
              <RequirementCard
                rule={rule}
                period={periodInfo?.period}
                quote={quote}
                actions={
                  <FilingCtaLink href="/find?state=PA&entity=llc" stateCode="PA" entityType="llc">
                    Have us file it
                  </FilingCtaLink>
                }
              />
              <p className="px-1 text-xs leading-5 text-subtle">
                {periodInfo?.missed
                  ? `The ${periodInfo.missed.periodYear} report was due ${formatLongDate(periodInfo.missed.dueDate)}. If it hasn't been filed yet, it can still be filed. ${rule.lateFeeSummary} `
                  : null}
                Example for a Pennsylvania LLC, based on the {agency}&apos;s published requirements.
              </p>
            </div>
          ) : null}
        </Container>
      </section>

      {/* How it works */}
      <Section labelledBy="how-title">
        <SectionHeading
          id="how-title"
          title="How it works"
          lede="Four steps, and you can stop after the second one. Knowing what's due is useful on its own."
        />
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="grid content-start gap-3 border-t border-border-strong pt-5">
              <span className="tnum text-sm font-medium text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-lg font-semibold tracking-tight text-fg">{step.title}</h3>
              <p className="text-[15px] leading-7 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Reminders */}
      <Section labelledBy="reminders-title" band>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-20">
          <div className="grid content-start gap-8">
            <SectionHeading
              id="reminders-title"
              title="Reminders on a schedule you can see"
              lede="Add your business and we email you ahead of each due date. Every reminder is checked again on the day it goes out, so you never get one for a filing that is already done."
            />
            <ul className="grid gap-5">
              <li className="flex gap-3">
                <CheckCircle size={22} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
                <p className="text-[15px] leading-7 text-muted">
                  <strong className="font-medium text-fg">Reminders stop once it&apos;s filed.</strong> Whether we filed it
                  or you did, you won&apos;t hear about that deadline again. If you filed on your own, mark it as filed.
                </p>
              </li>
              <li className="flex gap-3">
                <HandPointing size={22} aria-hidden className="mt-0.5 shrink-0 text-fg" />
                <p className="text-[15px] leading-7 text-muted">
                  <strong className="font-medium text-fg">Quiet while we&apos;re working on it.</strong> If you&apos;ve
                  ordered the filing, we send status updates instead of deadline reminders. If we need something from
                  you, we ask for it directly.
                </p>
              </li>
              <li className="flex gap-3">
                <BellSlash size={22} aria-hidden className="mt-0.5 shrink-0 text-fg" />
                <p className="text-[15px] leading-7 text-muted">
                  <strong className="font-medium text-fg">Turn them off any time.</strong> Every reminder email has an
                  unsubscribe link, and you can change it in your account settings.
                </p>
              </li>
            </ul>
          </div>

          <div className="rounded-[var(--radius-surface)] border border-border bg-bg p-5 sm:p-6">
            <p className="flex items-center gap-2 text-sm font-medium text-fg">
              <Bell size={18} aria-hidden />
              Reminder schedule
            </p>
            <ol className="relative mt-5 grid gap-3.5 pl-6 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border-strong">
              {before.map((o) => (
                <li key={o} className="relative text-[15px] text-muted">
                  <span aria-hidden className="absolute -left-6 top-[7px] size-[11px] rounded-full border-2 border-border-strong bg-bg" />
                  <span className="tnum">{offsetLabel(o)}</span>
                </li>
              ))}
              <li className="relative text-[15px] font-medium text-fg">
                <span aria-hidden className="absolute -left-6 top-[6px] size-[11px] rounded-full bg-accent ring-4 ring-accent-soft" />
                On the due date
              </li>
              <li className="relative text-[15px] text-muted">
                <span aria-hidden className="absolute -left-6 top-[7px] size-[11px] rounded-full border-2 border-border-strong bg-bg" />
                <span className="tnum">
                  {after.map((o) => Math.abs(o)).join(", ").replace(/, (\d+)$/, " and $1")} days after, only if it&apos;s still
                  open
                </span>
              </li>
            </ol>
          </div>
        </div>
      </Section>

      {/* Honesty: DIY vs. us */}
      <Section labelledBy="choice-title">
        <SectionHeading
          id="choice-title"
          title="File it yourself or have us do it"
          lede="Both are good options. We'd rather you choose with the full picture."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-4 rounded-[var(--radius-surface)] border border-border bg-surface-2 p-6 sm:p-8">
            <h3 className="text-xl font-semibold tracking-tight text-fg">File directly with your state</h3>
            <p className="text-[15px] leading-7 text-muted">
              You can always file with the state yourself and pay only the state fee.{" "}
              {rule ? (
                <>
                  Based on the {agency}&apos;s published requirements, a Pennsylvania LLC files online for{" "}
                  {formatCents(rule.stateFeeCents, { trimZeros: true })}, and online filings are approved automatically,
                  usually within minutes.
                </>
              ) : null}
            </p>
            {rule ? (
              <a
                href={rule.officialFilingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[15px] font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
              >
                Pennsylvania&apos;s official filing site
                <ArrowUpRight size={16} aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : null}
          </div>
          <div className="grid content-start gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card sm:p-8">
            <h3 className="text-xl font-semibold tracking-tight text-fg">Have us file it</h3>
            <p className="text-[15px] leading-7 text-muted">
              We prepare the filing from your answers, submit it, and send you the state&apos;s confirmation. Before you
              pay, you see the state fee and our service fee as separate lines. The state fee is passed through at cost.
            </p>
            <Link
              href="/pricing"
              className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-[15px] font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              See pricing
              <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </Section>

      {/* Coverage */}
      <Section labelledBy="coverage-title" band>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <div className="grid content-start gap-6">
            <SectionHeading
              id="coverage-title"
              title="Where we file today"
              lede="We only show due dates and fees after checking them against official government sources."
            />
            <p className="text-[15px] leading-7 text-muted">
              Pennsylvania annual reports are supported now. Every other state, and the District of Columbia, is listed as
              not yet verified. Those pages link to the state&apos;s own agency and make no claims about deadlines or fees.
            </p>
            <ButtonLink href="/states" variant="secondary" size="lg" className="justify-self-start">
              Browse by state
            </ButtonLink>
          </div>

          <div className="overflow-hidden rounded-[var(--radius-surface)] border border-border bg-bg">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <Link href="/annual-report/pennsylvania" className="font-semibold text-fg hover:underline hover:underline-offset-4">
                Pennsylvania annual report
              </Link>
              <Badge tone="success">Supported</Badge>
            </div>
            <ul className="divide-y divide-border">
              {paRules.map((r) => (
                <li key={r.ruleKey}>
                  <Link
                    href={`/annual-report/pennsylvania/${ENTITY_TYPE_SLUGS[r.entityType]}`}
                    className="flex min-h-12 flex-col justify-center gap-0.5 px-5 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="text-[15px] text-fg">{ENTITY_TYPE_LABELS[r.entityType]}</span>
                    <span className="tnum text-sm text-muted">Due {dueDayText(r)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section labelledBy="faq-title">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <SectionHeading id="faq-title" title="Questions" lede="Short answers. The state pages go into detail." />
          <FaqList items={faq} />
        </div>
      </Section>

      {/* Closing CTA */}
      <section aria-labelledby="cta-title" className="border-t border-border bg-surface">
        <Container className="grid gap-8 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-4">
            <h2 id="cta-title" className="max-w-[20ch] text-3xl font-semibold tracking-tight text-fg text-balance sm:text-[40px] sm:leading-tight">
              Find out what your business needs to file.
            </h2>
            <p className="max-w-[52ch] text-base leading-relaxed text-muted sm:text-lg">
              It takes about a minute, and you don&apos;t need an account to see the answer.
            </p>
          </div>
          <ButtonLink href="/find" size="lg" className="justify-self-start">
            Find my business
            <ArrowRight size={18} weight="bold" aria-hidden />
          </ButtonLink>
          <DisclaimerNote
            className="lg:col-span-2"
            stateName="Pennsylvania"
            filingUrl={rule?.officialFilingUrl ?? PENNSYLVANIA_FACTS.officialFilingUrl}
          />
        </Container>
      </section>
    </>
  );
}
