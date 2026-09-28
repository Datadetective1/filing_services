import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";
import { opsButton } from "./button-classes";

/**
 * Dense building blocks for the operations console: tiles, sections, key/value
 * rows, pagination and JSON disclosure.
 */

type Tone = "neutral" | "warning" | "danger" | "success";

const toneValue: Record<Tone, string> = {
  neutral: "text-fg",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-accent",
};

/** A metric that links to the queue or page where the operator acts on it. */
export function MetricTile({
  label,
  value,
  href,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  href: string;
  hint?: ReactNode;
  tone?: Tone;
}) {
  return (
    <Link
      href={href}
      className="group grid min-h-[5.75rem] content-between gap-2 bg-surface px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:relative focus-visible:z-10"
    >
      <span className="flex items-start justify-between gap-2 text-sm text-muted">
        {label}
        <CaretRight size={14} weight="bold" className="mt-1 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className={cn("tnum text-2xl font-semibold leading-none tracking-tight", toneValue[tone])}>{value}</span>
      {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </Link>
  );
}

/** Grid wrapper that draws 1px dividers between tiles. */
export function TileGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-surface)] border border-border bg-border min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A titled panel. */
export function Panel({
  title,
  id,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  id?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-6 rounded-[var(--radius-surface)] border border-border bg-surface", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="grid gap-0.5">
          <h2 id={headingId} className="text-[15px] font-semibold tracking-tight text-fg">
            {title}
          </h2>
          {description ? <p className="text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn("px-4 py-3", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Compact term / value rows. */
export function KeyValues({ items, className }: { items: { term: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(8rem,12rem)_1fr]", className)}>
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-muted">{item.term}</dt>
          <dd className="min-w-0 break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Muted placeholder for an empty table or list. */
export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="py-2 text-sm text-muted">{children}</p>;
}

export function buildHref(basePath: string, params: Record<string, string | undefined>, overrides: Record<string, string | undefined> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...overrides })) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Previous / next links that preserve the current filters. */
export function Pagination({
  basePath,
  params,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = opsButton("secondary", "px-3");
  const disabledCls = cn(linkCls, "pointer-events-none opacity-40");
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <p className="tnum">
        {from}-{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={linkCls} href={buildHref(basePath, params, { page: page === 2 ? undefined : String(page - 1) })}>
            <CaretLeft size={14} weight="bold" aria-hidden />
            Previous
          </Link>
        ) : (
          <span className={disabledCls} aria-disabled="true">
            <CaretLeft size={14} weight="bold" aria-hidden />
            Previous
          </span>
        )}
        <span className="tnum px-1">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link className={linkCls} href={buildHref(basePath, params, { page: String(page + 1) })}>
            Next
            <CaretRight size={14} weight="bold" aria-hidden />
          </Link>
        ) : (
          <span className={disabledCls} aria-disabled="true">
            Next
            <CaretRight size={14} weight="bold" aria-hidden />
          </span>
        )}
      </div>
    </nav>
  );
}

/** JSON payload in a disclosure (audit before/after/metadata, webhook payloads). */
export function JsonDetails({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return null;
  return (
    <details className="group">
      <summary className="cursor-pointer select-none rounded-[var(--radius-control)] text-xs font-medium text-muted hover:text-fg">
        {label}
      </summary>
      <pre className="mt-1 max-h-72 max-w-[min(40rem,80vw)] overflow-auto rounded-[var(--radius-control)] bg-surface-2 p-2 font-mono text-xs leading-relaxed text-fg">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

/** A small inline link style used across tables. */
export const tableLink =
  "font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg";

/** Horizontal scroll wrapper for tables that sit inside a Panel (no extra border). */
export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-x-auto", className)}>{children}</div>;
}
