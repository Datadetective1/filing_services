import type { IntakeSection } from "@/lib/compliance/types";

/**
 * Converts intake FormData into the nested answer object a section expects:
 *   "legal_name"               -> { legal_name }
 *   "principal_office.city"    -> { principal_office: { city } }
 *   "governors.0.name"         -> { governors: [{ name }] }
 *
 * Only the section's own field keys are accepted, paths are at most three levels
 * deep, segment names are restricted, and prototype keys are rejected. Validation
 * of the values themselves happens in the shared intake validator.
 */

const SEGMENT = /^[A-Za-z0-9_]{1,40}$/;
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const MAX_INDEX = 50;
const MAX_VALUE_LENGTH = 1000;

type Tree = Record<string, unknown> | unknown[];

function isIndex(segment: string): boolean {
  return /^\d{1,2}$/.test(segment) && Number(segment) <= MAX_INDEX;
}

function assign(root: Record<string, unknown>, parts: string[], value: string) {
  let cursor: Tree = root;
  for (let i = 0; i < parts.length; i++) {
    const key = parts[i];
    const last = i === parts.length - 1;
    const container = cursor as Record<string, unknown>;
    if (last) {
      container[key] = value;
      return;
    }
    const nextIsIndex = isIndex(parts[i + 1]);
    const existing = container[key];
    if (existing === null || typeof existing !== "object" || Array.isArray(existing) !== nextIsIndex) {
      container[key] = nextIsIndex ? [] : {};
    }
    cursor = container[key] as Tree;
  }
}

function compact(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter((v) => v !== undefined && v !== null).map(compact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = compact(v);
    return out;
  }
  return value;
}

export function formDataToSectionAnswers(formData: FormData, section: IntakeSection): Record<string, unknown> {
  const roots = new Set(section.fields.map((f) => f.key));
  const out: Record<string, unknown> = {};
  for (const [name, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    const parts = name.split(".");
    if (parts.length > 3 || !roots.has(parts[0])) continue;
    if (parts.some((p) => !SEGMENT.test(p) || FORBIDDEN.has(p))) continue;
    // Array indices may only appear right after a people field key.
    if (parts.slice(2).some(isIndex)) continue;
    assign(out, parts, raw.slice(0, MAX_VALUE_LENGTH));
  }
  const answers = compact(out) as Record<string, unknown>;

  // Drop fully-empty repeater rows so error indices line up with the rows shown.
  for (const field of section.fields) {
    if (field.type !== "people") continue;
    const rows = answers[field.key];
    answers[field.key] = Array.isArray(rows)
      ? rows
          .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object" && !Array.isArray(r))
          .map((r) => ({
            name: typeof r.name === "string" ? r.name : "",
            title: typeof r.title === "string" ? r.title : "",
            ...(field.withAddress ? { address: typeof r.address === "string" ? r.address : "" } : {}),
          }))
          .filter((r) => r.name.trim() !== "" || r.title.trim() !== "" || (r.address ?? "").trim() !== "")
      : [];
  }
  return answers;
}
