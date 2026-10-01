"use client";

import { BellSimpleRinging, CheckCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { Checkbox, FieldError, Input, Label } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/components/ui/cn";
import type { ReminderOptInState } from "@/app/(marketing)/find/reminder-actions";
import { REMINDER_CONSENT_TEXT } from "@/lib/reminders/consent";

/**
 * "Remind me about my Pennsylvania filing": free, no account, explicit unticked consent,
 * double opt-in. The business comes from the visitor's own lookup on the server.
 */
export function ReminderOptIn({
  action,
  businessName,
  className,
}: {
  action: (state: ReminderOptInState, formData: FormData) => Promise<ReminderOptInState>;
  businessName: string;
  className?: string;
}) {
  const [state, formAction] = useActionState<ReminderOptInState, FormData>(action, undefined);

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

  const err = state?.ok === false ? state : undefined;
  return (
    <form action={formAction} noValidate className={cn("grid gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6", className)}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-highlight-soft text-highlight-fg">
          <BellSimpleRinging size={20} weight="fill" aria-hidden />
        </span>
        <p className="font-display text-lg font-semibold leading-tight text-fg">Remind me about my Pennsylvania filing</p>
      </div>
      <p className="text-sm leading-6 text-muted">
        Free, no account, nothing to buy. We&apos;ll email you before {businessName}&apos;s next annual report due date.
      </p>
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="reminder-fw-hp">Leave this field empty</label>
        <input id="reminder-fw-hp" name="fw_hp" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {err?.error ? (
        <Notice tone="danger" role="alert">
          {err.error}
        </Notice>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="reminder-email">Email</Label>
        <Input
          id="reminder-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          aria-invalid={err?.fieldErrors?.email ? true : undefined}
          aria-describedby={err?.fieldErrors?.email ? "reminder-email-error" : undefined}
        />
        <FieldError id="reminder-email-error">{err?.fieldErrors?.email}</FieldError>
      </div>
      <div className="grid gap-1">
        <label className="flex items-start gap-3 text-sm leading-6 text-fg">
          <Checkbox name="consent" value="yes" aria-describedby={err?.fieldErrors?.consent ? "reminder-consent-error" : undefined} />
          <span>{REMINDER_CONSENT_TEXT}</span>
        </label>
        <FieldError id="reminder-consent-error">{err?.fieldErrors?.consent}</FieldError>
      </div>
      <SubmitButton size="md" pendingLabel="Sending..." className="w-full">
        Email me reminders
      </SubmitButton>
      <p className="text-xs leading-5 text-subtle">
        We use your email only for these reminders. See our <a href="/legal/privacy" className="underline">privacy notice</a>.
      </p>
    </form>
  );
}
