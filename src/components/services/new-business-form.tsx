"use client";

import { useActionState } from "react";
import type { ActionMessageState } from "@/components/funnel/types";
import { Field, Input, Select } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";

/** Three answers for a business not formed yet; the agent order page comes next. */
export function NewBusinessForm({
  action,
  states,
  defaultState,
}: {
  action: (
    state: ActionMessageState,
    formData: FormData,
  ) => Promise<ActionMessageState>;
  states: { code: string; name: string }[];
  defaultState: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-5">
      <Field label="State you're forming in" htmlFor="stateCode">
        <Select
          id="stateCode"
          name="stateCode"
          required
          defaultValue={defaultState}
        >
          <option value="" disabled>
            Choose a state
          </option>
          {states.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="text-[15px] font-semibold text-fg">
          Type of business
        </legend>
        <label className="flex items-center gap-3 text-[15px] text-fg">
          <input
            type="radio"
            name="entityType"
            value="llc"
            defaultChecked
            className="size-5 accent-[var(--accent)]"
          />
          LLC
        </label>
        <label className="flex items-center gap-3 text-[15px] text-fg">
          <input
            type="radio"
            name="entityType"
            value="corporation"
            className="size-5 accent-[var(--accent)]"
          />
          Corporation
        </label>
      </fieldset>
      <Field
        label="Business name"
        htmlFor="businessName"
        hint="The name you plan to file. You can change it later."
      >
        <Input
          id="businessName"
          name="businessName"
          required
          maxLength={200}
          autoComplete="organization"
        />
      </Field>
      {state.error ? (
        <Notice tone="danger" role="alert" title="We couldn't continue">
          <p>{state.error}</p>
        </Notice>
      ) : null}
      <SubmitButton size="lg" pendingLabel="Saving…" className="w-full">
        Continue
      </SubmitButton>
    </form>
  );
}
