"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { site } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { authorizeFiling } from "@/lib/filings/customer";
import type { AuthorizeFormState } from "@/components/intake/types";
import { FILING_ID_RE, friendlyError } from "../../_lib/errors";
import { loadOwnFiling } from "../../_lib/filing";

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
  const values = {
    signerName: str("signerName"),
    signerTitle: str("signerTitle"),
    attest: formData.get("attest") === "on",
    authorize: formData.get("authorize") === "on",
  };
  if (!FILING_ID_RE.test(filingId)) return { errors: {}, formError: "This form is out of date. Reload the page and try again.", values, nonce };

  const user = await requireUser(`/file/${filingId}/review`);
  const parsed = authorizeSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { errors, values, nonce };
  }

  const loaded = await loadOwnFiling(user, filingId);
  if (!loaded) return { errors: {}, formError: "We couldn't find this filing on your account.", values, nonce };
  const wasDraft = loaded.filing.status === "draft";

  try {
    await authorizeFiling(user, filingId, {
      signerName: parsed.data.signerName,
      signerTitle: parsed.data.signerTitle,
      attest: parsed.data.attest,
      authorize: parsed.data.authorize,
      brand: site.name,
    });
  } catch (e) {
    return { errors: {}, formError: friendlyError(e), values, nonce };
  }

  redirect(wasDraft ? `/file/${filingId}/checkout` : `/dashboard/filings/${filingId}`);
}
