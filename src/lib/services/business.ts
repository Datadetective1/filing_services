import "server-only";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import { findRule } from "@/lib/compliance/registry";
import { formationDateRequired } from "@/lib/compliance/state-meta";
import { addBusiness, type AddBusinessInput } from "@/lib/filings/customer";
import { createClient } from "@/lib/supabase/server";

/**
 * Add a business for a registered agent order. Where Filewell tracks the state's annual
 * report and has what it needs to date it, this is the normal path (deadline and reminders
 * included). Otherwise (Texas, Michigan LLCs, or no formation date given) the business is
 * saved on its own, because registered agent service doesn't depend on the annual report.
 */
export async function addBusinessForService(user: SessionUser, input: AddBusinessInput): Promise<string> {
  const rule = findRule(input.stateCode, input.entityType, "annual_report", input.isForeign);
  const canDate = !formationDateRequired(input.stateCode) || Boolean(input.formationDate);
  if (rule && rule.verificationStatus === "verified" && canDate) return (await addBusiness(user, input)).businessId;

  const db = await createClient();
  const { data, error } = await db
    .from("businesses")
    .insert({
      owner_user_id: user.id,
      legal_name: input.legalName,
      state_code: input.stateCode,
      entity_type: input.entityType,
      is_foreign: input.isForeign,
      is_nonprofit: input.isNonprofit,
      formation_date: input.formationDate,
      state_entity_number: input.entityNumber,
      home_jurisdiction: input.homeJurisdiction,
      standing: "unknown",
      standing_source: "none",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not save the business: ${error?.message ?? "unknown"}`);
  await audit({
    actorUserId: user.id,
    actorType: "customer",
    action: "business.created",
    entityType: "business",
    entityId: String(data.id),
    after: { state_code: input.stateCode, entity_type: input.entityType, source: "registered_agent_order" },
  });
  return String(data.id);
}

/**
 * A business the customer is forming themselves (elsewhere), so it can name us as its agent
 * in its formation filing. Saved as "forming": no annual report tracking until it exists.
 */
export async function addFormingBusiness(user: SessionUser, input: { legalName: string; stateCode: string; entityType: "llc" | "corporation" }): Promise<string> {
  const db = await createClient();
  const { data, error } = await db
    .from("businesses")
    .insert({
      owner_user_id: user.id,
      legal_name: input.legalName,
      state_code: input.stateCode,
      entity_type: input.entityType,
      lifecycle: "forming",
      standing: "unknown",
      standing_source: "none",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Could not save the business: ${error?.message ?? "unknown"}`);
  await audit({
    actorUserId: user.id,
    actorType: "customer",
    action: "business.created",
    entityType: "business",
    entityId: String(data.id),
    after: { state_code: input.stateCode, entity_type: input.entityType, lifecycle: "forming", source: "registered_agent_order" },
  });
  return String(data.id);
}
