import type { StateAuthorization } from "@/lib/compliance/types";
import type { IntakeAnswers } from "@/lib/intake/validate";

/**
 * Florida-style signing: the state requires one of the business's own principals to sign,
 * and Filewell's operator only types that person's name and title with their permission.
 * Pure helpers shared by the review page, the server action and authorizeFiling.
 */

const norm = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

/** The principal listed in the answers whose name matches the signer, or null. */
export function listedPrincipal(
  auth: Pick<StateAuthorization, "principalSignature">,
  values: IntakeAnswers,
  signerName: string,
): { name: string; title: string } | null {
  const ps = auth.principalSignature;
  if (!ps) return null;
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

/** Why a signer can't sign for a principal-signature state, or null when they can. */
export function principalSignerProblem(
  auth: Pick<StateAuthorization, "principalSignature">,
  values: IntakeAnswers,
  signer: { name: string; title: string },
): string | null {
  if (!auth.principalSignature) return null;
  const listed = listedPrincipal(auth, values, signer.name);
  if (!listed) return "The person who signs must be one of the principals listed in this report. Enter your name exactly as you listed it, or add yourself as a principal.";
  if (listed.title && norm(listed.title) !== norm(signer.title)) {
    return `Use the title you listed for yourself in this report (${listed.title}).`;
  }
  return null;
}
