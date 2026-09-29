"use client";

import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import Link from "next/link";
import { useId, useState } from "react";
import { cn } from "@/components/ui/cn";

export interface DirectoryItem {
  code: string;
  name: string;
  slug: string;
  verified: boolean;
}

/**
 * Filterable list of every state and DC with its honest status. Without
 * JavaScript the full list still renders; the filter only narrows it.
 */
export function StateDirectory({
  items,
  basePath,
  className,
}: {
  items: DirectoryItem[];
  basePath: "/annual-report" | "/states";
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const id = useId();
  const q = query.trim().toLowerCase();
  const hasDc = items.some((i) => i.code === "DC");
  const total = hasDc ? `${items.length - 1} states and DC` : `${items.length} states`;
  const shown = q
    ? items.filter((i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase() === q)
    : items;

  return (
    <div className={cn("grid gap-5", className)}>
      <div className="grid gap-2 sm:max-w-sm">
        <label htmlFor={`${id}-q`} className="text-[15px] font-semibold text-fg">
          Find a state
        </label>
        <div className="relative">
          <MagnifyingGlass
            size={18}
            weight="bold"
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
          />
          <input
            id={`${id}-q`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="State name or code"
            autoComplete="off"
            aria-describedby={`${id}-count`}
            className="block h-12 w-full rounded-full border border-border-strong bg-surface pl-10 pr-4 text-base text-fg placeholder:text-subtle transition-[border-color,box-shadow] hover:border-fg/35 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
        </div>
        <p id={`${id}-count`} aria-live="polite" className="text-[13px] text-muted">
          {q ? `${shown.length} of ${items.length} shown` : total}
        </p>
      </div>

      {shown.length ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <li key={s.code}>
              <Link
                href={`${basePath}/${s.slug}`}
                className={cn(
                  "group flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2 transition-colors",
                  s.verified
                    ? "border-accent/35 bg-accent-soft hover:border-accent/70"
                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-2",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "grid h-7 w-9 shrink-0 place-items-center rounded-[6px] font-display text-[12px] font-bold tracking-wide",
                    s.verified ? "bg-accent text-accent-fg" : "bg-surface-2 text-subtle",
                  )}
                >
                  {s.code}
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-medium text-fg">{s.name}</span>
                <span className={cn("shrink-0 text-[12px]", s.verified ? "font-semibold text-accent-soft-fg" : "text-subtle")}>
                  {s.verified ? "Filing supported" : "Not yet verified"}
                </span>
                <ArrowRight
                  size={14}
                  weight="bold"
                  aria-hidden
                  className="shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-surface)] border border-dashed border-border-strong bg-surface/60 px-5 py-8 text-center text-[15px] text-muted">
          No state matches &ldquo;{query.trim()}&rdquo;. Try the full name, like Ohio, or a two-letter code, like OH.
        </p>
      )}
    </div>
  );
}
