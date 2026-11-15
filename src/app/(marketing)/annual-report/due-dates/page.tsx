import { ArrowRight, BellRinging, HandPalm, LockKey, Repeat } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { FaqList } from "@/components/marketing/faq";
import { JsonLd } from "@/components/marketing/json-ld";
import { cn } from "@/components/ui/cn";
import { Container } from "@/components/ui/surface";
import type { FaqItem } from "@/lib/compliance/types";
import { formatCents } from "@/lib/domain/money";
import { dueDateRows, monthBuckets, RESEARCHED_ON, type DueDateRow } from "@/lib/seo/due-dates";
import { breadcrumbJsonLd, faqJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { annualReportPlaces } from "@/lib/services/state-services";

// Prices can change: rebuild at most hourly, like the annual report hub.
export const revalidate = 3600;

const PATH = "/annual-report/due-dates";
const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Annual reports", path: "/annual-report" },
  { name: "Due dates", path: PATH },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function generateMetadata(): Metadata {
  const n = dueDateRows().length;
  return pageMetadata({
    title: "Annual Report Due Dates by State: Deadlines and State Fees",
    description: `When the annual report is due in ${n} states, what each state charges, and what it costs to have it filed for you. Free reminders, no account needed.`,
    path: PATH,
    absoluteTitle: true,
  });
}

function researchedLabel(): string {
  return new Date(`${RESEARCHED_ON}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

const FAQ: FaqItem[] = [
  {
    q: "What happens if I miss the due date?",
    a: "Most states add a late fee, and after a while a state can mark the business as not in good standing or dissolve it. File as soon as you can.",
  },
  {
    q: "Why does my state say it depends on my formation date?",
    a: "Some states set each business's due date by the month it was formed or registered. Find your business and we work out the exact date for you.",
  },
  {
    q: "Can you remind me before it's due?",
    a: "Yes, for free. Add your business and we email you ahead of the date. No account needed, and you can stop the reminders any time.",
  },
];

/** The year as twelve columns, each state with a fixed due date lit in its month. */
function YearStrip({ rows }: { rows: DueDateRow[] }) {
  const buckets = monthBuckets(rows);
  const now = new Date().getUTCMonth() + 1;
  return (
    <figure className="grid gap-3">
      <figcaption className="sr-only">States with a fixed annual report due date, by month</figcaption>
      <ol className="grid grid-cols-6 gap-1.5 [perspective:1000px] sm:grid-cols-12">
        {buckets.map((b) => (
          <li
            key={b.month}
            className={cn(
              "flex min-h-[132px] flex-col gap-1.5 rounded-[10px] border p-1.5 [transform-style:preserve-3d] sm:min-h-[200px]",
              b.month === now ? "border-highlight/70 bg-highlight/10 shadow-[0_0_30px_-8px_rgb(242_178_58/0.6)]" : "border-white/12 bg-white/[0.05]",
            )}
          >
            <span className={cn("text-center font-mono text-[11px] uppercase tracking-wider", b.month === now ? "text-highlight" : "text-ink-muted")}>
              {MONTHS[b.month - 1]}
            </span>
            {b.codes.map((c) => (
              <span
                key={c}
                className="grid place-items-center rounded-[6px] bg-accent py-1 font-display text-[11px] font-bold leading-none text-accent-fg shadow-[0_10px_18px_-10px_rgb(31_90_67/0.9)] [transform:translateZ(10px)] sm:text-[12px]"
              >
                {c}
              </span>
            ))}
          </li>
        ))}
      </ol>
    </figure>
  );
}

function Pledge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2 text-[14px] text-ink-muted">
      <span className="text-highlight">{icon}</span>
      {text}
    </li>
  );
}

export default async function DueDatesPage() {
  const rows = dueDateRows();
  const places = await annualReportPlaces();
  const price = new Map(places.map((p) => [p.code, p.fromCents]));
  const anniversary = rows.filter((r) => r.anniversary);

  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(CRUMBS), faqJsonLd(FAQ))} />

      <section aria-labelledby="due-title" className="relative overflow-hidden bg-ink text-ink-fg">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_85%_0%,rgb(242_178_58/0.14),transparent_60%),radial-gradient(50rem_30rem_at_0%_100%,rgb(31_90_67/0.55),transparent_60%)]"
        />
        <Container className="relative grid gap-8 pb-14 pt-8 sm:pt-12 lg:pb-20">
          <div className="grid max-w-3xl gap-4 [&_a]:text-ink-fg">
            <Breadcrumbs items={CRUMBS} />
            <h1 id="due-title" className="text-[36px] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-[52px]">
              Annual report <span className="text-highlight">due dates</span>, by state
            </h1>
            <p className="max-w-[52ch] text-[17px] leading-relaxed text-ink-muted sm:text-lg">
              When it&apos;s due in {rows.length} states, what the state charges, and what it costs to have us file it.
            </p>
          </div>
          <YearStrip rows={rows} />
          {anniversary.length > 0 ? (
            <p className="flex flex-wrap items-center gap-1.5 text-[14px] text-ink-muted">
              <span className="mr-1">Due on your formation anniversary:</span>
              {anniversary.map((r) => (
                <span key={r.code} className="rounded-[6px] border border-white/15 px-1.5 py-0.5 font-display text-[12px] font-bold text-ink-fg">
                  {r.code}
                </span>
              ))}
            </p>
          ) : null}
          <ul className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Our promises">
            <Pledge icon={<Repeat size={16} weight="bold" aria-hidden />} text="Same price at renewal" />
            <Pledge icon={<LockKey size={16} weight="bold" aria-hidden />} text="We never sell your data" />
            <Pledge icon={<HandPalm size={16} weight="bold" aria-hidden />} text="No sales calls" />
            <Pledge icon={<BellRinging size={16} weight="bold" aria-hidden />} text="Free reminders" />
          </ul>
        </Container>
      </section>

      <section aria-labelledby="list-title" className="py-14 sm:py-20">
        <Container className="grid gap-6">
          <h2 id="list-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
            Every state we track
          </h2>
          <ul className="grid gap-2">
            <li aria-hidden className="hidden grid-cols-[1.1fr_1.6fr_1fr_1fr] gap-4 px-5 text-sm font-semibold text-subtle lg:grid">
              <span>State</span>
              <span>Due</span>
              <span>State fee</span>
              <span>Filed for you</span>
            </li>
            {rows.map((r) => {
              const total = price.get(r.code);
              return (
                <li
                  key={r.code}
                  className="grid gap-2 rounded-[var(--radius-surface)] border border-border bg-surface p-4 shadow-card sm:p-5 lg:grid-cols-[1.1fr_1.6fr_1fr_1fr] lg:items-center lg:gap-4"
                >
                  <span className="grid">
                    <span className="text-[17px] font-semibold text-fg">{r.name}</span>
                    <span className="text-[13px] text-subtle">
                      {r.reportName}
                      {r.source === "researched" ? " · not verified" : ""}
                    </span>
                  </span>
                  <span className="text-[15px] leading-6 text-fg">{r.when}</span>
                  <span className="text-[15px] text-muted">
                    <span className="text-subtle lg:hidden">State fee: </span>
                    {r.stateFee}
                  </span>
                  {total !== undefined ? (
                    <Link
                      href={`/services/${r.slug}#annual-report`}
                      prefetch={false}
                      className="group inline-flex w-fit items-center gap-2 text-[15px] font-semibold text-accent"
                    >
                      From {formatCents(total, { trimZeros: true })} total
                      <ArrowRight size={15} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  ) : (
                    <Link href={`/annual-report/${r.slug}`} prefetch={false} className="group inline-flex w-fit items-center gap-2 text-[15px] font-semibold text-accent">
                      Free reminder
                      <ArrowRight size={15} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="max-w-[72ch] text-[13px] leading-6 text-subtle">
            Rows marked not verified come from each state&apos;s filing office website, read on {researchedLabel()}, and haven&apos;t been through our
            full check yet. A state can change its date or fee. Totals include the state fee. Not legal advice.
          </p>
        </Container>
      </section>

      <section aria-labelledby="faq-title" className="grain bg-surface-2 py-14 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
          <div className="grid content-start gap-4">
            <h2 id="faq-title" className="text-[30px] font-semibold leading-[1.08] text-fg sm:text-[40px]">
              Questions
            </h2>
            <Link href="/find" className="inline-flex w-fit items-center gap-2 text-[15px] font-semibold text-accent">
              Find my business and its exact date
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          </div>
          <FaqList items={FAQ} />
        </Container>
      </section>
    </>
  );
}
