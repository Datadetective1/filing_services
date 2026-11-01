"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useId, useState } from "react";
import type { RegistrySearchResult, RegistrySelectState } from "@/app/(marketing)/find/registry-actions";
import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { hasRegistrySearch } from "@/lib/registry/sources";
import { RegistrySearch } from "./registry-search";

/**
 * "Find my business" with a state picker. States with an open business register search it
 * inline; other states continue to the short manual lookup with the name carried over.
 */
export function HeroFinder({
  states,
  search,
  select,
  chooseFirst = false,
}: {
  states: { code: string; name: string }[];
  /** Start on "Choose your state" instead of the first state in the list. */
  chooseFirst?: boolean;
  search: (q: string, stateCode: string) => Promise<RegistrySearchResult>;
  select: (state: RegistrySelectState, formData: FormData) => Promise<RegistrySelectState>;
}) {
  const id = useId();
  const [state, setState] = useState(chooseFirst ? "" : (states[0]?.code ?? "PA"));
  const current = states.find((s) => s.code === state) ?? states[0];

  return (
    <div className="grid gap-3">
      {states.length > 1 ? (
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-state`} className="text-[15px] font-semibold text-fg">
            Find your business
          </label>
          <Select id={`${id}-state`} value={state} onChange={(e) => setState(e.currentTarget.value)} className="h-12">
            {chooseFirst ? (
              <option value="" disabled>
                Choose your state
              </option>
            ) : null}
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="text-[15px] font-semibold text-fg">Find your {current?.name ?? "Pennsylvania"} business</p>
      )}

      {hasRegistrySearch(state) ? (
        <RegistrySearch key={state} search={search} select={select} stateCode={state} compact />
      ) : (
        <form action="/find" method="get" className="grid gap-2 sm:flex sm:flex-row">
          <input type="hidden" name="state" value={state} />
          <label htmlFor={`${id}-name`} className="sr-only">
            Business legal name
          </label>
          <Input id={`${id}-name`} name="name" placeholder="Business legal name" autoComplete="organization" maxLength={300} className="h-12 w-full sm:flex-1" />
          <button type="submit" disabled={state === ""} className={buttonClasses("primary", "md", "h-12 shrink-0")}>
            Continue
            <ArrowRight size={18} weight="bold" aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}
