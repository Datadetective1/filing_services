import { FileText, Lightbulb, Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatLongDate } from "@/lib/domain/dates";
import { LEGAL_LAST_UPDATED, LEGAL_PAGES } from "@/lib/seo/legal";
import { cn } from "@/components/ui/cn";
import { Container } from "@/components/ui/surface";
import { Breadcrumbs } from "./breadcrumbs";
import { LegalToc } from "./legal-toc";

/** Typography for long legal drafts: a comfortable measure, darker body text, clear section breaks. */
const legalProse = cn(
  "max-w-[70ch] text-[16px] leading-[1.75] text-fg/85 sm:text-[17px] sm:leading-[1.8]",
  "[&>*:first-child]:mt-0",
  "[&_h2]:mt-14 [&_h2]:scroll-mt-24 [&_h2]:border-t [&_h2]:border-border [&_h2]:pt-10 [&_h2]:font-display [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:text-fg sm:[&_h2]:text-[26px]",
  "[&>h2:first-child]:border-t-0 [&>h2:first-child]:pt-0",
  "[&_h3]:mt-8 [&_h3]:font-display [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:text-fg",
  "[&_p]:mt-4",
  "[&_ul]:mt-4 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-2.5 [&_ul]:pl-6 [&_ol]:mt-4 [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-2.5 [&_ol]:pl-6",
  "[&_li]:pl-1.5 [&_li]:marker:text-accent",
  "[&_strong]:font-semibold [&_strong]:text-fg",
  "[&_a]:font-semibold [&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/30 [&_a]:decoration-2 [&_a]:underline-offset-4 [&_a:hover]:decoration-accent",
);

/** Shared frame for legal drafts: title, draft notice, last-updated date, sections and sibling links. */
export function LegalPage({
  title,
  summary,
  path,
  children,
}: {
  title: string;
  summary: ReactNode;
  path: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="grain border-b border-border bg-surface-2">
        <Container className="grid gap-5 pb-10 pt-6 sm:pb-14 sm:pt-10">
          <Breadcrumbs
            items={[
              { name: "Home", path: "/" },
              { name: title, path },
            ]}
          />
          <div className="flex items-start gap-4">
            <span aria-hidden className="mt-1.5 grid size-12 shrink-0 place-items-center rounded-[12px] bg-surface text-accent shadow-card max-sm:hidden">
              <FileText size={24} weight="duotone" />
            </span>
            <div className="grid gap-2">
              <h1 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] text-fg sm:text-[52px]">{title}</h1>
              <p className="tnum text-sm text-muted">Last updated {formatLongDate(LEGAL_LAST_UPDATED)}</p>
            </div>
          </div>

          <div
            role="note"
            className="flex max-w-[70ch] gap-3 rounded-[var(--radius-surface)] border border-warning/30 bg-warning-soft px-4 py-3.5 text-sm"
          >
            <Warning size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="font-semibold text-fg">Draft for legal review</p>
              <p className="mt-0.5 leading-6 text-muted">
                This document is a working draft pending attorney review. It has not yet been reviewed by an attorney and may
                be updated.
              </p>
            </div>
          </div>
        </Container>
      </div>

      <Container className="grid grid-cols-1 gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
        <article className="grid min-w-0 content-start gap-8">
          <div className="flex max-w-[70ch] gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-6">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg max-sm:hidden">
              <Lightbulb size={20} weight="duotone" />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-subtle">Summary</p>
              <div className="mt-1.5 text-[17px] leading-[1.7] text-fg sm:text-lg">{summary}</div>
            </div>
          </div>
          <LegalToc containerId="legal-body" variant="inline" />
          <div id="legal-body" className={legalProse}>
            {children}
          </div>
        </article>

        <aside className="max-lg:border-t max-lg:border-border max-lg:pt-8">
          <div className="grid gap-8 lg:sticky lg:top-[92px] lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pb-4">
            <nav aria-label="Legal documents" className="grid gap-0.5 text-[14px]">
              <p className="mb-1.5 px-3 text-[12px] font-semibold uppercase tracking-wider text-subtle">Legal</p>
              {LEGAL_PAGES.map((p) => (
                <Link
                  key={p.path}
                  href={p.path}
                  aria-current={p.path === path ? "page" : undefined}
                  className="flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-muted transition-colors hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent-soft-fg"
                >
                  {p.title}
                </Link>
              ))}
            </nav>
            <div className="max-lg:hidden">
              <LegalToc containerId="legal-body" variant="aside" />
            </div>
          </div>
        </aside>
      </Container>
    </>
  );
}
