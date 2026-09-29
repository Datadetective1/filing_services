"use client";

import { ArrowRight, ArrowSquareOut, Info } from "@phosphor-icons/react";
import { useActionState, useRef, useState } from "react";
import { track } from "@/lib/analytics/client";
import { Checkbox, Field, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LabeledInput } from "@/components/intake/fields";
import { ErrorSummary } from "@/components/intake/intake-form";
import { fieldId } from "@/components/intake/types";
import type { LookupFormState, LookupJurisdictionOption, LookupValues } from "./types";

const LABELS: Record<string, string> = {
  legalName: "Legal business name",
  stateCode: "State",
  entityType: "Entity type",
  formationDate: "Formation date",
  entityNumber: "State entity number",
  homeJurisdiction: "Where it was formed",
};

function CheckRow({
  name,
  label,
  checked,
  defaultChecked,
  onChange,
  controls,
}: {
  name: string;
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  controls?: string;
}) {
  const id = fieldId(name);
  return (
    <label
      htmlFor={id}
      className="flex min-h-12 cursor-pointer items-start gap-3 px-4 py-3 text-[15px] text-fg transition-colors hover:bg-surface-2/70 has-[:checked]:bg-accent-soft/60"
    >
      <Checkbox
        id={id}
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (e) => onChange(e.currentTarget.checked) : undefined}
        aria-controls={controls}
        className="mt-1"
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * "Find my business" lookup. The visitor types what's on their state record; we
 * never present it as data pulled from the state.
 */
export function LookupForm({
  action,
  jurisdictions,
  entityOptions,
  defaults,
  maxDate,
}: {
  action: (state: LookupFormState, formData: FormData) => Promise<LookupFormState>;
  jurisdictions: LookupJurisdictionOption[];
  entityOptions: { value: string; label: string }[];
  defaults: LookupValues;
  maxDate: string;
}) {
  const [state, formAction] = useActionState(action, { errors: {}, nonce: 0 });
  const v = state.values ?? defaults;
  const [stateCode, setStateCode] = useState(defaults.stateCode);
  const [isForeign, setIsForeign] = useState(defaults.isForeign);
  const started = useRef(false);
  const selected = jurisdictions.find((j) => j.code === stateCode) ?? jurisdictions[0];
  const e = state.errors;
  const hasErrors = Object.keys(e).length > 0 || Boolean(state.formError);

  function onFirstInteraction() {
    if (started.current) return;
    started.current = true;
    track("lookup_started", { stateCode });
  }

  return (
    <form
      key={state.nonce}
      action={formAction}
      noValidate
      onChange={onFirstInteraction}
      className="grid gap-6 sm:gap-7"
    >
      {hasErrors ? (
        <ErrorSummary errors={e} formError={state.formError} describe={(k) => LABELS[k] ?? ""} focusKey={state.nonce} />
      ) : null}

      <LabeledInput
        name="legalName"
        label="Legal business name"
        hint="Exactly as it appears on the state record, including LLC, Inc. or similar."
        value={v.legalName}
        error={e.legalName}
        required
        maxLength={300}
        autoComplete="organization"
        spellCheck={false}
      />

      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field label="State" htmlFor={fieldId("stateCode")} error={e.stateCode}>
          <Select
            id={fieldId("stateCode")}
            name="stateCode"
            value={stateCode}
            onChange={(ev) => setStateCode(ev.currentTarget.value)}
            required
            aria-invalid={e.stateCode ? true : undefined}
            aria-describedby={e.stateCode ? `${fieldId("stateCode")}-error` : undefined}
          >
            {jurisdictions.map((j) => (
              <option key={j.code} value={j.code}>
                {j.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Entity type" htmlFor={fieldId("entityType")} error={e.entityType}>
          <Select
            id={fieldId("entityType")}
            name="entityType"
            defaultValue={v.entityType}
            required
            aria-invalid={e.entityType ? true : undefined}
            aria-describedby={e.entityType ? `${fieldId("entityType")}-error` : undefined}
          >
            <option value="">Select an entity type</option>
            {entityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex gap-3 rounded-[var(--radius-control)] bg-surface-2 px-4 py-3.5 text-sm leading-6 text-muted">
        <Info size={18} className="mt-0.5 shrink-0 text-fg" aria-hidden />
        <p>
          We don&apos;t pull records from the state yet, so enter the details as they appear on your state record. Look
          them up on the{" "}
          <a
            href={selected.searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
          >
            {selected.isBusinessSearch ? `official ${selected.name} business search` : `official ${selected.name} business agency site`}
            <ArrowSquareOut size={14} weight="bold" aria-hidden className="ml-1 inline align-[-2px]" />
            <span className="sr-only">(opens a government website in a new tab)</span>
          </a>
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1" aria-hidden>
        <span className="text-[13px] font-semibold uppercase tracking-wider text-subtle">Optional details</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="-mt-2 grid items-start gap-5 sm:grid-cols-2">
        <LabeledInput
          name="formationDate"
          type="date"
          label="Formation date"
          hint={`For a business formed elsewhere, the date it registered in ${selected.name}.`}
          value={v.formationDate}
          error={e.formationDate}
          max={maxDate}
          min="1800-01-01"
        />
        <LabeledInput
          name="entityNumber"
          label="State entity number"
          hint="Shown on the state's business search."
          value={v.entityNumber}
          error={e.entityNumber}
          maxLength={30}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <fieldset>
        <legend className="text-[15px] font-semibold text-fg">About the business</legend>
        <p className="mt-1 text-sm text-muted">Check any that apply.</p>
        <div className="mt-3 grid divide-y divide-border overflow-hidden rounded-[var(--radius-control)] border border-border-strong">
          <CheckRow
            name="isForeign"
            label={`Formed outside ${selected.name} (foreign entity)`}
            checked={isForeign}
            onChange={setIsForeign}
            controls="home-jurisdiction"
          />
          <div id="home-jurisdiction" hidden={!isForeign} className="bg-surface-2/50 px-4 pb-4 pt-3 sm:pl-12">
            {isForeign ? (
              <LabeledInput
                name="homeJurisdiction"
                label="Where was it formed?"
                hint="The state or country of formation."
                value={v.homeJurisdiction}
                error={e.homeJurisdiction}
                maxLength={100}
                autoComplete="off"
              />
            ) : null}
          </div>
          <CheckRow name="isNonprofit" label="Has a not-for-profit purpose" defaultChecked={v.isNonprofit} />
          <CheckRow name="alreadyFiledThisYear" label="We already filed this year's report" defaultChecked={v.alreadyFiledThisYear} />
        </div>
      </fieldset>

      <div className="grid gap-3 border-t border-border pt-6 sm:flex sm:flex-row-reverse sm:items-center sm:justify-between">
        <SubmitButton size="lg" pendingLabel="Checking…" className="w-full sm:w-auto sm:px-8">
          See what&apos;s due
          <ArrowRight size={18} weight="bold" aria-hidden />
        </SubmitButton>
        <p className="text-center text-sm text-muted sm:text-left">Free to check. Nothing is filed until you ask.</p>
      </div>
    </form>
  );
}
