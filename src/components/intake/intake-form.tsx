"use client";

import { ArrowLeft, ArrowRight, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import type { IntakeSection } from "@/lib/compliance/types";
import { buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { IntakeFieldInput } from "./fields";
import { type FieldErrorMap, type IntakeFormState, fieldId } from "./types";

function errorContext(section: IntakeSection, key: string): string {
  const [root, second] = key.split(".");
  const field = section.fields.find((f) => f.key === root);
  if (!field) return "";
  if (field.type === "people" && second !== undefined && /^\d+$/.test(second)) {
    return `${field.label}, person ${Number(second) + 1}`;
  }
  return field.label;
}

export function ErrorSummary({
  errors,
  formError,
  describe,
  focusKey,
}: {
  errors: FieldErrorMap;
  formError?: string;
  describe?: (key: string) => string;
  focusKey: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors);
  const visible = entries.length > 0 || Boolean(formError);

  useEffect(() => {
    if (focusKey > 0) ref.current?.focus();
  }, [focusKey]);

  if (!visible) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-labelledby="form-error-title"
      className="flex gap-3 rounded-[var(--radius-control)] border border-danger/30 bg-danger-soft px-4 py-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-danger/40"
    >
      <WarningCircle size={20} weight="fill" aria-hidden className="mt-px shrink-0 text-danger" />
      <div className="min-w-0">
        <p id="form-error-title" className="font-semibold text-fg">
          {formError ?? (entries.length === 1 ? "One thing needs your attention" : "A few things need your attention")}
        </p>
        {entries.length > 0 ? (
          <ul className="mt-2 grid gap-1.5">
            {entries.map(([key, message]) => {
              const context = describe?.(key);
              return (
                <li key={key}>
                  <a href={`#${fieldId(key)}`} className="text-danger underline underline-offset-2 hover:no-underline">
                    {context ? `${context}: ` : ""}
                    {message}
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One intake section, rendered from the rule's data-driven schema. On a server
 * validation error the form remounts with exactly what the customer submitted plus
 * per-field messages; on success the server action redirects to the next step.
 */
export function IntakeForm({
  action,
  section,
  initialValues,
  submitLabel,
  backHref,
}: {
  action: (state: IntakeFormState, formData: FormData) => Promise<IntakeFormState>;
  section: IntakeSection;
  initialValues: Record<string, unknown>;
  submitLabel: string;
  backHref?: string | null;
}) {
  const [state, formAction] = useActionState(action, { errors: {}, nonce: 0 });
  const values = state.values ?? initialValues;
  const hasErrors = Object.keys(state.errors).length > 0 || Boolean(state.formError);

  return (
    <form key={state.nonce} action={formAction} noValidate className="grid gap-9">
      {hasErrors ? (
        <ErrorSummary
          errors={state.errors}
          formError={state.formError}
          describe={(key) => errorContext(section, key)}
          focusKey={state.nonce}
        />
      ) : null}

      <div className="grid gap-9">
        {section.fields.map((field) => (
          <IntakeFieldInput key={field.key} field={field} values={values} errors={state.errors} />
        ))}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        {backHref ? (
          <Link href={backHref} className={buttonClasses("ghost", "md", "text-muted hover:text-fg")}>
            <ArrowLeft size={16} weight="bold" aria-hidden />
            Back
          </Link>
        ) : (
          <span aria-hidden className="max-sm:hidden" />
        )}
        <SubmitButton size="lg" pendingLabel="Saving…" className="w-full sm:w-auto sm:px-7">
          {submitLabel}
          <ArrowRight size={18} weight="bold" aria-hidden />
        </SubmitButton>
      </div>
    </form>
  );
}
