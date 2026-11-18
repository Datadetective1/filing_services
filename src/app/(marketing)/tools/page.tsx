import { ArrowRight, BellRinging, BookOpenText, CalendarDots, MagnifyingGlass, Scales, Seal, Stack } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { JsonLd } from "@/components/marketing/json-ld";
import { PageIntro, Section } from "@/components/marketing/section";
import { site } from "@/config/site";
import { businessServicesPagesEnabled } from "@/lib/registered-agent/sales";
import { businessSearchStates } from "@/lib/seo/business-search";
import { breadcrumbJsonLd, graph } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/config/site";

const PATH = "/tools";
const CRUMBS = [
  { name: "Home", path: "/" },
  { name: "Free tools", path: PATH },
];

export const metadata: Metadata = pageMetadata({
  title: "Free Tools for Small Business Filings: Search, Deadlines, Reminders",
  description: `Free tools from ${site.name}: search official business registers, look up annual report due dates and fees, get deadline reminders, and add a deadline badge to your site.`,
  path: PATH,
  absoluteTitle: true,
});

interface Tool {
  href: string;
  title: string;
  body: string;
  icon: ReactNode;
}

export default function ToolsPage() {
  const services = businessServicesPagesEnabled();
  const searchStates = businessSearchStates();
  const tools: Tool[] = [
    {
      href: "/business-search",
      title: "Business search",
      body: `Search the official business register in ${searchStates.length} states and see a business's status and filings due.`,
      icon: <MagnifyingGlass size={26} weight="duotone" />,
    },
    {
      href: "/find",
      title: "What does my business owe?",
      body: "Find your business and see its next annual report due date and the state's fee, with the source.",
      icon: <Seal size={26} weight="duotone" />,
    },
    {
      href: "/annual-report/due-dates",
      title: "Annual report due dates",
      body: "Every checked state's due date and fee on one page, laid out month by month.",
      icon: <CalendarDots size={26} weight="duotone" />,
    },
    {
      href: "/find",
      title: "Free deadline reminders",
      body: "We email you before your report is due. No account, stop any time. Add the date to your calendar too.",
      icon: <BellRinging size={26} weight="duotone" />,
    },
    {
      href: "/tools/deadline-badge",
      title: "Deadline badge for your site",
      body: "For accountants, bookkeepers and business blogs: show your state's due date with one line of code.",
      icon: <Stack size={26} weight="duotone" />,
    },
    ...(services
      ? [
          {
            href: "/compare",
            title: "Compare filing services",
            body: "Prices for annual report and registered agent service side by side, read on each company's own site.",
            icon: <Scales size={26} weight="duotone" />,
          },
        ]
      : []),
    {
      href: "/glossary",
      title: "Filing glossary",
      body: "Annual report, registered agent, good standing and more, explained in plain English.",
      icon: <BookOpenText size={26} weight="duotone" />,
    },
  ];

  const itemList = {
    "@type": "ItemList",
    name: `Free tools from ${site.name}`,
    itemListElement: tools.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.title, url: absoluteUrl(t.href) })),
  };

  return (
    <>
      <JsonLd data={graph(itemList, breadcrumbJsonLd(CRUMBS))} />
      <PageIntro
        breadcrumbs={<Breadcrumbs items={CRUMBS} />}
        title={
          <>
            Free tools. <span className="mark-highlight">No account.</span>
          </>
        }
        lede={<p>Look up a business, check what&apos;s due and when, and get a reminder before the deadline. All free.</p>}
      />
      <Section>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 [perspective:1400px]">
          {tools.map((t) => (
            <li key={t.title}>
              <Link
                href={t.href}
                prefetch={false}
                className="group relative grid h-full content-start gap-4 overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-300 [transform-style:preserve-3d] hover:shadow-lift hover:[transform:rotateX(3deg)_rotateY(-3deg)_translateZ(10px)]"
              >
                <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 size-32 rounded-full bg-highlight/15 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
                <span aria-hidden className="grid size-12 place-items-center rounded-[12px] bg-accent text-accent-fg shadow-[0_14px_24px_-12px_rgb(31_90_67/0.9)] [transform:translateZ(20px)]">
                  {t.icon}
                </span>
                <span className="font-display text-xl font-semibold text-fg">{t.title}</span>
                <span className="text-[15px] leading-6 text-muted">{t.body}</span>
                <span className="mt-auto inline-flex items-center gap-1.5 text-[15px] font-semibold text-accent">
                  Open
                  <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
