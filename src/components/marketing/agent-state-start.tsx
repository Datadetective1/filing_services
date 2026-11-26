"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { track } from "@/lib/analytics/client";

/**
 * Top-of-page start for registered agent service: pick the state, press one button.
 * A plain GET form to /registered-agent/start, so it works without JavaScript too.
 */
export function AgentStateStart({ states }: { states: { code: string; name: string }[] }) {
  const [state, setState] = useState("");
  return (
    <form
      action="/registered-agent/start"
      method="get"
      className="grid max-w-xl gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      onSubmit={() => track("filing_cta_clicked", state ? { stateCode: state } : {})}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="ra-start-state">Your business&apos;s state</Label>
        <Select id="ra-start-state" name="state" required value={state} onChange={(e) => setState(e.target.value)}>
          <option value="" disabled>
            Choose a state
          </option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <button type="submit" className={buttonClasses("primary", "lg")}>
        Get started
      </button>
    </form>
  );
}
