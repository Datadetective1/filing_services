import type { EntityType } from "@/lib/domain/types";

/**
 * Questions only the state (or the owner, inside the state's portal) can answer, whose
 * answers decide whether Filewell can lawfully and practically file for a customer.
 *
 * Fail closed: while a state/entity has an open question, production checkout refuses it
 * (even if <STATE>_LIVE_FILING_SALES is set) and no filing for it may be marked ready,
 * started or submitted anywhere. A question is closed by removing it here in a reviewed
 * change that records the answer (and, if needed, a new rule version).
 */
export interface OpenQuestion {
  key: string;
  stateCode: string;
  /** Entity types it blocks; all of the state's types when omitted. */
  entityTypes?: EntityType[];
  /** What is unresolved, for operators and the launch checks. */
  summary: string;
  /** Who answers it. */
  answeredBy: string;
}

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    key: "nv_signer_authority",
    stateCode: "NV",
    entityTypes: ["llc", "lp", "llp"],
    summary:
      "NRS 76.100(3) says the State Business License application is signed by a manager or managing member (LLC), a general partner (LP) or a managing partner (LLP); only corporations may use \"some other person specifically authorized\". The annual list itself allows an authorized person. Until the Nevada Secretary of State confirms an authorized filing agent may sign the combined annual list and business license for these entities, Filewell does not sell or file them.",
    answeredBy: "Nevada Secretary of State (Commercial Recordings), confirmed with counsel",
  },
  {
    key: "nv_orion_client_access",
    stateCode: "NV",
    summary:
      "Whether ORION lets a filing service's account file an annual list for a client's entity, and what it requires first (a client PIN, an authorization code, linking the entity, or a service-company account).",
    answeredBy: "Nevada Secretary of State, and the owner inside ORION",
  },
  {
    key: "ut_sb40_operations",
    stateCode: "UT",
    summary:
      "How the Division applies S.B. 40 (effective 2026-10-01): when the $10 late fee now applies, and how renewals whose anniversary falls around the transition are handled. (Filewell never charges the $10 without the Division's own record showing it applies.)",
    answeredBy: "Utah Division of Corporations",
  },
  {
    key: "ut_third_party_filing",
    stateCode: "UT",
    summary:
      "How a filing service files for a customer: whether Filing Authority / designated-user setup or other customer authorization is required, and which signer title an authorized agent selects on the signature page.",
    answeredBy: "Utah Division of Corporations, and the owner inside the UtahID portal",
  },
];

export function openQuestionsFor(stateCode: string, entityType?: string | null): OpenQuestion[] {
  return OPEN_QUESTIONS.filter(
    (q) => q.stateCode === stateCode.toUpperCase() && (!q.entityTypes || !entityType || q.entityTypes.includes(entityType as EntityType)),
  );
}

/** Operator-facing blocker lines for a filing (empty when nothing is open). */
export function openQuestionBlockers(stateCode: string, entityType?: string | null): string[] {
  return openQuestionsFor(stateCode, entityType).map((q) => `Unresolved state question (${q.key}): ${q.summary} Answered by: ${q.answeredBy}. Do not file.`);
}
