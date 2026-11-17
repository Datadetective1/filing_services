import { ArrowRight, CheckCircle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { DisclaimerNote } from "@/components/marketing/disclaimer";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { PhotoHero } from "@/components/marketing/photo-hero";
import { StateGrid } from "@/components/marketing/state-grid";
import { ButtonLink, textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import type { FaqItem } from "@/lib/compliance/types";
import { formatCents } from "@/lib/domain/money";
import { annualReportServiceJsonLd, breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { serviceFeeText } from "@/lib/services/fee-text";
import { annualReportPlaces } from "@/lib/services/state-services";

/** Our fee tiers, lowest first: [{ serviceCents: 4900, states: 6 }, { serviceCents: 9900, states: 27 }]. */
function feeTiers(places: { serviceCents: number }[]): { serviceCents: number; states: number }[] {
  const by = new Map<number, number>();
  for (const p of places) by.set(p.serviceCents, (by.get(p.serviceCents) ?? 0) + 1);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([serviceCents, states]) => ({ serviceCents, states }));
}

/** "$49 plus the state fee in 6 states and $99 plus the state fee in 27 more". */
function tiersSentence(tiers: { serviceCents: number; states: number }[]): string {
  return tiers
    .map((t, i) => `${money(t.serviceCents)} plus the state fee in ${t.states}${i > 0 ? " more" : ""} ${t.states === 1 ? "state" : "states"}`)
    .join(tiers.length === 2 ? " and " : ", ");
}

export async function generateMetadata(): Promise<Metadata> {
  const places = await annualReportPlaces().catch(() => []);
  const fee = serviceFeeText(places);
  return pageMetadata({
    title: fee ? `Annual Report Filing Service: ${fee.lowest} Plus the State Fee` : "Annual Report Filing Service",
    description: fee
      ? `We file your LLC or corporation's annual report for ${tiersSentence(feeTiers(places))}. A person checks every filing, and the state fee is passed through at cost.`
      : "We file your LLC or corporation's annual report with the state. A person checks every filing, and the state fee is passed through at cost.",
    path: "/annual-report",
  });
}

// Prices and state switches can change: rebuild at most hourly, like the state pages.
export const revalidate = 3600;

const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Annual reports", path: "/annual-report" },
];

const money = (c: number) => formatCents(c, { trimZeros: true });

function buildFaq(fee: string | null): FaqItem[] {
  return [
    {
      q: "What does the price include?",
      a: `We prepare your report, file it with the state, pay the state's fee for you and keep the state's confirmation in your dashboard. A person on our team checks every filing before it goes in.${
        fee ? ` Our fee is ${fee}, depending on the state, and you see it before you pay.` : ""
      }`,
    },
    {
      q: 'What does "plus the state fee" mean?',
      a: "Each state charges its own fee for the report. We pay it to the state for you at cost, with no markup, and show it as its own line next to our fee before you pay.",
    },
    {
      q: "Do I need to know my state's rules?",
      a: "No. We check each state's fees and requirements against its official sources before we open it. You pick your state, find your business and answer a few questions.",
    },
    {
      q: "Will you remind me next year?",
      a: "Yes, in the states where we track the due date. We email you before the next report is due, and you can turn reminders off in your settings.",
    },
    {
      q: "How long does it take?",
      a: "Your part is short: check your details and sign. Then a person on our team reviews it and files it with the state. Approval time depends on the state, and we email you when it's filed and when it's approved.",
    },
    {
      q: "Do I need to send any paperwork?",
      a: "No. Everything happens online. Where the state's business register allows it, we fill in your details from it, and you check them before anything is filed.",
    },
    {
      q: "What if I've missed the due date?",
      a: "Many states still accept a late report, some with a late fee. File it as soon as you can, and ask us if you're not sure what your state charges.",
    },
    {
      q: `Is ${site.name} part of the government?`,
      a: `No. ${site.name} is a private company that prepares and submits filings for businesses. We are not affiliated with or endorsed by any government agency.`,
    },
  ];
}

/** The hero's object: the offer itself, drawn as a receipt with the one number that matters. */
function PricePanel({ lowest, count }: { lowest: string | null; count: number }) {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-border bg-surface px-5 pb-5 pt-6 shadow-lift sm:px-6">
      <span
        aria-hidden
        className="absolute right-0 top-0 size-9 rounded-bl-[8px] bg-[linear-gradient(225deg,var(--bg)_50%,var(--surface-3)_50%)] shadow-[-1px_1px_2px_rgb(23_35_29/0.08)]"
      />
      <p className="font-mono text-[11px] uppercase tracking-wider text-subtle">Annual report, filed for you</p>
      {lowest ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 border-b-2 border-fg/80 pb-3 pr-8">
          <span className="text-sm text-muted">From</span>
          <span className="tnum font-display text-[44px] font-semibold leading-none tracking-tight text-fg">{lowest}</span>
          <span className="text-sm text-muted">+ state fee</span>
        </p>
      ) : (
        <p className="mt-1 border-b-2 border-fg/80 pb-3 pr-8 font-display text-lg font-semibold leading-snug text-fg">
          What we do for you
        </p>
      )}
      <ul className="grid">
        {["We prepare and file it", "We pay the state for you, at cost", "You keep the state's confirmation"].map((item) => (
          <li key={item} className="flex items-center gap-3 border-b border-dashed border-border py-3 text-[15px] text-fg last:border-b-0">
            <CheckCircle size={18} weight="fill" aria-hidden className="shrink-0 text-accent" />
            {item}
          </li>
        ))}
      </ul>
      {count > 0 ? <p className="mt-2 text-[13px] leading-5 text-muted">Open in {count} states today.</p> : null}
    </div>
  );
}

export default async function AnnualReportHubPage() {
  const places = await annualReportPlaces();
  const fee = serviceFeeText(places);
  const faq = buildFaq(fee?.all ?? null);
  const filedCodes = new Set(places.map((p) => p.code));
  const tiers = feeTiers(places);

  return (
    <>
      <JsonLd
        data={graph(
          breadcrumbJsonLd(CRUMBS),
          ...(tiers.length
            ? [
                annualReportServiceJsonLd({
                  path: "/annual-report",
                  tiers,
                  description:
                    "We prepare and file a business's state annual report, pay the state's fee at cost and keep the state's confirmation in the customer's dashboard. A person checks every filing before it is submitted.",
                }),
              ]
            : []),
          faqJsonLd(faq),
        )}
      />

      <PhotoHero
        id="hub-title"
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title={
          <>
            Annual report filing <span className="mark-highlight">service</span>
          </>
        }
        lede={
          <p>
            {tiers.length ? (
              <>
                <strong className="font-semibold text-fg">We file your LLC or corporation&apos;s annual report for {tiersSentence(tiers)}.</strong>{" "}
              </>
            ) : null}
            A person checks it, we pay the state&apos;s fee at cost, and you get the state&apos;s confirmation. Your part takes a few minutes.
          </p>
        }
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={places.length > 0 ? "#choose-state" : "/find"} size="lg">
              {places.length > 0 ? "Choose your state" : "Find my business"}
              <ArrowRight size={18} weight="bold" aria-hidden />
            </ButtonLink>
            {places.length > 0 ? (
              <ButtonLink href="/find" size="lg" variant="secondary">
                Find my business
              </ButtonLink>
            ) : null}
          </div>
        }
        photo="reliefDocument"
        focus="45% 35%"
        focusWide="4% 35%"
        panel={<PricePanel lowest={fee?.lowest ?? null} count={places.length} />}
      />

      {places.length > 0 ? (
        <section
          id="choose-state"
          aria-labelledby="choose-state-title"
          className="relative scroll-mt-20 overflow-hidden bg-ink py-14 text-ink-fg sm:py-20"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_0%,rgb(242_178_58/0.16),transparent_60%),radial-gradient(50rem_30rem_at_0%_100%,rgb(31_90_67/0.55),transparent_60%)]"
          />
          <Container className="relative grid gap-8">
            <div className="grid max-w-2xl gap-3">
              <h2 id="choose-state-title" className="text-[30px] font-semibold leading-[1.08] sm:text-[44px]">
                Choose your state.
              </h2>
              <p className="text-[17px] leading-relaxed text-ink-muted">
                Each price is the full total for one report, the state&apos;s fee included.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-3 [perspective:900px] sm:grid-cols-3 lg:grid-cols-4" aria-label="States where we file annual reports">
              {places.map((p) => (
                <li key={p.code}>
                  <Link
                    href={`/services/${p.slug}#annual-report`}
                    prefetch={false}
                    className="group flex min-h-[76px] items-center justify-between gap-3 rounded-[var(--radius-surface)] border border-white/12 bg-white/[0.06] px-4 py-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-sm transition-[transform,background-color,border-color,box-shadow] duration-200 hover:border-highlight/60 hover:bg-white/[0.1] hover:shadow-[0_18px_40px_-18px_rgb(242_178_58/0.55)] motion-safe:hover:[transform:translateY(-4px)_rotateX(8deg)]"
                  >
                    <span className="grid min-w-0">
                      <span className="truncate text-[16px] font-semibold sm:text-[17px]">{p.name}</span>
                      <span className="tnum text-[13px] text-ink-muted">from {money(p.fromCents)}</span>
                    </span>
                    <span
                      aria-hidden
                      className="grid size-8 shrink-0 place-items-center rounded-full bg-highlight text-highlight-fg transition-transform group-hover:translate-x-0.5"
                    >
                      <ArrowRight size={15} weight="bold" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="flex items-start gap-2 text-[15px] text-ink-muted">
              <ShieldCheck size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-highlight" />
              A person checks every filing before it goes to the state.
            </p>
          </Container>
        </section>
      ) : null}

      <section aria-labelledby="faq-title" className="py-14 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div className="grid content-start gap-3">
            <h2 id="faq-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              Questions, answered.
            </h2>
            <p className="text-[17px] leading-relaxed text-muted">
              Still unsure?{" "}
              <Link href="/help" className={textLinkClasses}>
                Ask a person
              </Link>
            </p>
          </div>
          <FaqList items={faq} />
        </Container>
      </section>

      <section aria-labelledby="states-title" className="grain scroll-mt-20 bg-surface-2 py-14 sm:py-20">
        <Container className="grid gap-8">
          <div className="grid max-w-2xl gap-3">
            <h2 id="states-title" className="scroll-mt-24 text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              Due dates and fees by state
            </h2>
            <p className="text-[17px] leading-relaxed text-muted">
              Open a state to see what its annual report needs and when it&apos;s due.
            </p>
          </div>
          <StateGrid basePath="/annual-report" filedCodes={filedCodes} />
          <DisclaimerNote />
        </Container>
      </section>
    </>
  );
}
