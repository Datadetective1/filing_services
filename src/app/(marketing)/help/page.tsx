import { ArrowRight, ArrowUpRight, ChatCircleText, EnvelopeSimple, Warning } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { Photo } from "@/components/media/photo";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { Section } from "@/components/marketing/section";
import { textLinkClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/surface";
import { PA_URLS } from "@/lib/compliance/states/pennsylvania";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Help and support",
  description: `Talk to a person at ${site.name}. Ask about a filing you've ordered, a deadline or a charge, and get an answer by email.`,
  path: "/help",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Help", path: "/help" },
];

const rowClass = "grid gap-4 py-8 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,15rem)] md:items-center md:gap-10";
const rowTitle = "flex items-center gap-3 font-display text-xl font-semibold text-fg";
const rowLink = `${textLinkClasses} inline-flex min-h-11 items-center gap-1.5 md:justify-self-end`;

export default function HelpPage() {
  return (
    <>
      <JsonLd data={graph(breadcrumbJsonLd(crumbs))} />
      <section aria-labelledby="help-title">
        <Container className="grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <div className="grid content-start gap-6">
            <Breadcrumbs items={crumbs} />
            <h1 id="help-title" className="text-[40px] font-semibold leading-[1.04] text-fg sm:text-[56px]">
              Talk to a person.
            </h1>
            <p className="max-w-[44ch] text-lg leading-relaxed text-muted">
              Questions about a filing, a deadline or a charge? Someone on our team reads every message and writes back by
              email.
            </p>
          </div>
          <Photo photo="designerOnPhone" priority className="aspect-[16/10]" sizes="(min-width: 1024px) 45vw, 100vw" />
        </Container>
      </section>

      <Section labelledBy="paths-title" className="pt-4 sm:pt-6">
        <h2 id="paths-title" className="sr-only">
          Ways to reach us
        </h2>
        <ul className="grid divide-y divide-border border-y border-border">
          <li className={rowClass}>
            <p className={rowTitle}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <ChatCircleText size={20} weight="fill" aria-hidden />
              </span>
              About a filing you ordered
            </p>
            <p className="max-w-[56ch] text-base leading-7 text-muted">
              Open the filing in your dashboard and send a message. It goes straight to the person preparing it, and the
              whole conversation stays with the filing.
            </p>
            <Link href="/dashboard" className={rowLink}>
              Go to your dashboard
              <ArrowRight size={16} weight="bold" aria-hidden />
            </Link>
          </li>
          <li className={rowClass}>
            <p className={rowTitle}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
                <EnvelopeSimple size={20} weight="fill" aria-hidden />
              </span>
              Anything else
            </p>
            <p className="max-w-[56ch] text-base leading-7 text-muted">
              Not sure what your business needs, have a billing question, or want to tell us something? Email us. Please
              don&apos;t send passwords, Social Security numbers or card numbers.
            </p>
            <a href={`mailto:${site.supportEmail}`} className={`${rowLink} break-all`}>
              {site.supportEmail}
            </a>
          </li>
          <li className={rowClass}>
            <p className={rowTitle}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-fg">
                <ArrowUpRight size={20} weight="bold" aria-hidden />
              </span>
              Filing directly with the state
            </p>
            <p className="max-w-[56ch] text-base leading-7 text-muted">
              You can always file yourself. Pennsylvania&apos;s online filing system is run by the Department of State.
            </p>
            <a href={PA_URLS.onlineFiling} target="_blank" rel="noopener noreferrer" className={rowLink}>
              file.dos.pa.gov
              <span className="sr-only"> (opens the government website in a new tab)</span>
            </a>
          </li>
        </ul>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="grid content-start gap-4">
            <h2 className="text-2xl font-semibold text-fg">Quick answers</h2>
            <ul className="grid gap-3 text-base">
              <li>
                <Link className={textLinkClasses} href="/annual-report/pennsylvania">
                  Pennsylvania annual report: deadlines, fees and questions
                </Link>
              </li>
              <li>
                <Link className={textLinkClasses} href="/pricing">
                  What we charge, line by line
                </Link>
              </li>
              <li>
                <Link className={textLinkClasses} href="/legal/refunds">
                  Refund policy
                </Link>
              </li>
              <li>
                <Link className={textLinkClasses} href="/dashboard/settings">
                  Turn reminders on or off
                </Link>
              </li>
            </ul>
          </div>
          <div className="flex gap-4 rounded-[var(--radius-surface)] border border-warning/25 bg-warning-soft p-5">
            <Warning size={22} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-warning" />
            <div className="grid gap-2">
              <p className="font-display text-lg font-semibold text-fg">Watch out for look-alike notices</p>
              <p className="text-[15px] leading-6 text-fg/80">
                {site.disclaimer} We never ask for your password to the state&apos;s filing system. The Department of State
                publishes warnings about misleading filing offers.
              </p>
              <a
                href={PA_URLS.dosScamAlerts}
                target="_blank"
                rel="noopener noreferrer"
                className={`${textLinkClasses} inline-flex min-h-11 items-center gap-1.5 justify-self-start`}
              >
                Read the state&apos;s scam alerts
                <ArrowUpRight size={14} weight="bold" aria-hidden />
                <span className="sr-only"> (opens the government website in a new tab)</span>
              </a>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
