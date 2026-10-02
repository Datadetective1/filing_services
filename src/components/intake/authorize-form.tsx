"use client";

import { PenNib } from "@phosphor-icons/react";
import Link from "next/link";
import { site } from "@/config/site";
import { useActionState } from "react";
import { Checkbox, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { LabeledInput } from "./fields";
import { ErrorSummary } from "./intake-form";
import { type AuthorizeFormState, fieldId } from "./types";

const LABELS: Record<string, string> = {
  signerName: "Your full name",
  signerTitle: "Your title or role",
  attest: "Accuracy confirmation",
  authorize: "Filing authorization",
  certifyFacts: "Filing information confirmation",
  agentConsentMode: "Registered agent consent",
  agentConsent: "Consent to serve as registered agent",
};

const choiceClasses =
  "flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 py-3.5 text-[15px] text-fg transition-[border-color,box-shadow] hover:border-fg/35 has-[:checked]:border-accent has-[:checked]:ring-1 has-[:checked]:ring-accent";

/**
 * Attestation + authorization to file. The full authorization text is shown
 * verbatim; the server records it with a hash of the answers being authorized.
 */
export function AuthorizeForm({
  action,
  defaults,
  authorizationText,
  titleSuggestions,
  submitLabel,
  certify,
  agentConsent,
}: {
  action: (state: AuthorizeFormState, formData: FormData) => Promise<AuthorizeFormState>;
  defaults: { signerName: string; signerTitle: string };
  authorizationText: string;
  titleSuggestions: string[];
  submitLabel: string;
  /** State-specific: the customer confirms the full packet the filing agent will certify. */
  certify?: { stateName: string; filingAgent: string; certificationText: string };
  /** The registered agent changes: the new agent's own consent is required. */
  agentConsent?: { agentName: string; consentText: string };
}) {
  const [state, formAction] = useActionState(action, { errors: {}, nonce: 0 });
  const v = state.values ?? { ...defaults, attest: false, authorize: false, certifyFacts: false, agentConsentMode: "" as const, agentConsent: false };
  const hasErrors = Object.keys(state.errors).length > 0 || Boolean(state.formError);

  return (
    <form key={state.nonce} action={formAction} noValidate className="grid gap-7">
      {hasErrors ? (
        <ErrorSummary errors={state.errors} formError={state.formError} describe={(k) => LABELS[k] ?? ""} focusKey={state.nonce} />
      ) : null}

      <div className="grid items-start gap-5 sm:grid-cols-2">
        <LabeledInput
          name="signerName"
          label="Your full name"
          value={v.signerName}
          error={state.errors.signerName}
          required
          maxLength={200}
          autoComplete="name"
        />
        <LabeledInput
          name="signerTitle"
          label="Your title or role"
          hint="For example: Member, Manager, President."
          value={v.signerTitle}
          error={state.errors.signerTitle}
          required
          maxLength={100}
          list="signer-title-suggestions"
          autoComplete="organization-title"
        />
        <datalist id="signer-title-suggestions">
          {titleSuggestions.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>

      <div className="grid gap-2.5">
        <h3 className="text-[15px] font-semibold text-fg">What you&apos;re authorizing</h3>
        <p
          id="authorization-text"
          tabIndex={0}
          className="max-h-64 overflow-y-auto rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3.5 text-[15px] leading-7 text-fg shadow-[0_1px_2px_rgb(23_35_29/0.04)] outline-none focus-visible:ring-4 focus-visible:ring-accent/15"
        >
          {authorizationText}
        </p>
        <p className="text-sm leading-6 text-muted">
          Read the full{" "}
          <Link href="/legal/filing-authorization" target="_blank" rel="noopener" className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
            filing authorization
          </Link>
          ,{" "}
          <Link href="/legal/terms" target="_blank" rel="noopener" className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
            terms of service
          </Link>{" "}
          and{" "}
          <Link href="/legal/refunds" target="_blank" rel="noopener" className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
            refund policy
          </Link>
          <span className="sr-only"> (open in a new tab)</span>.
        </p>
      </div>

      {agentConsent ? (
        <fieldset className="grid gap-3 rounded-[var(--radius-control)] border border-border bg-surface p-4 sm:p-5" aria-describedby="agent-consent-help">
          <legend className="px-1 text-[15px] font-semibold text-fg">Your new registered agent&apos;s consent</legend>
          <p id="agent-consent-help" className="text-sm leading-6 text-muted">
            Washington won&apos;t accept a new registered agent (or a new agent street address) without the agent&apos;s own consent to
            serve. We never give it for them. Who is the registered agent, <span className="font-semibold text-fg">{agentConsent.agentName}</span>?
          </p>
          <label htmlFor={fieldId("agentConsentMode")} className={choiceClasses}>
            <input
              type="radio"
              id={fieldId("agentConsentMode")}
              name="agentConsentMode"
              value="signer_is_agent"
              defaultChecked={v.agentConsentMode === "signer_is_agent"}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>I am the registered agent (or I sign for the business or position that serves as the agent), and I consent below.</span>
          </label>
          <label htmlFor={fieldId("agentConsentMode-other")} className={choiceClasses}>
            <input
              type="radio"
              id={fieldId("agentConsentMode-other")}
              name="agentConsentMode"
              value="agent_to_sign"
              defaultChecked={v.agentConsentMode === "agent_to_sign"}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span>
              Someone else is the agent. I&apos;ll send their signed Washington consent to serve; you won&apos;t file until you have it.
            </span>
          </label>
          <FieldError id={`${fieldId("agentConsentMode")}-error`}>{state.errors.agentConsentMode}</FieldError>
          <div className="grid gap-1.5">
            <label htmlFor={fieldId("agentConsent")} className={choiceClasses}>
              <Checkbox
                id={fieldId("agentConsent")}
                name="agentConsent"
                defaultChecked={v.agentConsent}
                aria-invalid={state.errors.agentConsent ? true : undefined}
                aria-describedby={state.errors.agentConsent ? `${fieldId("agentConsent")}-error` : undefined}
                className="mt-1"
              />
              <span>
                <span className="font-semibold">Only if you are the agent:</span> &ldquo;{agentConsent.consentText}&rdquo;
              </span>
            </label>
            <FieldError id={`${fieldId("agentConsent")}-error`}>{state.errors.agentConsent}</FieldError>
          </div>
        </fieldset>
      ) : null}

      <div className="grid gap-3">
        {certify ? (
          <div className="grid gap-1.5">
            <label htmlFor={fieldId("certifyFacts")} className={choiceClasses}>
              <Checkbox
                id={fieldId("certifyFacts")}
                name="certifyFacts"
                defaultChecked={v.certifyFacts}
                required
                aria-invalid={state.errors.certifyFacts ? true : undefined}
                aria-describedby={state.errors.certifyFacts ? `${fieldId("certifyFacts")}-error` : undefined}
                className="mt-1"
              />
              <span>
                I reviewed every item of the {certify.stateName} filing information above and it is true and correct. I understand{" "}
                {certify.filingAgent} will certify to the state, relying on my confirmation: &ldquo;{certify.certificationText}&rdquo;
              </span>
            </label>
            <FieldError id={`${fieldId("certifyFacts")}-error`}>{state.errors.certifyFacts}</FieldError>
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <label
            htmlFor={fieldId("attest")}
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 py-3.5 text-[15px] text-fg transition-[border-color,box-shadow] hover:border-fg/35 has-[:checked]:border-accent has-[:checked]:ring-1 has-[:checked]:ring-accent"
          >
            <Checkbox
              id={fieldId("attest")}
              name="attest"
              defaultChecked={v.attest}
              required
              aria-invalid={state.errors.attest ? true : undefined}
              aria-describedby={state.errors.attest ? `${fieldId("attest")}-error` : undefined}
              className="mt-1"
            />
            <span>I confirm the information above is accurate and complete.</span>
          </label>
          <FieldError id={`${fieldId("attest")}-error`}>{state.errors.attest}</FieldError>
        </div>
        <div className="grid gap-1.5">
          <label
            htmlFor={fieldId("authorize")}
            className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border-strong bg-surface px-4 py-3.5 text-[15px] text-fg transition-[border-color,box-shadow] hover:border-fg/35 has-[:checked]:border-accent has-[:checked]:ring-1 has-[:checked]:ring-accent"
          >
            <Checkbox
              id={fieldId("authorize")}
              name="authorize"
              defaultChecked={v.authorize}
              required
              aria-invalid={state.errors.authorize ? true : undefined}
              aria-describedby={[state.errors.authorize ? `${fieldId("authorize")}-error` : "", "authorization-text"].filter(Boolean).join(" ")}
              className="mt-1"
            />
            <span>
              I authorize {site.name} to act for the business as described in the authorization above, and I agree to the Terms
              of Service and Refund Policy.
            </span>
          </label>
          <FieldError id={`${fieldId("authorize")}-error`}>{state.errors.authorize}</FieldError>
        </div>
      </div>

      <div className="border-t border-border-strong/60 pt-6">
        <SubmitButton size="lg" pendingLabel="Saving…" className="w-full sm:w-auto sm:px-7">
          <PenNib size={18} weight="fill" aria-hidden />
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
