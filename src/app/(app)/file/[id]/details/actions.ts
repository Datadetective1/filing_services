"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { acceptPrefill, saveIntakeSection } from "@/lib/filings/customer";
import { formDataToSectionAnswers } from "@/components/intake/form-data";
import type { IntakeFormState } from "@/components/intake/types";
import { FILING_ID_RE, friendlyError } from "../../_lib/errors";
import { loadOwnFiling } from "../../_lib/filing";

const argsSchema = z.object({
  filingId: z.string().regex(FILING_ID_RE),
  sectionKey: z.string().regex(/^[a-z0-9_]{1,40}$/),
});

/**
 * Save one intake section. The filing id and section key are bound on the server
 * page, but are re-validated here and ownership is re-checked from the session.
 */
export async function saveSectionAction(
  filingId: string,
  sectionKey: string,
  _prev: IntakeFormState,
  formData: FormData,
): Promise<IntakeFormState> {
  const nonce = Date.now();
  const args = argsSchema.safeParse({ filingId, sectionKey });
  if (!args.success) return { errors: {}, formError: "This form is out of date. Reload the page and try again.", nonce };

  const user = await requireUser(`/file/${args.data.filingId}/details`);
  const loaded = await loadOwnFiling(user, args.data.filingId);
  if (!loaded) return { errors: {}, formError: "We couldn't find this filing on your account.", nonce };
  const sections = loaded.schema.sections;
  const section = sections.find((s) => s.key === args.data.sectionKey);
  if (!section) return { errors: {}, formError: "This form is out of date. Reload the page and try again.", nonce };

  const values = formDataToSectionAnswers(formData, section);

  let result: Awaited<ReturnType<typeof saveIntakeSection>>;
  try {
    result = await saveIntakeSection(user, filingId, section.key, values);
  } catch (e) {
    return { errors: {}, formError: friendlyError(e), values, nonce };
  }
  if (!result.ok) return { errors: result.errors, values, nonce };

  // Walk the sections in order: the next one the customer hasn't been through yet,
  // then the review page once everything is complete.
  const order = sections.map((s) => s.key);
  const visited = new Set([...loaded.completedSteps, section.key]);
  const next = order.slice(order.indexOf(section.key) + 1).find((k) => !visited.has(k));
  if (next) redirect(`/file/${filingId}/details?step=${encodeURIComponent(next)}`);
  if (result.isComplete) redirect(`/file/${filingId}/review`);
  redirect(`/file/${filingId}/details?step=${encodeURIComponent(result.nextIncomplete ?? order[0])}`);
}

/** "Nothing has changed": keep the prefilled values and go to what's still missing, or review. */
export async function acceptPrefillAction(filingId: string): Promise<void> {
  if (!FILING_ID_RE.test(filingId)) redirect("/dashboard");
  const user = await requireUser(`/file/${filingId}/details`);
  let result: Awaited<ReturnType<typeof acceptPrefill>>;
  try {
    result = await acceptPrefill(user, filingId);
  } catch {
    redirect(`/file/${filingId}/details`);
  }
  if (result.isComplete) redirect(`/file/${filingId}/review`);
  redirect(`/file/${filingId}/details?step=${encodeURIComponent(result.nextIncomplete ?? "")}&prefill=missing`);
}
