"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { site } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { authorizeFiling, startCheckout, stateAuthorizationFor } from "@/lib/filings/customer";
import { rateLimit } from "@/lib/security/rate-limit";
import { principalSignerProblem } from "@/lib/filings/customer-signature";
import { registeredAgentConsentRequired } from "@/lib/filings/packet";
import { validateAll } from "@/lib/intake/validate";
import type { AuthorizeFormState } from "@/components/intake/types";
import { FILING_ID_RE, friendlyError } from "../../_lib/errors";
import { directPaymentTotal, loadOwnFiling } from "../../_lib/filing";

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

const authorizeSchema = z.object({
  signerName: z
    .string()
    .transform(collapse)
    .pipe(z.string().min(2, "Enter your full name.").max(200, "Use 200 characters or fewer.")),
  signerTitle: z
    .string()
    .transform(collapse)
    .pipe(z.string().min(2, "Enter your title or role.").max(100, "Use 100 characters or fewer.")),
  attest: z.literal(true, { error: "Confirm that the information is accurate and complete." }),
  authorize: z.literal(true, { error: "Authorize us to prepare and submit the filing." }),
});

/** Record the customer's attestation and authorization, then continue to payment. */
export async function authorizeAction(filingId: string, _prev: AuthorizeFormState, formData: FormData): Promise<AuthorizeFormState> {
  const nonce = Date.now();
  const str = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.slice(0, 400) : "";
  };
  const mode = str("agentConsentMode");
  const values = {
    signerName: str("signerName"),
    signerTitle: str("signerTitle"),
    attest: formData.get("attest") === "on",
    authorize: formData.get("authorize") === "on",
    certifyFacts: formData.get("certifyFacts") === "on",
    agentConsentMode: (mode === "signer_is_agent" || mode === "agent_to_sign" ? mode : "") as "signer_is_agent" | "agent_to_sign" | "",
    agentConsent: formData.get("agentConsent") === "on",
    permitTypedSignature: formData.get("permitTypedSignature") === "on",
  };
  if (!FILING_ID_RE.test(filingId)) return { errors: {}, formError: "This form is out of date. Reload the page and try again.", values, nonce };

  const user = await requireUser(`/file/${filingId}/review`);
  const parsed = authorizeSchema.safeParse({ signerName: values.signerName, signerTitle: values.signerTitle, attest: values.attest, authorize: values.authorize });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { errors, values, nonce };
  }

  const loaded = await loadOwnFiling(user, filingId);
  if (!loaded) return { errors: {}, formError: "We couldn't find this filing on your account.", values, nonce };
  const wasDraft = loaded.filing.status === "draft";

  // State-specific confirmations (Washington; customer-signed reports in FL, CO, MT). The server re-checks all of this.
  const stateAuth = stateAuthorizationFor(loaded.filing.state_code, loaded.business);
  if (stateAuth) {
    const errors: Record<string, string> = {};
    if (!values.certifyFacts) errors.certifyFacts = "Confirm you reviewed every item and that it is true and correct.";
    const answers = validateAll(loaded.schema, loaded.answers).values;
    if (stateAuth.auth.customerSignature) {
      if (!values.permitTypedSignature) errors.permitTypedSignature = "Tick the box to sign the report with your name and title.";
      const problem = principalSignerProblem(stateAuth.auth, answers, { name: parsed.data.signerName, title: parsed.data.signerTitle });
      if (problem) errors.signerName = problem;
    }
    if (registeredAgentConsentRequired(stateAuth.auth, answers)) {
      if (!values.agentConsentMode) errors.agentConsentMode = "Tell us who the new registered agent is.";
      else if (values.agentConsentMode === "signer_is_agent" && !values.agentConsent) {
        errors.agentConsent = "Tick the consent to serve, or choose that someone else is the agent.";
      }
    }
    if (Object.keys(errors).length) return { errors, values, nonce };
  }

  try {
    await authorizeFiling(user, filingId, {
      signerName: parsed.data.signerName,
      signerTitle: parsed.data.signerTitle,
      attest: parsed.data.attest,
      authorize: parsed.data.authorize,
      brand: site.name,
      certifyFacts: values.certifyFacts,
      agentConsent: { mode: values.agentConsentMode, consent: values.agentConsent },
      permitTypedSignature: values.permitTypedSignature,
      legalEntity: { name: site.legalEntity, configured: site.legalEntityConfigured },
    });
  } catch (e) {
    return { errors: {}, formError: friendlyError(e), values, nonce };
  }

  if (!wasDraft) redirect(`/dashboard/filings/${filingId}`);
  // Signing is the last step: go straight to the secure payment page when nothing on the
  // payment page needs a look first. Any problem falls back to the payment page.
  if (values.agentConsentMode !== "agent_to_sign" && (await directPaymentTotal(loaded)) !== null) {
    const allowed =
      (await rateLimit(`checkout:user:${user.id}`, 10, 600, { failClosed: true })) &&
      (await rateLimit(`checkout:filing:${filingId}`, 6, 600, { failClosed: true }));
    if (allowed) {
      let url: string | null = null;
      try {
        ({ url } = await startCheckout(user, filingId));
      } catch {
        url = null;
      }
      if (url) redirect(url);
    }
  }
  redirect(`/file/${filingId}/checkout`);
}
