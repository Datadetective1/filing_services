import "server-only";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import type { ServicePrice } from "@/lib/domain/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnonClient } from "@/lib/supabase/server";

export interface RuleVersionRow {
  id: string;
  rule_id: string;
  version: number;
  verification_status: "verified" | "unverified";
  filing_name: string;
  state_fee_cents: number;
  nonprofit_state_fee_cents: number | null;
  due_rule: ComplianceRuleDef["dueRule"];
  first_due_rule: ComplianceRuleDef["firstDueRule"];
  intake_schema: ComplianceRuleDef["intake"];
  official_filing_url: string | null;
  [key: string]: unknown;
}

/** The currently published version of a rule, from the database (orders snapshot this row). */
export async function getCurrentRuleVersion(ruleKey: string): Promise<{ ruleId: string; version: RuleVersionRow } | null> {
  const db = createAdminClient();
  const { data: rule } = await db
    .from("compliance_rules")
    .select("id, current_version_id")
    .eq("rule_key", ruleKey)
    .maybeSingle();
  if (!rule?.current_version_id) return null;
  const { data: version } = await db
    .from("state_rule_versions")
    .select("*")
    .eq("id", rule.current_version_id)
    .single();
  if (!version) return null;
  return { ruleId: rule.id, version: version as RuleVersionRow };
}

function mapPrice(row: Record<string, unknown>): ServicePrice {
  return {
    id: String(row.id),
    filingTypeCode: String(row.filing_type_code),
    stateCode: (row.state_code as string | null) ?? null,
    entityType: (row.entity_type as string | null) ?? null,
    serviceFeeCents: Number(row.service_fee_cents),
    approved: Boolean(row.approved),
    active: Boolean(row.active),
  };
}

/** Active service prices (public read). Returns [] if the database is unreachable. */
export async function listActivePrices(): Promise<ServicePrice[]> {
  try {
    const db = createAnonClient();
    if (!db) return [];
    const { data } = await db.from("service_prices").select("*").eq("active", true);
    return (data ?? []).map(mapPrice);
  } catch {
    return [];
  }
}

export async function listActivePricesAdmin(): Promise<ServicePrice[]> {
  const { data } = await createAdminClient().from("service_prices").select("*").eq("active", true);
  return (data ?? []).map(mapPrice);
}
