"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useId, useState } from "react";
import type { RegistrySearchResult, RegistrySelectState } from "@/app/(marketing)/find/registry-actions";
import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { RegistrySearch } from "./registry-search";

/**
 * "Find my business" with a state picker. Pennsylvania searches the state's register
 * inline; other states continue to the short manual lookup with the name carried over.
 */
export function HeroFinder({
  states,
  search,
  select,
}: {
  states: { code: string; name: string }[];
  search: (q: string) => Promise<RegistrySearchResult>;
  select: (state: RegistrySelectState, formData: FormData) => Promise<RegistrySelectState>;
}) {
  const id = useId();
  const [state, setState] = useState(states[0]?.code ?? "PA");
  const current = states.find((s) => s.code === state) ?? states[0];

  return (
    <div className="grid gap-3">
      {states.length > 1 ? (
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-state`} className="text-[15px] font-semibold text-fg">
            Find your business
          </label>
          <Select id={`${id}-state`} value={state} onChange={(e) => setState(e.currentTarget.value)} className="h-12">
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

      {state === "PA" ? (
        <RegistrySearch search={search} select={select} compact />
      ) : (
        <form action="/find" method="get" className="grid gap-2 sm:flex sm:flex-row">
          <input type="hidden" name="state" value={state} />
          <label htmlFor={`${id}-name`} className="sr-only">
            Business legal name
          </label>
          <Input id={`${id}-name`} name="name" placeholder="Business legal name" autoComplete="organization" maxLength={300} className="h-12 w-full sm:flex-1" />
          <button type="submit" className={buttonClasses("primary", "md", "h-12 shrink-0")}>
            Continue
            <ArrowRight size={18} weight="bold" aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}
