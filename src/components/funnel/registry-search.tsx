"use client";

import { ArrowRight, Buildings, MagnifyingGlass } from "@phosphor-icons/react";
import { useActionState, useId, useState, useTransition } from "react";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import type { RegistryHit } from "@/lib/registry/pa-open-data-map";
import { registrySource } from "@/lib/registry/sources";
import { Input, Select } from "@/components/ui/field";
import { buttonClasses } from "@/components/ui/button";
import type { RegistrySearchResult, RegistrySelectState } from "@/app/(marketing)/find/registry-actions";

/**
 * Search a state's business register and pick the business, instead of typing its
 * details. Selecting re-reads the record on the server. Manual entry stays available.
 */
export function RegistrySearch({
  search,
  select,
  stateCode = "PA",
  states,
  compact = false,
}: {
  search: (q: string, stateCode: string) => Promise<RegistrySearchResult>;
  select: (state: RegistrySelectState, formData: FormData) => Promise<RegistrySelectState>;
  /** A state with a register source (see lib/registry/sources.ts). With `states`, "" asks first. */
  stateCode?: string;
  /** Let the visitor pick among these states (the full /find page). */
  states?: { code: string; name: string }[];
  /** No heading; "enter your details" points to /find (for the homepage hero and guide pages). */
  compact?: boolean;
}) {
  const id = useId();
  const [picked, setPicked] = useState(states ? (registrySource(stateCode)?.code ?? "") : stateCode);
  const chosen = registrySource(picked);
  const source = chosen ?? registrySource("PA")!;
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ state: string; value: RegistrySearchResult } | null>(null);
  const [searching, startSearch] = useTransition();
  const [selectState, selectAction, selecting] = useActionState(select, {});

  function run(e: React.FormEvent) {
    e.preventDefault();
    const state = source.code;
    startSearch(async () => setResult({ state, value: await search(q, state) }));
  }

  // Results belong to the state they came from; switching states hides them.
  const current = result?.state === source.code ? result.value : null;
  const results = current?.status === "ok" ? current.results : [];
  const manual = compact ? (
    <a href={source.code === "PA" ? "/find" : `/find?state=${source.code}`} className="font-medium text-fg underline underline-offset-4">
      enter your details instead
    </a>
  ) : (
    "enter your details below"
  );
  const ready = !states || Boolean(chosen);

  return (
    <div className="grid gap-4">
      {compact ? null : (
        <div className="grid gap-1">
          <h2 className="text-[19px] font-semibold leading-snug text-fg">
            {states ? "Search your state's business register" : <>Search {source.name}&apos;s business register</>}
          </h2>
          <p className="text-sm leading-6 text-muted">
            Type your business name or {ready ? source.numberLabel : "entity number"}, then pick it from the list. We fill in what
            the state&apos;s register shows, and you check it before anything is filed.
          </p>
        </div>
      )}

      {states ? (
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-state`} className="text-sm font-semibold text-fg">
            State
          </label>
          <Select id={`${id}-state`} value={picked} onChange={(e) => setPicked(e.currentTarget.value)} className="h-12">
            {chosen ? null : (
              <option value="" disabled>
                Choose your state
              </option>
            )}
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {ready ? (
        <form onSubmit={run} role="search" className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor={`${id}-q`} className="sr-only">
            Business name or {source.name} {source.numberLabel}
          </label>
          <Input
            id={`${id}-q`}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder={source.code === "PA" ? "e.g. Daff Trucking or 7380992" : `Business name or ${source.numberLabel}`}
            autoComplete="organization"
            maxLength={100}
            className="h-12 w-full sm:flex-1"
          />
          <button type="submit" className={buttonClasses("primary", "md", "h-12 shrink-0")} disabled={searching}>
            <MagnifyingGlass size={18} weight="bold" aria-hidden />
            {searching ? "Searching..." : "Search"}
          </button>
        </form>
      ) : null}

      <div aria-live="polite" className="grid gap-3">
        {current?.status === "too_short" ? <p className="text-sm text-muted">Enter at least 3 letters or numbers.</p> : null}
        {current?.status === "limited" ? <p className="text-sm text-muted">Too many searches in a short time. Wait a minute, or {manual}.</p> : null}
        {current?.status === "unavailable" ? (
          <p className="text-sm text-muted">
            {source.name}&apos;s register isn&apos;t responding right now. You can {manual}.
          </p>
        ) : null}
        {current?.status === "ok" && results.length === 0 ? (
          <p className="text-sm text-muted">
            No match. Try fewer words or the {source.numberLabel}, or {manual}. Businesses registered in the last few weeks may not
            be listed yet.
          </p>
        ) : null}
        {selectState.error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {selectState.error}
          </p>
        ) : null}

        {results.length > 0 ? (
          <form action={selectAction}>
            <input type="hidden" name="stateCode" value={source.code} />
            <p className="mb-2 text-sm text-muted">
              {results.length === 15 ? "First 15 matches. Add more of the name to narrow it down." : `${results.length} ${results.length === 1 ? "match" : "matches"}.`}{" "}
              Choose yours:
            </p>
            <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-control)] border border-border">
              {results.map((r) => (
                <li key={r.entityNumber}>
                  <ResultButton hit={r} numberLabel={source.numberLabel} disabled={selecting} />
                </li>
              ))}
            </ul>
          </form>
        ) : null}
      </div>

      <p className="text-xs leading-5 text-subtle">
        {ready
          ? `Source: ${source.source}. ${source.caveat} Filewell is a private service, not affiliated with the state.`
          : `Available for ${states!.map((s) => s.name).join(", ")}. Filewell is a private service, not affiliated with any state.`}
      </p>
    </div>
  );
}

function ResultButton({ hit, numberLabel, disabled }: { hit: RegistryHit; numberLabel: string; disabled: boolean }) {
  const type = hit.entityType ? `${hit.isForeign ? "Foreign " : ""}${ENTITY_TYPE_LABELS[hit.entityType]}` : hit.typeRaw;
  const place = [hit.city, hit.region].filter(Boolean).join(", ");
  const number = numberLabel === "entity number" ? `Entity #${hit.entityNumber}` : `${numberLabel.charAt(0).toUpperCase()}${numberLabel.slice(1)} ${hit.entityNumber}`;
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
          {[type, place, hit.county ? `${hit.county} County` : null, number].filter(Boolean).join(" · ")}
        </span>
      </span>
      <ArrowRight size={18} aria-hidden className="mt-1 shrink-0 text-muted" />
    </button>
  );
}
