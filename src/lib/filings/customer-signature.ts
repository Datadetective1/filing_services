import type { StateAuthorization } from "@/lib/compliance/types";
import type { IntakeAnswers } from "@/lib/intake/validate";

/**
 * Customer-signed reports (Florida, Colorado, Montana): the customer signs the report
 * themselves and Filewell's operator enters that signature exactly as typed. Where the state
 * requires the signer to be one of the people listed in the report, these check it.
 * Pure helpers shared by the review page, the server action and authorizeFiling.
 */

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

/** The principal listed in the answers whose name matches the signer, or null. */
export function listedPrincipal(
  auth: Pick<StateAuthorization, "customerSignature">,
  values: IntakeAnswers,
  signerName: string,
): { name: string; title: string } | null {
  const ps = auth.customerSignature;
  if (!ps?.principalsKey) return null;
  const people = values[ps.principalsKey];
  if (!Array.isArray(people)) return null;
  const want = norm(signerName);
  for (const p of people) {
    if (p && typeof p === "object" && typeof (p as { name?: unknown }).name === "string" && norm((p as { name: string }).name) === want) {
      const title = typeof (p as { title?: unknown }).title === "string" ? (p as { title: string }).title : "";
      return { name: (p as { name: string }).name, title };
    }
  }
  return null;
}

/** Why a signer can't sign this report, or null when they can (always null when the state lists no people). */
export function principalSignerProblem(
  auth: Pick<StateAuthorization, "customerSignature">,
  values: IntakeAnswers,
  signer: { name: string; title: string },
): string | null {
  if (!auth.customerSignature?.principalsKey) return null;
  const listed = listedPrincipal(auth, values, signer.name);
  if (!listed) return "The person who signs must be one of the people listed in this report. Enter your name exactly as you listed it, or add yourself to the list.";
  if (listed.title && norm(listed.title) !== norm(signer.title)) {
    return `Use the title you listed for yourself in this report (${listed.title}).`;
  }
  return null;
}
