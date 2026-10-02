import { DEFAULT_TEMPLATES } from "@/lib/email/templates";
import { DEFAULT_REMINDER_OFFSETS } from "@/lib/domain/reminders";
import { addDays } from "@/lib/domain/dates";
import { stableStringify } from "./hash-core";
import { FILING_TYPES, RULES } from "./registry";
import { JURISDICTIONS } from "./jurisdictions";
import type { ComplianceRuleDef } from "./types";

/**
 * Pure builders for reference data. Used by scripts/seed.ts (Supabase) and by the
 * database test harness (PGlite), so both load exactly the same data.
 */

export function stateRows() {
  return JURISDICTIONS.map((j) => ({
    code: j.code,
    name: j.name,
    slug: j.slug,
    timezone: j.timezone,
    support_level: j.supportLevel,
    filing_enabled: j.filingEnabled,
  }));
}

export function agencyRows() {
  return JURISDICTIONS.map((j) => ({
    state_code: j.code,
    name: j.agency.name,
    website_url: j.agency.websiteUrl,
    business_search_url: j.agency.businessSearchUrl,
    periodic_report_name: j.agency.periodicReportName,
    source_url: j.agency.websiteUrl,
    verification_status: j.agency.verificationStatus,
    last_verified_at: j.agency.lastVerifiedAt,
  }));
}

export function filingTypeRows() {
  return FILING_TYPES.map((f) => ({
    code: f.code,
    name: f.name,
    description: f.description,
    category: f.category,
    launch_enabled: f.launchEnabled,
    sort_order: f.sortOrder,
  }));
}

export function ruleRow(rule: ComplianceRuleDef) {
  return {
    rule_key: rule.ruleKey,
    state_code: rule.stateCode,
    filing_type_code: rule.filingTypeCode,
    entity_type: rule.entityType,
    applies_to: rule.appliesTo,
  };
}

export function versionRow(rule: ComplianceRuleDef, contentHash: string) {
  return {
    version: rule.version,
    verification_status: rule.verificationStatus,
    publication_status: "published",
    effective_from: rule.effectiveFrom,
    filing_name: rule.filingName,
    form_number: rule.formNumber ?? null,
    due_rule: rule.dueRule,
    first_due_rule: rule.firstDueRule,
    state_fee_cents: rule.stateFeeCents,
    nonprofit_state_fee_cents: rule.nonprofitStateFeeCents ?? null,
    late_fee_cents: rule.lateFeeCents,
    fee_components: rule.feeComponents ?? null,
    late_fees: rule.lateFees ?? null,
    filing_window_days_before: rule.filingWindowDaysBefore ?? null,
    late_fee_summary: rule.lateFeeSummary,
    consequence_summary: rule.consequenceSummary,
    who_must_file: rule.whoMustFile,
    required_information: rule.requiredInformation,
    intake_schema: rule.intake,
    official_filing_url: rule.officialFilingUrl,
    official_info_url: rule.officialInfoUrl,
    filing_method_summary: rule.filingMethodSummary,
    processing_summary: rule.processingSummary,
    customer_summary: rule.customerSummary,
    faq: rule.faq,
    content_hash: contentHash,
    last_verified_at: rule.lastVerifiedAt,
    verified_by: rule.verifiedBy,
    notes: rule.notes ?? null,
  };
}

export function sourceRows(rule: ComplianceRuleDef) {
  return rule.sources.map((s) => ({
    fact_key: s.factKey,
    url: s.url,
    title: s.title,
    publisher: s.publisher,
    quote: s.quote,
    last_verified_at: s.lastVerifiedAt,
  }));
}

export function supersededEffectiveTo(next: ComplianceRuleDef): string {
  return addDays(next.effectiveFrom, -1);
}

export function contentHashOf(rule: ComplianceRuleDef, hash: (s: string) => string): string {
  return hash(stableStringify(rule));
}

/**
 * Default service fee. PROVISIONAL: no price has been decided by the owner, so the
 * row is seeded with approved=false. Live checkout refuses unapproved prices; an
 * admin sets and approves the real fee in /admin/pricing.
 */
export const PROVISIONAL_SERVICE_FEE_CENTS = 4900;

export function defaultPriceRows() {
  return ["PA", "WA", "NV", "UT"].map((state) => ({
    filing_type_code: "annual_report",
    state_code: state,
    entity_type: null,
    service_fee_cents: PROVISIONAL_SERVICE_FEE_CENTS,
    approved: false,
    active: true,
    notes:
      state === "PA"
        ? "Provisional placeholder: owner must set and approve the service fee before live payments."
        : "Proposed $49 service fee for staging and calculations. Not approved: live checkout refuses it until the owner approves this state's total.",
  }));
}

export function reminderScheduleRows() {
  return [
    {
      name: "Default filing reminders",
      offsets_days: [...DEFAULT_REMINDER_OFFSETS],
      filing_type_code: null,
      state_code: null,
      active: true,
    },
  ];
}

export function templateRows() {
  return DEFAULT_TEMPLATES.map((t) => ({
    key: t.key,
    channel: "email",
    category: t.category,
    subject: t.subject,
    body_text: t.body,
    cta_label: t.ctaLabel,
    description: t.description,
    active: true,
  }));
}

export { RULES };
