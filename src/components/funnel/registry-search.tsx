"use client";

import { ArrowRight, Buildings, MagnifyingGlass } from "@phosphor-icons/react";
import { useActionState, useId, useState, useTransition } from "react";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import type { RegistryHit } from "@/lib/registry/pa-open-data-map";
import { Input } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import type { RegistrySearchResult, RegistrySelectState } from "@/app/(marketing)/find/registry-actions";

/**
 * Search Pennsylvania's business register and pick the business, instead of typing its
 * details. Selecting re-reads the record on the server. Manual entry stays available.
 */
export function RegistrySearch({
  search,
  select,
  compact = false,
}: {
  search: (q: string) => Promise<RegistrySearchResult>;
  select: (state: RegistrySelectState, formData: FormData) => Promise<RegistrySelectState>;
  /** No heading; "enter your details" points to /find (for the homepage hero and guide pages). */
  compact?: boolean;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<RegistrySearchResult | null>(null);
  const [searching, startSearch] = useTransition();
  const [selectState, selectAction, selecting] = useActionState(select, {});

  function run(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => setResult(await search(q)));
  }

  const results = result?.status === "ok" ? result.results : [];
  const manual = compact ? (
    <a href="/find" className="font-medium text-fg underline underline-offset-4">
      enter your details instead
    </a>
  ) : (
    "enter your details below"
  );

  return (
    <div className="grid gap-4">
      {compact ? null : (
        <div className="grid gap-1">
          <h2 className="text-[19px] font-semibold leading-snug text-fg">Search Pennsylvania&apos;s business register</h2>
          <p className="text-sm leading-6 text-muted">
            Type your business name or entity number, then pick it from the list. We fill in what the state&apos;s register shows,
            and you check it before anything is filed.
          </p>
        </div>
      )}

      <form onSubmit={run} role="search" className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-q`} className="sr-only">
          Business name or Pennsylvania entity number
        </label>
        <Input
          id={`${id}-q`}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          placeholder="e.g. Daff Trucking or 7380992"
          autoComplete="organization"
          maxLength={100}
          className="h-12 w-full sm:flex-1"
        />
        <button type="submit" className={buttonClasses("primary", "md", "h-12 shrink-0")} disabled={searching}>
          <MagnifyingGlass size={18} weight="bold" aria-hidden />
          {searching ? "Searching..." : "Search"}
        </button>
      </form>

      <div aria-live="polite" className="grid gap-3">
        {result?.status === "too_short" ? <p className="text-sm text-muted">Enter at least 3 letters or numbers.</p> : null}
        {result?.status === "limited" ? <p className="text-sm text-muted">Too many searches in a short time. Wait a minute, or {manual}.</p> : null}
        {result?.status === "unavailable" ? (
          <p className="text-sm text-muted">Pennsylvania&apos;s register isn&apos;t responding right now. You can {manual}.</p>
        ) : null}
        {result?.status === "ok" && results.length === 0 ? (
          <p className="text-sm text-muted">
            No match. Try fewer words or the entity number, or {manual}. Businesses registered in the last few weeks may not be
            listed yet.
          </p>
        ) : null}
        {selectState.error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {selectState.error}
          </p>
        ) : null}

        {results.length > 0 ? (
          <form action={selectAction}>
            <p className="mb-2 text-sm text-muted">
              {results.length === 15 ? "First 15 matches. Add more of the name to narrow it down." : `${results.length} ${results.length === 1 ? "match" : "matches"}.`}{" "}
              Choose yours:
            </p>
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-control)] border border-border">
              {results.map((r) => (
                <li key={r.entityNumber}>
                  <ResultButton hit={r} disabled={selecting} />
                </li>
              ))}
            </ul>
          </form>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-subtle">
        Source: Pennsylvania Department of State business register, published on data.pa.gov and updated monthly. It doesn&apos;t
        show standing or filing history. Filewell is a private service, not affiliated with the Department of State.
      </p>
    </div>
  );
}

function ResultButton({ hit, disabled }: { hit: RegistryHit; disabled: boolean }) {
  const type = hit.entityType ? `${hit.isForeign ? "Foreign " : ""}${ENTITY_TYPE_LABELS[hit.entityType]}` : hit.typeRaw;
  const place = [hit.city, hit.region].filter(Boolean).join(", ");
  return (
    <button
      type="submit"
      name="entityNumber"
      value={hit.entityNumber}
      disabled={disabled}
      className="flex min-h-14 w-full items-start gap-3 bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none disabled:opacity-60"
    >
      <Buildings size={20} aria-hidden className="mt-0.5 shrink-0 text-muted" />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-semibold text-fg">{hit.name}</span>
        <span className="text-sm text-muted">
          {[type, place, hit.county ? `${hit.county} County` : null, `Entity #${hit.entityNumber}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      <ArrowRight size={18} aria-hidden className="mt-1 shrink-0 text-muted" />
    </button>
  );
}
