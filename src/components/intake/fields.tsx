"use client";

import { Plus, Trash } from "@phosphor-icons/react";
import { type ComponentProps, type ReactNode, useState } from "react";
import type { IntakeField } from "@/lib/compliance/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Field, FieldError, FieldHint, Input, Select } from "@/components/ui/field";
import { type FieldErrorMap, fieldId } from "./types";
import { US_REGIONS, regionName } from "./us-regions";

type Values = Record<string, unknown>;
type FieldOf<T extends IntakeField["type"]> = Extract<IntakeField, { type: T }>;

function asRecord(v: unknown): Values {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Values) : {};
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function describedBy(id: string, hint: boolean, error: boolean): string | undefined {
  return [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

const legendClass = "font-display text-lg font-semibold text-fg";

/** Label above, input, hint, error below. Uncontrolled: the value is only the starting value. */
export function LabeledInput({
  name,
  id: idOverride,
  label,
  hint,
  error,
  value,
  required,
  className,
  ...inputProps
}: {
  name: string;
  id?: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  value: string;
  required?: boolean;
  className?: string;
} & Omit<ComponentProps<"input">, "name" | "id" | "defaultValue" | "value" | "required" | "className">) {
  const id = idOverride ?? fieldId(name);
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} optional={!required} className={className}>
      <Input
        id={id}
        name={name}
        defaultValue={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, Boolean(hint), Boolean(error))}
        {...inputProps}
      />
    </Field>
  );
}

function RadioCard({
  name,
  value,
  checked,
  defaultChecked,
  onChange,
  title,
  description,
}: {
  name: string;
  value: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: () => void;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 py-3.5 text-[15px] transition-[border-color,background-color,box-shadow] hover:border-fg/35 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/70 has-[:checked]:ring-1 has-[:checked]:ring-accent has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-accent/15">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="mt-0.5 size-[18px] shrink-0 accent-[var(--accent)]"
      />
      <span className="grid gap-0.5">
        <span className="font-semibold text-fg">{title}</span>
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function ChoiceField({ field, value, error }: { field: FieldOf<"choice">; value: string; error?: string }) {
  const id = fieldId(field.key);
  return (
    <fieldset id={id} aria-describedby={describedBy(id, Boolean(field.help), Boolean(error))}>
      <legend className="text-[15px] font-semibold text-fg">
        {field.label}
        {!field.required ? <span className="ml-1 font-normal text-subtle">(optional)</span> : null}
      </legend>
      <div className="mt-2 grid gap-2">
        {field.help ? <FieldHint id={`${id}-hint`}>{field.help}</FieldHint> : null}
        {field.options.map((o) => (
          <RadioCard key={o.value} name={field.key} value={o.value} defaultChecked={value === o.value} title={o.label} />
        ))}
        <FieldError id={`${id}-error`}>{error}</FieldError>
      </div>
    </fieldset>
  );
}

function RegionSelect({ name, value, error, autoComplete }: { name: string; value: string; error?: string; autoComplete?: string }) {
  const id = fieldId(name);
  return (
    <Field label="State" htmlFor={id} error={error}>
      <Select
        id={id}
        name={name}
        defaultValue={value.toUpperCase()}
        required
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">Select a state</option>
        {US_REGIONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function LockedRegion({ name, code, id }: { name: string; code: string; id: string }) {
  return (
    <>
      <Field label="State" htmlFor={id}>
        <Input id={id} value={regionName(code)} readOnly aria-readonly className="bg-surface-2 text-muted" />
      </Field>
      <input type="hidden" name={name} value={code} />
    </>
  );
}

/** Street, city, state, ZIP (and county when required). Field names: `<key>.line1` etc. */
function AddressInputs({
  prefix,
  value,
  errors,
  lockedRegion,
  requireCounty,
  idSuffix = "",
}: {
  prefix: string;
  value: Values;
  errors: FieldErrorMap;
  lockedRegion?: string;
  requireCounty?: boolean;
  idSuffix?: string;
}) {
  const err = (sub: string) => errors[`${prefix}.${sub}`];
  const ac = (token: string) => `section-${prefix} ${token}`;
  const id = (sub: string) => `${fieldId(`${prefix}.${sub}`)}${idSuffix}`;
  return (
    <div className="grid gap-5">
      <LabeledInput
        name={`${prefix}.line1`}
        id={id("line1")}
        label="Street address"
        value={asString(value.line1)}
        error={err("line1")}
        required
        maxLength={200}
        autoComplete={ac("address-line1")}
      />
      <LabeledInput
        name={`${prefix}.line2`}
        id={id("line2")}
        label="Suite, unit or floor"
        value={asString(value.line2)}
        error={err("line2")}
        maxLength={200}
        autoComplete={ac("address-line2")}
      />
      <LabeledInput
        name={`${prefix}.city`}
        id={id("city")}
        label="City"
        value={asString(value.city)}
        error={err("city")}
        required
        maxLength={100}
        autoComplete={ac("address-level2")}
      />
      <div className="grid items-start gap-5 sm:grid-cols-2">
        {lockedRegion ? (
          <LockedRegion name={`${prefix}.region`} code={lockedRegion} id={id("region")} />
        ) : (
          <RegionSelect name={`${prefix}.region`} value={asString(value.region)} error={err("region")} autoComplete={ac("address-level1")} />
        )}
        <LabeledInput
          name={`${prefix}.postal_code`}
          id={id("postal_code")}
          label="ZIP code"
          value={asString(value.postal_code)}
          error={err("postal_code")}
          required
          maxLength={10}
          inputMode="numeric"
          autoComplete={ac("postal-code")}
        />
      </div>
      {requireCounty ? (
        <LabeledInput
          name={`${prefix}.county`}
          id={id("county")}
          label="County"
          value={asString(value.county)}
          error={err("county")}
          required
          maxLength={100}
          autoComplete="off"
        />
      ) : null}
      {lockedRegion && err("region") ? <FieldError>{err("region")}</FieldError> : null}
    </div>
  );
}

export function AddressField({ field, value, errors }: { field: FieldOf<"address">; value: unknown; errors: FieldErrorMap }) {
  const id = fieldId(field.key);
  return (
    <fieldset id={id} aria-describedby={describedBy(id, Boolean(field.help), Boolean(errors[field.key]))}>
      <legend className={legendClass}>{field.label}</legend>
      <div className="mt-2 grid gap-5">
        {field.help ? <FieldHint id={`${id}-hint`}>{field.help}</FieldHint> : null}
        <AddressInputs
          prefix={field.key}
          value={asRecord(value)}
          errors={errors}
          lockedRegion={field.lockedRegion}
          requireCounty={field.requireCounty}
        />
        <FieldError id={`${id}-error`}>{errors[field.key]}</FieldError>
      </div>
    </fieldset>
  );
}

/**
 * Registered office: a street address in the state, OR a commercial registered
 * office provider (CROP) plus the county. Only the chosen branch is submitted
 * (the other branch's fieldset is disabled).
 */
export function RegisteredOfficeField({
  field,
  value,
  errors,
}: {
  field: FieldOf<"registered_office">;
  value: unknown;
  errors: FieldErrorMap;
}) {
  const v = asRecord(value);
  const k = field.key;
  const [mode, setMode] = useState<"address" | "crop">(v.mode === "crop" ? "crop" : "address");
  const stateName = regionName(field.region);
  const id = fieldId(k);
  const countyId = fieldId(`${k}.county`);

  return (
    <div id={id} className="grid gap-7">
      <fieldset id={fieldId(`${k}.mode`)}>
        <legend className={legendClass}>{field.label}</legend>
        <div className="mt-3 grid gap-2">
          {field.help ? <FieldHint>{field.help}</FieldHint> : null}
          <RadioCard
            name={`${k}.mode`}
            value="address"
            checked={mode === "address"}
            onChange={() => setMode("address")}
            title={`A street address in ${stateName}`}
            description="A physical address. A P.O. box alone is not accepted."
          />
          <RadioCard
            name={`${k}.mode`}
            value="crop"
            checked={mode === "crop"}
            onChange={() => setMode("crop")}
            title="A commercial registered office provider (CROP)"
            description="The provider's name and the county."
          />
          <FieldError>{errors[`${k}.mode`]}</FieldError>
        </div>
      </fieldset>

      <fieldset hidden={mode !== "address"} disabled={mode !== "address"} className="grid gap-5">
        <legend className="sr-only">Registered office street address</legend>
        <AddressInputs
          prefix={k}
          value={v}
          errors={mode === "address" ? errors : {}}
          lockedRegion={field.region}
          requireCounty
          idSuffix={mode === "address" ? "" : "-inactive"}
        />
      </fieldset>

      <fieldset hidden={mode !== "crop"} disabled={mode !== "crop"} className="grid gap-5">
        <legend className="sr-only">Commercial registered office provider</legend>
        <LabeledInput
          name={`${k}.crop_name`}
          label="Provider name"
          hint="The provider's name exactly as it appears on your state record."
          value={asString(v.crop_name)}
          error={mode === "crop" ? errors[`${k}.crop_name`] : undefined}
          required
          maxLength={200}
          autoComplete="off"
        />
        <LabeledInput
          name={`${k}.county`}
          id={mode === "crop" ? countyId : `${countyId}-inactive`}
          label="County"
          hint={`The ${stateName} county listed with the provider on your state record.`}
          value={asString(v.county)}
          error={mode === "crop" ? errors[`${k}.county`] : undefined}
          required
          maxLength={100}
          autoComplete="off"
        />
      </fieldset>

      <FieldError>{errors[k]}</FieldError>
    </div>
  );
}

interface PersonRow {
  id: number;
  name: string;
  title: string;
}

/** Repeater of name + title rows. Field names: `<key>.<index>.name` / `.title`. */
export function PeopleField({ field, value, errors }: { field: FieldOf<"people">; value: unknown; errors: FieldErrorMap }) {
  const k = field.key;
  const id = fieldId(k);
  const listId = `${id}-titles`;
  const minRows = Math.max(field.min, 0);

  const [rows, setRows] = useState<PersonRow[]>(() => {
    const initial = (Array.isArray(value) ? value : []).map((p, i) => {
      const r = asRecord(p);
      return { id: i, name: asString(r.name), title: asString(r.title) };
    });
    while (initial.length < Math.max(minRows, field.required ? 1 : 0)) {
      initial.push({ id: initial.length, name: "", title: "" });
    }
    return initial;
  });
  const [focusId, setFocusId] = useState<number | null>(null);

  const canRemove = rows.length > Math.max(minRows, field.required ? 1 : 0);
  const canAdd = rows.length < field.max;

  function add() {
    const nextId = rows.reduce((m, r) => Math.max(m, r.id), -1) + 1;
    setRows([...rows, { id: nextId, name: "", title: "" }]);
    setFocusId(nextId);
  }

  function remove(rowId: number) {
    setRows(rows.filter((r) => r.id !== rowId));
  }

  const groupError = errors[k];

  return (
    <fieldset id={id} aria-describedby={describedBy(id, Boolean(field.help), Boolean(groupError))}>
      <legend className={legendClass}>
        {field.label}
        {!field.required ? <span className="ml-1.5 text-sm font-normal text-subtle">(optional)</span> : null}
      </legend>
      <div className="mt-3 grid gap-3">
        {field.help ? <FieldHint id={`${id}-hint`}>{field.help}</FieldHint> : null}
        <FieldError id={`${id}-error`}>{groupError}</FieldError>

        {rows.length === 0 ? (
          <p className="rounded-[var(--radius-control)] border border-dashed border-border-strong bg-surface-2/40 px-4 py-4 text-sm text-muted">
            No one listed.
          </p>
        ) : (
          <ol className="grid gap-3">
            {rows.map((row, i) => (
              <li
                key={row.id}
                className="grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface-2/40 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start sm:p-5"
              >
                <LabeledInput
                  name={`${k}.${i}.name`}
                  label={
                    <>
                      Full name<span className="sr-only">, person {i + 1}</span>
                    </>
                  }
                  value={row.name}
                  error={errors[`${k}.${i}.name`]}
                  required
                  maxLength={200}
                  autoComplete="off"
                  autoFocus={row.id === focusId}
                />
                <LabeledInput
                  name={`${k}.${i}.title`}
                  label={
                    <>
                      Title<span className="sr-only">, person {i + 1}</span>
                    </>
                  }
                  value={row.title}
                  error={errors[`${k}.${i}.title`]}
                  required
                  maxLength={100}
                  list={listId}
                  autoComplete="off"
                />
                {canRemove ? (
                  <Button
                    variant="ghost"
                    className="h-11 justify-self-start text-muted sm:mt-7"
                    onClick={() => remove(row.id)}
                    aria-label={`Remove person ${i + 1}`}
                  >
                    <Trash size={18} aria-hidden />
                    <span className="sm:sr-only">Remove</span>
                  </Button>
                ) : (
                  <span className="hidden sm:block sm:w-11" aria-hidden />
                )}
              </li>
            ))}
          </ol>
        )}

        <datalist id={listId}>
          {field.titleSuggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <div>
          <Button variant="secondary" className={cn("h-11")} onClick={add} disabled={!canAdd}>
            <Plus size={18} aria-hidden />
            {rows.length === 0 ? "Add a person" : "Add another person"}
          </Button>
          {!canAdd ? <p className="mt-2 text-sm text-muted">You can list up to {field.max} people.</p> : null}
        </div>
      </div>
    </fieldset>
  );
}

/** Renders one schema field with its current value and errors. */
export function IntakeFieldInput({ field, values, errors }: { field: IntakeField; values: Values; errors: FieldErrorMap }) {
  const value = values[field.key];
  switch (field.type) {
    case "text":
      return (
        <LabeledInput
          name={field.key}
          label={field.label}
          hint={field.help}
          value={asString(value)}
          error={errors[field.key]}
          required={field.required}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          autoComplete={field.key === "legal_name" ? "organization" : "off"}
          spellCheck={false}
        />
      );
    case "email":
      return (
        <LabeledInput
          name={field.key}
          type="email"
          label={field.label}
          hint={field.help}
          value={asString(value)}
          error={errors[field.key]}
          required={field.required}
          maxLength={254}
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
        />
      );
    case "choice":
      return <ChoiceField field={field} value={asString(value)} error={errors[field.key]} />;
    case "address":
      return <AddressField field={field} value={value} errors={errors} />;
    case "registered_office":
      return <RegisteredOfficeField field={field} value={value} errors={errors} />;
    case "people":
      return <PeopleField field={field} value={value} errors={errors} />;
  }
}
