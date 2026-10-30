import { ArrowRight, ArrowUpRight, BellSlash, CalendarX, ChatCircleText, SealCheck, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { TrackView } from "@/components/analytics/track-view";
import { PriceBreakdown } from "@/components/compliance/price-breakdown";
import { Photo } from "@/components/media/photo";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { publicServicePrices } from "@/lib/services/public-prices";
import { FilingCtaLink } from "@/components/marketing/cta-link";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { FaqList } from "@/components/marketing/faq";
import { FilingProcess } from "@/components/marketing/filing-process";
import { HeroStatusCard } from "@/components/marketing/hero-status-card";
import { JsonLd } from "@/components/marketing/json-ld";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Section, SectionHeading } from "@/components/marketing/section";
import { ButtonLink, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { HeroFinder } from "@/components/funnel/hero-finder";
import { lookupStates, stateSalesEnabled } from "@/lib/compliance/launch";
import { Receipt } from "@/components/visual/receipt";
import { searchRegistry, selectRegistryEntity } from "./find/registry-actions";
import { ReminderTimeline } from "@/components/visual/reminder-timeline";
import { publicQuote } from "@/lib/compliance/public-quote";
import { findRule, getJurisdiction, listJurisdictions, rulesForState } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import type { FaqItem } from "@/lib/compliance/types";
import { verifiedText } from "@/lib/compliance/view";
import { formatLongDate, todayInTimeZone } from "@/lib/domain/dates";
import { formatCents } from "@/lib/domain/money";
import { DEFAULT_REMINDER_OFFSETS, planReminders } from "@/lib/domain/reminders";
import { ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { agencyShortName, dueGroups } from "@/lib/seo/content";
import { ENTITY_COPY } from "@/lib/seo/entities";
import { heroRule } from "@/lib/seo/hero-rule";
import { businessServicesIndexable } from "@/lib/registered-agent/sales";
import { faqJsonLd, graph, organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { homeMetadata, supportedStatesAnswer } from "@/lib/seo/home";
import { marketingPeriod } from "@/lib/seo/period";

// The status card and product preview count days to a deadline, so render on every
// request: a cached (stale-while-revalidate) copy could show yesterday's countdown.
export const revalidate = 0;

export function generateMetadata(): Metadata {
  return homeMetadata(businessServicesIndexable());
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function HomePage() {
  const pa = getJurisdiction("PA");
  const paRules = rulesForState("PA");
  const today = todayInTimeZone(pa?.timezone ?? "America/New_York");
  // The Pennsylvania deadline that comes next (December 31: limited partnerships and the
  // other filing entities; June 30: corporations; September 30: LLCs).
  const rule = heroRule(paRules, today)?.rule ?? findRule("PA", "llc");
  const entityCopy = rule ? ENTITY_COPY[rule.entityType] : ENTITY_COPY.llc;
  const marketing = rule ? marketingPeriod(rule) : null;
  const periodInfo = marketing?.period ? { period: marketing.period, missed: marketing.missed } : null;
  const quote = rule ? await publicQuote(rule) : null;
  const raPrice = businessServicesPagesEnabled() ? (await publicServicePrices()).registered_agent : undefined;
  const agency = pa ? agencyShortName(pa) : "Pennsylvania Department of State";
  const stateName = pa?.name ?? "Pennsylvania";
  const groups = dueGroups(paRules);
  const reminderFor = (dueDate: string) =>
    planReminders(dueDate, DEFAULT_REMINDER_OFFSETS, today).find((r) => r.status === "scheduled")?.scheduledFor ?? null;
  // After the deadline the preview shows the missed report, which can still be filed.
  const previewPeriod = periodInfo ? (periodInfo.missed ?? periodInfo.period) : null;
  const nextReminder = periodInfo
    ? ((periodInfo.missed ? reminderFor(periodInfo.missed.dueDate) : null) ?? reminderFor(periodInfo.period.dueDate))
    : null;
  const directFee = rule ? formatCents(rule.stateFeeCents, { trimZeros: true }) : "$7";

  const faq: FaqItem[] = [
    {
      q: `Is ${site.name} a government agency?`,
      a: `No. ${site.name} is a private company that prepares and submits filings for businesses. We are not affiliated with or endorsed by any government agency, and you can always file directly with your state.`,
    },
    {
      q: "Do I have to use a filing service?",
      a: "No. You can file directly with your state. If you'd rather not, we prepare and submit it for you and send you the state's confirmation.",
    },
    {
      q: "What does it cost to have you file?",
      a: "The state fee plus our service fee. We show them as separate lines before you pay, and the state fee is passed through at cost. The pricing page lists every supported filing.",
    },
    {
      q: "Which states do you support?",
      a: supportedStatesAnswer(listJurisdictions().filter((j) => stateSalesEnabled(j.code)).map((j) => j.name)),
    },
    {
      q: "Do you give legal advice?",
      a: "No. We're not a law firm. We show published requirements with links to the official sources, and we file the information you provide and confirm.",
    },
  ];

  return (
    <>
      <TrackView event="landing_viewed" />
      <JsonLd data={graph(organizationJsonLd(), websiteJsonLd(), faqJsonLd(faq))} />

      {/* 1. Hero */}
      <section aria-labelledby="hero-title" className="overflow-hidden">
        <Container className="grid items-center gap-10 pb-16 pt-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-14 lg:pb-24 lg:pt-16">
          <div className="grid gap-7">
            {raPrice !== undefined ? (
              <>
                <h1
                  id="hero-title"
                  className="max-w-[15ch] text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] text-fg sm:text-[56px] lg:text-[64px]"
                >
                  Annual reports and registered agent, <span className="mark-highlight">handled</span>.
                </h1>
                <p className="max-w-[38ch] text-lg leading-relaxed text-muted sm:text-xl">
                  We file your state annual report, and we can be your registered agent. Pick what your business needs.
                </p>
                <ul className="grid gap-3 sm:grid-cols-2" aria-label="Our services">
                  <ServiceChoice
                    title="Annual report filing"
                    price={quote ? `${formatCents(quote.serviceFeeCents, { trimZeros: true })} plus the state fee` : "Plus the state fee"}
                    body="We tell you what's due and file it when you ask."
                    href="/find"
                    cta="Find my business"
                  />
                  <ServiceChoice
                    title="Registered agent"
                    price={`${formatCents(raPrice, { trimZeros: true })} a year`}
                    body="Same price at renewal. Legal mail is scanned to your dashboard."
                    href="/registered-agent"
                    cta="Get a registered agent"
                  />
                </ul>
              </>
            ) : (
              <>
                <h1
                  id="hero-title"
                  className="max-w-[13ch] text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] text-fg sm:text-[64px] lg:text-[76px]"
                >
                  Never miss a <span className="mark-highlight">business filing</span> again.
                </h1>
                <p className="max-w-[34ch] text-lg leading-relaxed text-muted sm:text-xl">
                  We&apos;ll tell you what&apos;s due before it becomes urgent, and file it for you when you ask.
                </p>
              </>
            )}
            {/* The main acquisition path: search the register right here, no account needed. */}
            {raPrice !== undefined ? (
              <p className="-mb-4 text-sm font-medium text-fg">Check your annual report deadline</p>
            ) : null}
            <div id="find" className="grid scroll-mt-24 gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-card sm:p-5">
              <HeroFinder
                states={lookupStates().map((code) => ({ code, name: getJurisdiction(code)?.name ?? code }))}
                search={searchRegistry}
                select={selectRegistryEntity}
              />
            </div>
            <p className="text-sm text-muted">
              Another state?{" "}
              <Link href="/find" className={textLinkClasses}>
                Enter your details
              </Link>{" "}
              or{" "}
              <Link href="/states" className={textLinkClasses}>
                browse filing requirements
              </Link>
              .
            </p>
            <p className="flex max-w-[46ch] items-start gap-2 text-sm leading-6 text-muted">
              <ShieldCheck size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <span>{site.disclaimer}</span>
            </p>
          </div>

          <div className="relative lg:pl-6">
            <Photo
              photo="ownerCoffeeShop"
              priority
              sizes="(min-width: 1024px) 46vw, 100vw"
              className="aspect-[4/3] sm:aspect-[16/11] lg:aspect-[4/5]"
              focus="48% 30%"
              focusWide="54% 30%"
            />
            {rule && periodInfo ? (
              <HeroStatusCard
                rule={rule}
                period={periodInfo.period}
                missed={periodInfo.missed}
                stateName={stateName}
                agency={agency}
                className="relative z-10 mx-auto -mt-20 sm:-mt-28 lg:absolute lg:-left-10 lg:bottom-10 lg:mt-0"
              />
            ) : null}
          </div>
        </Container>
        {periodInfo?.missed && rule ? (
          <Container className="-mt-8 pb-10 lg:-mt-14">
            <p className="max-w-[70ch] text-[13px] leading-5 text-subtle">
              The {formatLongDate(periodInfo.missed.dueDate)} deadline for {stateName} {entityCopy.singular} annual reports has passed. If
              your {entityCopy.singular} hasn&apos;t filed its {periodInfo.missed.periodYear} report yet, it can still be filed.{" "}
              {rule.lateFeeSummary}
            </p>
          </Container>
        ) : null}
      </section>

      {/* 2. The problem */}
      <Section labelledBy="problem-title" band>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Photo
            photo="paperworkKitchenTable"
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="order-2 aspect-[16/10] lg:order-1 lg:aspect-[4/5]"
            focus="28% 45%"
          />
          <div className="order-1 grid content-start gap-8 lg:order-2">
            <SectionHeading
              id="problem-title"
              title="Annual reports are new, and easy to miss."
              lede={`Since ${PENNSYLVANIA_FACTS.firstRequiredYear}, most Pennsylvania businesses file one every year. Your deadline depends on what kind of business you are.`}
            />
            <ul className="grid gap-3 sm:grid-cols-3">
              {groups.map((g) => (
                <li key={g.day}>
                  <Link
                    href={`/annual-report/pennsylvania/${ENTITY_TYPE_SLUGS[g.rules[0].entityType]}`}
                    className="group flex h-full items-center gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-3.5 transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-card sm:grid sm:content-start sm:gap-3 sm:p-4"
                  >
                    <span className="grid w-16 shrink-0 overflow-hidden rounded-[10px] border border-border text-center">
                      <span className="bg-accent py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-fg">
                        {g.month ? MONTHS[g.month - 1] : "Due"}
                      </span>
                      <span className="tnum py-1 font-display text-2xl font-semibold text-fg">{g.dayOfMonth ?? "·"}</span>
                    </span>
                    <span className="text-[15px] font-semibold leading-snug text-fg group-hover:text-accent">
                      {g.who}
                      <span className="sr-only">: due {g.day}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
                <CalendarX size={18} weight="bold" aria-hidden />
              </span>
              <p className="text-[15px] leading-7 text-fg">
                Starting with reports due in {PENNSYLVANIA_FACTS.enforcementStartsWithReportsDueIn}, a business that
                doesn&apos;t file can be administratively dissolved six months after its due date.{" "}
                <a href={PENNSYLVANIA_FACTS.officialInfoUrl} target="_blank" rel="noopener noreferrer" className={textLinkClasses}>
                  {agency}
                  <ArrowUpRight size={14} weight="bold" aria-hidden className="ml-0.5 inline align-[-1px]" />
                  <span className="sr-only"> (opens the government website in a new tab)</span>
                </a>
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* 3. Filewell identifies what's due */}
      <Section labelledBy="know-title">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="grid content-start gap-7">
            <SectionHeading
              id="know-title"
              title="See what's due, and when, in about a minute."
              lede="Tell us your state, your type of business and its name. You'll see the deadline, the state fee and the official source, with no account needed."
            />
            <ol className="grid gap-3">
              {["Your state", "Your type of business", "Your business name"].map((label, i) => (
                <li key={label} className="flex items-center gap-3 text-[17px] font-medium text-fg">
                  <span className="tnum grid size-8 place-items-center rounded-full border border-border-strong bg-surface font-display text-sm font-bold">
                    {i + 1}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
            <ButtonLink href="/find" size="lg" className="justify-self-start">
              Find my business
              <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
          </div>
          <div className="relative pb-10 sm:pb-16 lg:pb-20">
            <Photo
              photo="ownerLaptopDesk"
              sizes="(min-width: 1024px) 48vw, 100vw"
              className="aspect-[4/3] w-full sm:w-[86%]"
              focus="72% 40%"
            />
            {rule && previewPeriod ? (
              <ProductPreview
                rule={rule}
                period={previewPeriod}
                stateName={stateName}
                nextReminder={nextReminder}
                className="relative z-10 -mt-24 ml-auto w-[94%] max-w-[26rem] sm:absolute sm:bottom-0 sm:right-0 sm:mt-0 sm:w-[62%]"
              />
            ) : null}
          </div>
        </div>
      </Section>

      {/* 4. We prepare and file it, if you want */}
      <Section labelledBy="file-title" band>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
          <SectionHeading id="file-title" title="Want it off your plate? We'll file it." />
          <p className="max-w-[46ch] text-[17px] leading-relaxed text-muted lg:justify-self-end lg:pb-1.5">
            You stay in control. We handle the paperwork when you ask us to, and send you the state&apos;s confirmation
            when it&apos;s done.
          </p>
        </div>
        <div className="mt-12">
          <FilingProcess stateName={stateName} agency={agency} />
        </div>
      </Section>

      {/* 5. Reminders */}
      <Section labelledBy="reminders-title">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="grid content-start gap-7">
            <SectionHeading
              id="reminders-title"
              title="We'll tell you what's due before it becomes urgent."
              lede="Add your business and we email you 90, 60 and 30 days ahead, then closer to the date. Each reminder is checked again on the day it goes out."
            />
            <div className="flex items-start gap-4 rounded-[var(--radius-surface)] bg-highlight-soft p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-highlight-fg">
                <BellSlash size={20} weight="fill" aria-hidden />
              </span>
              <div className="grid gap-1">
                <p className="font-display text-lg font-semibold text-fg">Already filed it yourself?</p>
                <p className="text-[15px] leading-6 text-fg/80">Tell us and the reminders stop. No need to explain.</p>
              </div>
            </div>
          </div>
          <Photo
            photo="deliOwnerPhone"
            sizes="(min-width: 1024px) 44vw, 100vw"
            className="aspect-[16/11]"
            focus="32% 45%"
          />
        </div>
        <ReminderTimeline offsets={DEFAULT_REMINDER_OFFSETS} className="mt-12" />
      </Section>

      {/* 6. Transparent pricing */}
      <Section labelledBy="pricing-title" band>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div className="grid content-start gap-7">
            <SectionHeading
              id="pricing-title"
              title="Know the state fee before you pay us anything."
              lede="The state's fee and ours are always separate lines. The state fee is passed through at cost, and you see the total before you pay."
            />
            <div className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:grid-cols-[auto_1fr] sm:items-center">
              <span className="font-display text-4xl font-semibold text-fg">{directFee}</span>
              <p className="text-[15px] leading-6 text-muted">
                <strong className="font-semibold text-fg">Pennsylvania&apos;s state fee.</strong> Passed through at cost, with
                our service fee on its own line.
              </p>
            </div>
            <Link href="/pricing" className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5 justify-self-start`}>
              See all pricing
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
            {raPrice !== undefined ? (
              <div className="grid gap-2 rounded-[var(--radius-surface)] border border-border bg-surface p-5">
                <p className="font-display text-lg font-semibold text-fg">
                  Need a registered agent? {formatCents(raPrice, { trimZeros: true })} a year.
                </p>
                <p className="text-[15px] leading-6 text-muted">
                  The same price at renewal. Switching from another agent? We file the change, and you pay only the state&apos;s fee.
                </p>
                <Link href="/registered-agent" className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5 justify-self-start`}>
                  See registered agent service
                  <ArrowRight size={16} weight="bold" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>

          <Receipt
            title="If we file it for you"
            meta={`${stateName} ${entityCopy.singular} annual report`}
            className="mx-auto w-full max-w-md lg:rotate-[1.2deg]"
            footer={
              rule ? (
                <span className="flex items-start gap-2">
                  <SealCheck size={16} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
                  State fee verified against the {agency}, {verifiedText(rule.lastVerifiedAt)}.
                </span>
              ) : null
            }
          >
            {quote ? (
              <PriceBreakdown quote={quote} stateName={stateName} totalLabel="Total if we file it" />
            ) : (
              <p className="text-[15px] text-muted">
                State fee {directFee}. Our service fee is shown as its own line before you pay.
              </p>
            )}
            {rule ? (
              <div className="mt-5">
                <FilingCtaLink href={`/find?state=PA&entity=${rule.entityType}`} stateCode="PA" entityType={rule.entityType} className="w-full">
                  Have us file it
                </FilingCtaLink>
              </div>
            ) : null}
          </Receipt>
        </div>
      </Section>

      {/* 7. Questions + a person to talk to */}
      <Section labelledBy="faq-title">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-20">
          <div className="grid content-start gap-6">
            <SectionHeading id="faq-title" title="Questions, answered plainly." />
            <div className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-4">
              <Photo photo="designerOnPhone" sizes="22rem" className="aspect-[16/9]" rounded focus="55% 30%" decorative />
              <div className="grid gap-1 px-1">
                <p className="font-display text-lg font-semibold text-fg">Rather ask a person?</p>
                <p className="text-[15px] leading-6 text-muted">Someone on our team reads every message and writes back.</p>
              </div>
              <Link href="/help" className={`${textLinkClasses} inline-flex min-h-11 items-center gap-2 px-1`}>
                <ChatCircleText size={18} weight="bold" aria-hidden />
                Get help
              </Link>
            </div>
          </div>
          <FaqList items={faq} />
        </div>
      </Section>

      {/* 8. Final call to action */}
      <section aria-labelledby="cta-title" className="px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[28px] bg-accent lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-2 grid content-center gap-6 px-6 py-12 sm:px-12 sm:py-16 lg:order-1 lg:px-16 lg:py-20">
            <h2 id="cta-title" className="max-w-[16ch] text-[32px] font-semibold leading-[1.08] text-accent-fg sm:text-[46px]">
              Find out what your business needs to file.
            </h2>
            <p className="max-w-[40ch] text-[17px] leading-relaxed text-accent-fg/80 sm:text-lg">
              It takes about a minute, and you don&apos;t need an account to see the answer.
            </p>
            <ButtonLink href="/find" size="lg" variant="inverse" className="justify-self-start">
              Find my business
              <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
          </div>
          <Photo
            photo="relaxedDesk"
            rounded={false}
            sizes="(min-width: 1024px) 640px, 100vw"
            className="order-1 aspect-[16/10] lg:order-2 lg:aspect-auto lg:min-h-[26rem]"
            focus="50% 30%"
            decorative
          />
        </div>
        <DisclaimerNote className="mx-auto mt-6 max-w-7xl" stateName="Pennsylvania" />
      </section>
    </>
  );
}

/** One of the two services in the hero: what it is, what it costs, and where to start. */
function ServiceChoice({ title, price, body, href, cta }: { title: string; price: string; body: string; href: string; cta: string }) {
  return (
    <li>
      <Link
        href={href}
        className="group grid h-full content-start gap-1.5 rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-card transition-[border-color,box-shadow] hover:border-accent/40 sm:p-5"
      >
        <span className="text-[17px] font-semibold text-fg">{title}</span>
        <span className="text-[15px] font-medium text-fg">{price}</span>
        <span className="text-sm leading-6 text-muted">{body}</span>
        <span className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
          {cta}
          <ArrowRight size={16} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}
