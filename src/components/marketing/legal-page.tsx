import { Warning } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatLongDate } from "@/lib/domain/dates";
import { LEGAL_LAST_UPDATED, LEGAL_PAGES } from "@/lib/seo/legal";
import { Container } from "@/components/ui/surface";
import { Breadcrumbs } from "./breadcrumbs";
import { Prose } from "./section";

/** Shared frame for legal drafts: title, draft notice, last-updated date and sibling links. */
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
    <Container className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-16">
      <article className="min-w-0">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: title, path },
          ]}
        />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-fg sm:text-[40px] sm:leading-tight">{title}</h1>
        <p className="tnum mt-3 text-sm text-muted">Last updated {formatLongDate(LEGAL_LAST_UPDATED)}</p>

        <div
          role="note"
          className="mt-6 flex max-w-[68ch] gap-3 rounded-[var(--radius-surface)] border border-warning/30 bg-warning-soft px-4 py-3.5 text-sm"
        >
          <Warning size={18} weight="bold" aria-hidden className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-fg">Draft for legal review</p>
            <p className="mt-0.5 text-muted">
              This document is a working draft. It has not yet been reviewed by an attorney and may change before
              launch. Bracketed text marks details still to be confirmed.
            </p>
          </div>
        </div>

        <div className="mt-8 max-w-[68ch] text-base leading-7 text-fg sm:text-[17px]">{summary}</div>
        <Prose className="mt-10">{children}</Prose>
      </article>

      <aside className="lg:pt-24">
        <nav aria-label="Legal documents" className="grid gap-1 text-sm lg:sticky lg:top-8">
          <p className="mb-2 font-medium text-fg">Legal</p>
          {LEGAL_PAGES.map((p) => (
            <Link
              key={p.path}
              href={p.path}
              aria-current={p.path === path ? "page" : undefined}
              className="flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-muted hover:bg-surface-2 hover:text-fg aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium aria-[current=page]:text-fg"
            >
              {p.title}
            </Link>
          ))}
        </nav>
      </aside>
    </Container>
  );
}
