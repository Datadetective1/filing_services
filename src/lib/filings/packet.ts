import { createHash } from "node:crypto";
import { stableStringify } from "@/lib/compliance/hash";
import type { IntakeField, IntakeSchema, OperatorRunbook, StateAuthorization } from "@/lib/compliance/types";
import { conditionMet, formatAddress, formatRegisteredOffice, type Address, type IntakeAnswers, type Person, type RegisteredOffice } from "@/lib/intake/validate";

/**
 * The filing packet: every value Filewell will enter in the state's portal, in the
 * portal's own order (from the rule's operator runbook). The customer sees this exact
 * list before signing, the signed copy is stored with the authorization, and the
 * operator files from it. Pure: shared by the review page, signing and the admin screens.
 */

export interface PacketRow {
  section: string;
  stateField: string;
  /** Intake answer behind the value; null for a fixed instruction (e.g. "Date of Filing"). */
  answerKey: string | null;
  value: string;
  /** True when the question doesn't apply to these answers (e.g. a commercial agent's address). */
  notApplicable?: boolean;
}

/** Plain-text value of one answer, as the customer and operator both see it. */
export function fieldText(field: IntakeField, value: unknown): string {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
    return field.type === "people" ? "None listed" : "Not provided";
  }
  switch (field.type) {
    case "text":
    case "email":
      return String(value);
    case "choice":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "address": {
      const a = value as Address;
      const base = formatAddress(a);
      return a.county ? `${base} (${a.county} County)` : base;
    }
    case "registered_office":
      return formatRegisteredOffice(value as RegisteredOffice);
    case "people": {
      const people = Array.isArray(value) ? (value as Person[]) : [];
      return people.map((p) => [`${p.name}, ${p.title}`, p.address].filter(Boolean).join(" · ")).join("; ");
    }
  }
}

export function buildFilingPacket(runbook: Pick<OperatorRunbook, "fieldMap">, schema: IntakeSchema, answers: IntakeAnswers): PacketRow[] {
  const sections = schema.sections ?? [];
  const fields = new Map<string, IntakeField>(sections.flatMap((s) => s.fields.map((f) => [f.key, f] as const)));
  return runbook.fieldMap.map((m) => {
    const section = m.section ?? "Filing";
    if (!m.answerKey) return { section, stateField: m.portalField, answerKey: null, value: m.note ?? "" };
    const field = fields.get(m.answerKey);
    if (!field) return { section, stateField: m.portalField, answerKey: m.answerKey, value: "Not asked in this filing's form", notApplicable: true };
    if (!conditionMet(field, answers)) {
      return { section, stateField: m.portalField, answerKey: m.answerKey, value: "Not needed for these answers", notApplicable: true };
    }
    return { section, stateField: m.portalField, answerKey: m.answerKey, value: fieldText(field, answers[m.answerKey]) };
  });
}

export function packetSha256(rows: PacketRow[]): string {
  return createHash("sha256").update(stableStringify(rows)).digest("hex");
}

/** Group rows by portal section, keeping the portal's order. */
export function packetSections(rows: PacketRow[]): { section: string; rows: PacketRow[] }[] {
  const out: { section: string; rows: PacketRow[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.section === r.section) last.rows.push(r);
    else out.push({ section: r.section, rows: [r] });
  }
  return out;
}

/** True when these answers change the registered agent in a way that needs the new agent's consent. */
export function registeredAgentConsentRequired(auth: StateAuthorization | undefined, answers: IntakeAnswers): boolean {
  const ra = auth?.registeredAgentConsent;
  if (!ra) return false;
  return ra.consentRequiredWhen.includes(String(answers[ra.changeKey] ?? ""));
}

/** How the new registered agent's consent was given. Stored on the authorization. */
export type RegisteredAgentConsent =
  | {
      /** The customer signing is the new agent (or signs for the business/position serving as agent). */
      mode: "signer_is_agent";
      agentName: string;
      signerName: string;
      signerTitle: string;
      consentText: string;
      signedAt: string;
    }
  | {
      /** Someone else is the agent: their signed consent must be received and uploaded before filing. */
      mode: "agent_to_sign";
      agentName: string;
    };
