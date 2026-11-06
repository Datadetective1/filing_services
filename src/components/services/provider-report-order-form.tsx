"use client";

import Link from "next/link";
import type { ActionMessageState } from "@/components/funnel/types";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { SubmitButton } from "@/components/ui/submit-button";
import { useSubmitAction } from "@/components/ui/use-submit-action";

/**
 * Annual report details for a state Filewell doesn't file itself: only what the report asks
 * for, plus one contact. State and entity type were picked above and ride along hidden.
 */
export function ProviderReportOrderForm({
  action,
  stateCode,
  stateName,
  entityType,
  totalLabel,
  prefill,
}: {
  action: (state: ActionMessageState, formData: FormData) => Promise<ActionMessageState>;
  stateCode: string;
  stateName: string;
  entityType: "llc" | "corporation";
  totalLabel: string;
  prefill: { businessId: string | null; businessName: string; entityNumber: string; contactName: string; contactPhone: string };
}) {
  const [state, onSubmit, pending] = useSubmitAction(action);
  const isLlc = entityType === "llc";
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name="stateCode" value={stateCode} />
      <input type="hidden" name="entityType" value={entityType} />
      {prefill.businessId ? <input type="hidden" name="businessId" value={prefill.businessId} /> : null}
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[16px] font-semibold text-fg">Your business</legend>
        <Field label="Legal name" htmlFor="businessName" hint="As the state lists it.">
          <Input id="businessName" name="businessName" required maxLength={200} defaultValue={prefill.businessName} />
        </Field>
        <Field label={`${stateName} file number`} htmlFor="entityNumber" optional hint="If you have it. We look it up if not.">
          <Input id="entityNumber" name="entityNumber" maxLength={30} defaultValue={prefill.entityNumber} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Formed in ${stateName}?`} htmlFor="formedHere">
            <Select id="formedHere" name="formedHere" defaultValue="yes">
              <option value="yes">Yes</option>
              <option value="no">No, it&apos;s registered from another state</option>
            </Select>
          </Field>
          <Field label="Is this report late?" htmlFor="pastDue">
            <Select id="pastDue" name="pastDue" defaultValue="no">
              <option value="no">No</option>
              <option value="yes">Yes, it&apos;s past due</option>
            </Select>
          </Field>
        </div>
        <Field label="Principal street address" htmlFor="principalAddress" hint="Not a PO box.">
          <Input id="principalAddress" name="principalAddress" required maxLength={500} autoComplete="street-address" />
        </Field>
        <Field
          label={isLlc ? "Members or managers" : "Officers and directors"}
          htmlFor="people"
          hint={isLlc ? "One per line: name and address." : "One per line: name, title and address."}
        >
          <Textarea id="people" name="people" required rows={3} maxLength={2000} />
        </Field>
        <Field label="Anything changed since the last report?" htmlFor="changes" optional>
          <Textarea id="changes" name="changes" rows={2} maxLength={2000} />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-[16px] font-semibold text-fg">Who should we contact?</legend>
        <Field label="Full name" htmlFor="contactName">
          <Input id="contactName" name="contactName" required maxLength={200} autoComplete="name" defaultValue={prefill.contactName} />
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
      <label className="flex items-start gap-3 text-[15px] text-fg">
        <Checkbox name="acceptedTerms" required />
        <span>
          I agree to the{" "}
          <Link
            href="/legal/business-services"
            target="_blank"
            className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
          >
            terms
          </Link>
          .
        </span>
      </label>
      {state.error ? (
        <Notice tone="danger" role="alert" title="We couldn't continue">
          <p>{state.error}</p>
        </Notice>
      ) : null}
      <SubmitButton pending={pending} size="lg" pendingLabel="Opening secure checkout…" className="w-full">
        Pay {totalLabel} securely
      </SubmitButton>
    </form>
  );
}
