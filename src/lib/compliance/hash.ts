import "server-only";
import { createHash } from "node:crypto";
import { stableStringify } from "./hash-core";
import type { ComplianceRuleDef } from "./types";

export { stableStringify };

/** Stable hash of a rule version's content — detects accidental edits to published versions. */
export function ruleContentHash(rule: ComplianceRuleDef): string {
  return createHash("sha256").update(stableStringify(rule)).digest("hex");
}
