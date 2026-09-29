import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";
import { opsButton } from "./button-classes";

/**
 * Building blocks for the operations console: page headers, tiles, stats, panels,
 * key/value rows, section jump links, pagination and JSON disclosure. Dense where
 * operators scan, calm everywhere else.
 */

type Tone = "neutral" | "warning" | "danger" | "success";

const toneValue: Record<Tone, string> = {
  neutral: "text-fg",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-accent",
};

/** Page title block: a compact display heading, one line of context, optional actions. */
export function ConsoleHeader({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="grid min-w-0 gap-1.5">
        {eyebrow ? <p className="text-[13px] font-semibold text-subtle">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-semibold leading-[1.15] text-fg sm:text-[30px]">{title}</h1>
        {description ? <p className="max-w-[70ch] text-[15px] leading-relaxed text-muted">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

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
      className="group grid min-h-[6.5rem] content-between gap-3 bg-surface px-5 py-4 transition-colors hover:bg-bg focus-visible:relative focus-visible:z-10"
    >
      <span className="flex items-start justify-between gap-2 text-[13px] font-medium text-muted">
        {label}
        <CaretRight size={14} weight="bold" className="mt-0.5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className={cn("tnum font-display text-[28px] font-semibold leading-none", toneValue[tone])}>{value}</span>
      {hint ? <span className="text-xs leading-snug text-subtle">{hint}</span> : null}
    </Link>
  );
}

const gridCols: Record<2 | 3 | 4 | 5, string> = {
  2: "min-[420px]:grid-cols-2",
  3: "min-[420px]:grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
  5: "min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
};

/** Grid wrapper that draws 1px dividers between tiles. */
export function TileGrid({ children, className, cols = 5 }: { children: ReactNode; className?: string; cols?: 2 | 3 | 4 | 5 }) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-[var(--radius-surface)] border border-border bg-border shadow-[0_1px_2px_rgb(23_35_29/0.04)]",
        gridCols[cols],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A row of read-only numbers (no links), divided like TileGrid. */
export function StatStrip({ children, className, cols = 4 }: { children: ReactNode; className?: string; cols?: 2 | 3 | 4 | 5 }) {
  const colsClass: Record<2 | 3 | 4 | 5, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-2 md:grid-cols-5",
  };
  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-[var(--radius-surface)] border border-border bg-border shadow-[0_1px_2px_rgb(23_35_29/0.04)]",
        colsClass[cols],
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Stat({ label, value, hint, tone = "neutral", className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: Tone; className?: string }) {
  return (
    <div className={cn("grid content-start gap-1.5 bg-surface px-5 py-4", className)}>
      <dt className="text-[13px] font-medium text-muted">{label}</dt>
      <dd className={cn("tnum font-display text-2xl font-semibold leading-none", toneValue[tone])}>{value}</dd>
      {hint ? <dd className="text-xs leading-snug text-subtle">{hint}</dd> : null}
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
  // cn() does not merge utilities, so a flush body ("p-0") replaces the default padding instead of fighting it.
  const flush = /(^|\s)p-0(\s|$)/.test(bodyClassName ?? "");
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "scroll-mt-6 rounded-[var(--radius-surface)] border border-border bg-surface shadow-[0_1px_2px_rgb(23_35_29/0.04)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border/70 px-5 py-4">
        <div className="grid min-w-0 gap-0.5">
          <h2 id={headingId} className="text-[17px] font-semibold leading-snug text-fg">
            {title}
          </h2>
          {description ? <p className="max-w-[72ch] text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn(flush ? null : "px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Compact term / value rows with hairline dividers. */
export function KeyValues({ items, className }: { items: { term: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid text-sm", className)}>
      {items.map((item, i) => (
        <div
          key={i}
          className="grid gap-0.5 border-t border-border/60 py-2.5 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)] sm:gap-4"
        >
          <dt className="text-muted">{item.term}</dt>
          <dd className="min-w-0 break-words text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Muted placeholder for an empty table or list. */
export function EmptyRow({ children }: { children: ReactNode }) {
  return <p className="py-1 text-sm text-muted">{children}</p>;
}

/** Jump links to sections further down the page. Scrolls sideways on small screens. */
export function SectionNav({
  label,
  items,
  className,
}: {
  label: string;
  items: { id: string; label: ReactNode; count?: number; alert?: boolean }[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap">
        {items.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              {s.label}
              {typeof s.count === "number" ? (
                <span
                  className={cn(
                    "tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                    s.alert && s.count > 0 ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted",
                  )}
                >
                  {s.count}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
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
  const linkCls = opsButton("secondary", "px-4");
  const disabledCls = cn(linkCls, "pointer-events-none opacity-40");
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <p className="tnum">
        Showing {from}-{to} of {total}
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
      <summary className="inline-flex min-h-8 cursor-pointer select-none list-none items-center gap-1.5 rounded-[6px] text-xs font-semibold text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
        <CaretRight size={12} weight="bold" className="transition-transform group-open:rotate-90" aria-hidden />
        {label}
      </summary>
      <pre className="mt-1 max-h-72 max-w-[min(40rem,80vw)] overflow-auto rounded-[var(--radius-control)] border border-border bg-bg p-3 font-mono text-xs leading-relaxed text-fg">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

/** A small inline link style used across tables. */
export const tableLink =
  "rounded-[4px] font-semibold text-fg underline decoration-border-strong decoration-1 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent";

/** Horizontal scroll wrapper for tables that sit flush inside a Panel (no extra border). */
export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div tabIndex={0} className={cn("overflow-x-auto rounded-b-[var(--radius-surface)]", className)}>
      {children}
    </div>
  );
}
