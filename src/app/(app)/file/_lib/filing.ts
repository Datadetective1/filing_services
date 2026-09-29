import "server-only";
import { createHash } from "node:crypto";
import type { SessionUser } from "@/lib/auth/session";
import { stableStringify } from "@/lib/compliance/hash";
import { getJurisdiction } from "@/lib/compliance/registry";
import type { IntakeSchema } from "@/lib/compliance/types";
import { daysBetween, todayInTimeZone } from "@/lib/domain/dates";
import { getCustomerFiling } from "@/lib/filings/customer";
import { type IntakeAnswers, validateAll } from "@/lib/intake/validate";
import { createClient } from "@/lib/supabase/server";
import { FILING_ID_RE } from "./errors";

export type LoadedFiling = NonNullable<Awaited<ReturnType<typeof getCustomerFiling>>>;

/**
 * Load a filing for its owner. RLS lets staff read every filing, so ownership is
 * checked explicitly: the customer flow only ever shows the signed-in user's own.
 */
export async function loadOwnFiling(user: SessionUser, filingId: string): Promise<LoadedFiling | null> {
  if (!FILING_ID_RE.test(filingId)) return null;
  const loaded = await getCustomerFiling(filingId);
  if (!loaded || loaded.filing.user_id !== user.id) return null;
  return loaded;
}

export function filingSummary(loaded: LoadedFiling) {
  const stateCode = String(loaded.filing.state_code);
  const jurisdiction = getJurisdiction(stateCode);
  const snapshot = (loaded.filing.rule_snapshot ?? {}) as Record<string, unknown>;
  const dueDate = String(loaded.filing.due_date);
  const today = todayInTimeZone(jurisdiction?.timezone ?? "America/New_York");
  return {
    stateCode,
    stateName: jurisdiction?.name ?? stateCode,
    agencyName: jurisdiction?.agency.name.split(" - ")[0] ?? `${jurisdiction?.name ?? stateCode} state agency`,
    filingName: String(snapshot.filing_name ?? "Annual Report"),
    officialFilingUrl: typeof snapshot.official_filing_url === "string" ? snapshot.official_filing_url : null,
    stateFeeCents: typeof snapshot.state_fee_cents === "number" ? snapshot.state_fee_cents : null,
    businessName: String(loaded.business?.legal_name ?? "Your business"),
    periodYear: Number(loaded.filing.period_year),
    dueDate,
    daysRemaining: daysBetween(today, dueDate),
    status: String(loaded.filing.status),
  };
}

export type AuthorizationStatus = "missing" | "stale" | "current";

/**
 * Whether the latest authorization covers the answers as they are now. If the
 * customer edited anything after signing, they must review and sign again.
 */
export async function authorizationStatus(filingId: string, schema: IntakeSchema, answers: IntakeAnswers): Promise<AuthorizationStatus> {
  const db = await createClient();
  const { data } = await db
    .from("filing_authorizations")
    .select("answers_sha256, created_at")
    .eq("filing_id", filingId)
    .order("created_at", { ascending: false })
    .limit(1);
  const latest = data?.[0];
  if (!latest) return "missing";
  const all = validateAll(schema, answers);
  if (!all.ok) return "stale";
  const sha = createHash("sha256").update(stableStringify(all.values)).digest("hex");
  return sha === latest.answers_sha256 ? "current" : "stale";
}
