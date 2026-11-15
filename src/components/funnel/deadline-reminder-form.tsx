"use client";

import { BellSimpleRinging, CheckCircle } from "@phosphor-icons/react";
import { useActionState, useId, useState } from "react";
import type { DeadlineReminderState } from "@/app/(marketing)/reminders/signup-actions";
import { cn } from "@/components/ui/cn";
import { Checkbox, FieldError, Input, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Notice } from "@/components/ui/surface";
import type { ReminderSignupOptions } from "@/lib/reminders/signup-options";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * "Remind me before my deadline": a free sign-up on a state's pages for visitors who
 * aren't due yet. No account, explicit unticked consent, double opt-in.
 */
export function DeadlineReminderForm({
  action,
  options,
  page,
  title = "Not due yet? Get a free reminder",
  className,
}: {
  action: (state: DeadlineReminderState, formData: FormData) => Promise<DeadlineReminderState>;
  options: ReminderSignupOptions;
  /** The page path, for counting sign-ups by page. */
  page: string;
  title?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState<DeadlineReminderState, FormData>(action, undefined);
  const err = state?.ok === false ? state : undefined;
  const [entityType, setEntityType] = useState(err?.values?.entityType || options.entities[0].value);
  const id = useId();
  const f = (k: string) => `${id}-${k}`;
  const entity = options.entities.find((e) => e.value === entityType) ?? options.entities[0];
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 80 }, (_, i) => thisYear - i);
  const filing = options.filingName.toLowerCase();

  if (state?.ok) {
    return (
      <div role="status" className={cn("flex gap-3 rounded-[var(--radius-surface)] border border-accent/25 bg-accent-soft p-5", className)}>
        <CheckCircle size={22} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <div className="text-[15px]">
          <p className="font-semibold text-fg">Check your inbox to confirm</p>
          <p className="mt-1 leading-6 text-muted">
            We sent a confirmation link{state.email ? ` to ${state.email}` : ""}. Reminders start only after you click it.
          </p>
        </div>
      </div>
    );
  }

  const fe = err?.fieldErrors ?? {};
  const v = err?.values ?? {};
  // Remount fields with the typed values after a failed submit (React resets the form).
  const k = err ? JSON.stringify(v) : "empty";
  return (
    <form
      action={formAction}
      noValidate
      className={cn("relative grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-6", className)}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
          <BellSimpleRinging size={20} weight="fill" aria-hidden />
        </span>
        <p className="font-display text-lg font-semibold leading-tight text-fg">{title}</p>
      </div>
      <p className="-mt-1 text-sm leading-6 text-muted">
        We&apos;ll email you before your {options.stateName} {filing} is due. Free, no account.
      </p>

      <input type="hidden" name="stateCode" value={options.stateCode} />
      <input type="hidden" name="page" value={page} />
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={f("hp")}>Leave this field empty</label>
        <input id={f("hp")} name="fw_hp" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {err?.error ? (
        <Notice tone="danger" role="alert">
          {err.error}
        </Notice>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={f("name")}>Business name</Label>
        <Input
          id={f("name")}
          name="businessName"
          autoComplete="organization"
          maxLength={300}
          required
          defaultValue={v.businessName ?? ""}
          key={`n${k}`}
          aria-invalid={fe.businessName ? true : undefined}
          aria-describedby={fe.businessName ? f("name-error") : undefined}
        />
        <FieldError id={f("name-error")}>{fe.businessName}</FieldError>
      </div>

      {options.entities.length > 1 ? (
        <div className="grid gap-2">
          <Label htmlFor={f("type")}>Business type</Label>
          <Select
            id={f("type")}
            name="entityType"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as typeof entityType)}
            aria-invalid={fe.entityType ? true : undefined}
            aria-describedby={fe.entityType ? f("type-error") : undefined}
          >
            {options.entities.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>
          <FieldError id={f("type-error")}>{fe.entityType}</FieldError>
        </div>
      ) : (
        <input type="hidden" name="entityType" value={entity.value} />
      )}

      {entity.needsFormation ? (
        <fieldset className="grid gap-2" aria-describedby={fe.formed ? f("formed-error") : f("formed-hint")}>
          <legend className="mb-2 text-sm font-medium text-fg">Month it was formed</legend>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
            <Select name="month" aria-label="Month" defaultValue={v.month ?? ""} key={`m${k}`} aria-invalid={fe.formed ? true : undefined}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </Select>
            <Select name="year" aria-label="Year" defaultValue={v.year ?? ""} key={`y${k}`} aria-invalid={fe.formed ? true : undefined}>
              <option value="">Year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          {fe.formed ? (
            <FieldError id={f("formed-error")}>{fe.formed}</FieldError>
          ) : (
            <p id={f("formed-hint")} className="text-[13px] leading-5 text-subtle">
              In {options.stateName}, the due date follows this month.
            </p>
          )}
        </fieldset>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={f("email")}>Email</Label>
        <Input
          id={f("email")}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={v.email ?? ""}
          key={`e${k}`}
          aria-invalid={fe.email ? true : undefined}
          aria-describedby={fe.email ? f("email-error") : undefined}
        />
        <FieldError id={f("email-error")}>{fe.email}</FieldError>
      </div>

      <div className="grid gap-1">
        <label className="flex items-start gap-3 text-[13px] leading-5 text-muted">
          <Checkbox name="consent" value="yes" aria-describedby={fe.consent ? f("consent-error") : undefined} />
          <span>{options.consentText}</span>
        </label>
        <FieldError id={f("consent-error")}>{fe.consent}</FieldError>
      </div>

      <SubmitButton size="md" pendingLabel="Sending..." className="w-full">
        Email me before it&apos;s due
      </SubmitButton>
      <p className="text-xs leading-5 text-subtle">
        We use your email only for these reminders. See our{" "}
        <a href="/legal/privacy" className="underline">
          privacy notice
        </a>
        .
      </p>
    </form>
  );
}
