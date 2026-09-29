"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import { FieldError, FieldHint, Input, Label } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import { joinWaitlist, type WaitlistState } from "./waitlist-action";

/** Email signup for when a state becomes supported. */
export function WaitlistForm({ stateCode, stateName }: { stateCode: string; stateName: string }) {
  const [state, action] = useActionState<WaitlistState, FormData>(joinWaitlist, undefined);

  if (state?.ok) {
    return (
      <div role="status" className="flex gap-3 rounded-[var(--radius-surface)] border border-accent/25 bg-accent-soft px-4 py-4">
        <CheckCircle size={22} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
        <div className="text-[15px]">
          <p className="font-semibold text-fg">Thanks. You&apos;re on the list.</p>
          <p className="mt-1 text-muted">
            We&apos;ll email you once we&apos;ve verified {stateName}&apos;s requirements from official sources. We
            won&apos;t use your email for anything else.
          </p>
        </div>
      </div>
    );
  }

  const emailError = state?.ok === false ? state.fieldErrors?.email : undefined;
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="stateCode" value={stateCode} />
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="waitlist-fw-hp">Leave this field empty</label>
        <input id="waitlist-fw-hp" name="fw_hp" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {state?.ok === false && state.error ? (
        <Notice tone="danger" role="alert">
          {state.error}
        </Notice>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="waitlist-email">Email</Label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            id="waitlist-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            className="sm:flex-1"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "waitlist-email-error" : "waitlist-email-hint"}
          />
          <SubmitButton size="lg" pendingLabel="Saving..." className="shrink-0">
            Tell me when it&apos;s supported
          </SubmitButton>
        </div>
        <FieldHint id="waitlist-email-hint">We&apos;ll only use it to tell you when {stateName} is supported.</FieldHint>
        <FieldError id="waitlist-email-error">{emailError}</FieldError>
      </div>
    </form>
  );
}
