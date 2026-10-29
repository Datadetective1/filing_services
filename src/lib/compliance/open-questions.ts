import type { EntityType } from "@/lib/domain/types";

/**
 * Questions only the state (or the owner, inside the state's portal) can answer, whose
 * answers decide whether Filewell can lawfully and practically file for a customer.
 *
 * Fail closed: while a state/entity has an open question, it is not sold wherever real money
 * could be taken (production, or PAYMENTS_LIVE_ENABLED=true), even if <STATE>_LIVE_FILING_SALES
 * is set; live checkout refuses it too; and no filing for it may be marked ready,
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
  {
    key: "fl_signer_permission",
    stateCode: "FL",
    summary:
      "Florida's report must be signed by one of the business's principals typing their name, and Sunbiz warns that typing someone's name without their permission is forgery. Filewell's design has the principal sign Filewell's authorization and give explicit permission for Filewell's operator to type their name and title on that one report. Until counsel confirms this permission is enough under s.15.16 F.S. and Sunbiz's instructions, Filewell does not sell or file Florida reports.",
    answeredBy: "Counsel, and the Florida Division of Corporations if counsel asks",
  },
  {
    key: "co_delivery_affirmation",
    stateCode: "CO",
    summary:
      "Colorado's Periodic Report names the individual causing it to be delivered for filing, and that individual is responsible for complying with the applicable statutes. Until counsel confirms what that delivery affirms under C.R.S. 7-90-301 and that Filewell's operator may cause delivery as the customer's authorized filing agent, Filewell does not sell or file Colorado reports.",
    answeredBy: "Counsel",
  },
  {
    key: "sd_2027_filing_date",
    stateCode: "SD",
    summary:
      "From January 1, 2027, SDCL 59-11-25 lets a business file in its anniversary month or by January 31, and choose on its formation document or a change-of-filing-date form. How the Secretary records each business's choice, how existing businesses are assigned a date, and how early a report can be filed are not confirmed. Filewell blocks businesses on the January 31 date and does not sell or file South Dakota reports until this is answered.",
    answeredBy: "South Dakota Secretary of State (Business Services)",
  },
  {
    key: "mt_signer_declarations",
    stateCode: "MT",
    summary:
      "Montana's online report has declaration boxes whose wording isn't published in text, and the corporation statute doesn't say who may sign. Until the owner captures the declarations in the portal and counsel confirms Filewell's operator may sign them as the customer's authorized agent, Filewell does not sell or file Montana reports.",
    answeredBy: "The owner inside biz.sosmt.gov, then counsel",
  },
  {
    key: "mi_milogin_access",
    stateCode: "MI",
    summary:
      "MiBusiness Registry requires a MiLogin for Business account that requests access to the corporation by answering two questions. Whether a filing service may request access to a client's corporation, what the questions ask, and who may sign the report are not confirmed. Filewell does not sell or file Michigan reports until they are.",
    answeredBy: "Michigan LARA Corporations Division, and the owner inside MiBusiness Registry",
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
