"use client";

import { useActionState } from "react";
import type { ActionMessageState } from "@/components/funnel/types";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Registered agent order details. Only what the provider can ask for at short notice (a real
 * contact person, a phone number and a street address) is required before payment, and it
 * opens filled in from what we already know. The current agent is optional: it is on the
 * state record and an operator checks it before filing the change.
 */
export function ServiceOrderForm({
  action,
  businessId,
  service,
  situation,
  dueTodayLabel,
  renewalLabel,
  renewalTerms,
  prefill,
  askOwners = false,
}: {
  action: (state: ActionMessageState, formData: FormData) => Promise<ActionMessageState>;
  businessId: string;
  service: string;
  situation: "switching" | "new_entity";
  dueTodayLabel: string;
  renewalLabel: string | null;
  renewalTerms: string[];
  prefill: { contactName: string; contactPhone: string; contactAddress: string; currentAgentName: string };
  /** The jurisdiction's provider needs the owners' names and home addresses (Wyoming). */
  askOwners?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="service" value={service} />
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[16px] font-semibold text-fg">Who should we contact about legal mail?</legend>
        <Field label="Full name" htmlFor="contactName">
          <Input id="contactName" name="contactName" required maxLength={200} autoComplete="name" defaultValue={prefill.contactName} />
        </Field>
        <Field label="Phone" htmlFor="contactPhone">
          <Input id="contactPhone" name="contactPhone" type="tel" inputMode="tel" required maxLength={30} autoComplete="tel" defaultValue={prefill.contactPhone} />
        </Field>
        <Field label="Street address" htmlFor="contactAddress" hint="Not a PO box. Never published.">
          <Input id="contactAddress" name="contactAddress" required maxLength={500} autoComplete="street-address" defaultValue={prefill.contactAddress} />
        </Field>
        {askOwners ? (
          <Field
            label="Owners"
            htmlFor="beneficialOwners"
            hint="Full name and home address for each owner, one per line. Wyoming requires your agent to keep this. Never published."
          >
            <Textarea id="beneficialOwners" name="beneficialOwners" required maxLength={2000} rows={3} />
          </Field>
        ) : null}
        {situation === "switching" ? (
          <Field label="Current registered agent (optional)" htmlFor="currentAgentName" hint="Skip it if you're not sure. We check the state record.">
            <Input id="currentAgentName" name="currentAgentName" maxLength={200} autoComplete="off" defaultValue={prefill.currentAgentName} />
          </Field>
        ) : null}
      </fieldset>
      <label className="flex items-start gap-3 text-[15px] text-fg">
        <Checkbox name="acceptedTerms" required />
        <span>
          {renewalLabel ? `Renews every year at ${renewalLabel} until I turn off renewal.` : "I agree to the terms of this order."}{" "}
          <span className="text-muted">You can turn it off any time from your dashboard.</span>
        </span>
      </label>
      {/* Kept in view next to the consent, as auto-renewal rules expect. */}
      <div className="-mt-2 grid gap-1.5 pl-8 text-[13px] leading-5 text-muted">
        {renewalTerms.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
      {state.error ? (
        <Notice tone="danger" role="alert" title="We couldn't continue">
          <p>{state.error}</p>
        </Notice>
      ) : null}
      <SubmitButton size="lg" pendingLabel="Opening secure checkout…" className="w-full">
        Pay {dueTodayLabel} securely
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
