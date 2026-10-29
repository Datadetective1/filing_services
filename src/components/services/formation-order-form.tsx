"use client";

import { useActionState, useState } from "react";
import type { ActionMessageState } from "@/components/funnel/types";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Formation order details: only what the provider needs to file, plus one contact. The state
 * and entity type were picked on the page above, so they ride along as hidden fields. The
 * registered agent add-on is never ticked for the customer.
 */
export function FormationOrderForm({
  action,
  stateCode,
  entityType,
  totalLabel,
  totalWithAgentLabel,
  agentRenewalLabel,
  agentTerms,
  askOwnerAddresses,
  prefill,
}: {
  action: (
    state: ActionMessageState,
    formData: FormData,
  ) => Promise<ActionMessageState>;
  stateCode: string;
  entityType: "llc" | "corporation";
  totalLabel: string;
  /** Null when registered agent service can't be added here. */
  totalWithAgentLabel: string | null;
  agentRenewalLabel: string | null;
  agentTerms: string[];
  askOwnerAddresses: boolean;
  prefill: { contactName: string; contactPhone: string };
}) {
  const [state, formAction] = useActionState(action, {});
  const [withAgent, setWithAgent] = useState(false);
  const isLlc = entityType === "llc";
  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="stateCode" value={stateCode} />
      <input type="hidden" name="entityType" value={entityType} />
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[16px] font-semibold text-fg">
          Your business
        </legend>
        <Field
          label="Business name"
          htmlFor="businessName"
          hint={
            isLlc
              ? 'Include "LLC" at the end. We check it is available before filing.'
              : 'Include "Inc." or "Corporation". We check it is available before filing.'
          }
        >
          <Input
            id="businessName"
            name="businessName"
            required
            maxLength={200}
            autoComplete="organization"
          />
        </Field>
        <Field
          label="Business street address"
          htmlFor="principalAddress"
          hint="Not a PO box. Your home address is fine."
        >
          <Input
            id="principalAddress"
            name="principalAddress"
            required
            maxLength={500}
            autoComplete="street-address"
          />
        </Field>
        <Field
          label={isLlc ? "Members (owners)" : "Directors"}
          htmlFor="owners"
          hint={
            askOwnerAddresses
              ? "Full name and home address for each, one per line."
              : "Full names, one per line."
          }
        >
          <Textarea
            id="owners"
            name="owners"
            required
            maxLength={2000}
            rows={3}
          />
        </Field>
        {isLlc ? (
          <fieldset className="grid gap-2">
            <legend className="text-[15px] font-semibold text-fg">
              Who runs the LLC?
            </legend>
            <label className="flex items-center gap-3 text-[15px] text-fg">
              <input
                type="radio"
                name="management"
                value="member"
                defaultChecked
                className="size-5 accent-[var(--accent)]"
              />
              The members (most small LLCs)
            </label>
            <label className="flex items-center gap-3 text-[15px] text-fg">
              <input
                type="radio"
                name="management"
                value="manager"
                className="size-5 accent-[var(--accent)]"
              />
              One or more managers
            </label>
          </fieldset>
        ) : null}
      </fieldset>
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[16px] font-semibold text-fg">
          Who should we contact?
        </legend>
        <Field label="Full name" htmlFor="contactName">
          <Input
            id="contactName"
            name="contactName"
            required
            maxLength={200}
            autoComplete="name"
            defaultValue={prefill.contactName}
          />
        </Field>
        <Field label="Phone" htmlFor="contactPhone">
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            inputMode="tel"
            required
            maxLength={30}
            autoComplete="tel"
            defaultValue={prefill.contactPhone}
          />
        </Field>
      </fieldset>
      {totalWithAgentLabel ? (
        <div className="grid gap-2 rounded-[var(--radius-control)] border border-border bg-surface p-4">
          <label className="flex items-start gap-3 text-[15px] text-fg">
            <Checkbox
              name="addRegisteredAgent"
              checked={withAgent}
              onChange={(e) => setWithAgent(e.target.checked)}
            />
            <span>
              Add registered agent service
              {agentRenewalLabel ? ` (${agentRenewalLabel} a year)` : ""}.{" "}
              <span className="text-muted">
                Optional. You can name any agent you like instead.
              </span>
            </span>
          </label>
          {withAgent ? (
            <>
              <label className="flex items-start gap-3 text-[15px] text-fg">
                <Checkbox name="acceptedTerms" required />
                <span>
                  Renews every year at {agentRenewalLabel} until I turn off
                  renewal.{" "}
                  <span className="text-muted">
                    You can turn it off any time from your dashboard.
                  </span>
                </span>
              </label>
              <div className="grid gap-1.5 pl-8 text-[13px] leading-5 text-muted">
                {agentTerms.map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
      {state.error ? (
        <Notice tone="danger" role="alert" title="We couldn't continue">
          <p>{state.error}</p>
        </Notice>
      ) : null}
      <SubmitButton
        size="lg"
        pendingLabel="Opening secure checkout…"
        className="w-full"
      >
        Pay{" "}
        {withAgent && totalWithAgentLabel ? totalWithAgentLabel : totalLabel}{" "}
        securely
      </SubmitButton>
    </form>
  );
}
