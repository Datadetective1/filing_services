"use client";

import { useActionState } from "react";
import type { ActionMessageState } from "@/components/funnel/types";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Registered agent order details. The provider can ask for the business's communications
 * contact (a real person, a physical address and a phone number) at short notice, so we
 * collect it before payment rather than chasing it later.
 */
export function ServiceOrderForm({
  action,
  businessId,
  service,
  situation,
  dueTodayLabel,
  renewalTerms,
}: {
  action: (state: ActionMessageState, formData: FormData) => Promise<ActionMessageState>;
  businessId: string;
  service: string;
  situation: "switching" | "new_entity";
  dueTodayLabel: string;
  renewalTerms: string[];
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="service" value={service} />
      <input type="hidden" name="situation" value={situation} />
      {situation === "switching" ? (
        <Field
          label="Your current registered agent"
          htmlFor="currentAgentName"
          hint="As the state lists it today. We use it to file the change with the state."
        >
          <Input id="currentAgentName" name="currentAgentName" required maxLength={200} autoComplete="off" />
        </Field>
      ) : null}
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[15px] font-semibold text-fg">Contact for this business</legend>
        <p className="-mt-2 text-sm text-muted">
          A real person we and our registered agent provider can reach about this business. We never publish it.
        </p>
        <Field label="Full name" htmlFor="contactName">
          <Input id="contactName" name="contactName" required maxLength={200} autoComplete="name" />
        </Field>
        <Field label="Phone" htmlFor="contactPhone">
          <Input id="contactPhone" name="contactPhone" type="tel" required maxLength={30} autoComplete="tel" />
        </Field>
        <Field label="Physical address" htmlFor="contactAddress" hint="Street address, city, state and ZIP. Not a PO box.">
          <Textarea id="contactAddress" name="contactAddress" required maxLength={500} rows={3} autoComplete="street-address" />
        </Field>
      </fieldset>
      <div className="grid gap-2 rounded-[var(--radius-control)] border border-border bg-surface-2 px-4 py-3.5 text-sm text-muted">
        {renewalTerms.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
      <label className="flex items-start gap-3 text-[15px] text-fg">
        <Checkbox name="acceptedTerms" required />
        <span>I understand how renewal and cancellation work.</span>
      </label>
      {state.error ? (
        <Notice tone="danger" role="alert" title="We couldn't continue">
          <p>{state.error}</p>
        </Notice>
      ) : null}
      <SubmitButton size="lg" pendingLabel="Opening secure checkout…" className="w-full">
        Continue to payment ({dueTodayLabel} today)
      </SubmitButton>
    </form>
  );
}

/** Turn renewal off, or back on. */
export function RenewalForm({
  action,
  subscriptionId,
  renew,
  label,
}: {
  action: (state: ActionMessageState, formData: FormData) => Promise<ActionMessageState>;
  subscriptionId: string;
  renew: boolean;
  label: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="renew" value={String(renew)} />
      {state.error ? (
        <Notice tone="danger" role="alert">
          <p>{state.error}</p>
        </Notice>
      ) : null}
      <SubmitButton variant={renew ? "primary" : "secondary"} pendingLabel="Saving…">
        {label}
      </SubmitButton>
    </form>
  );
}
