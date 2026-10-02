import { stateAuthorizationForState } from "@/lib/compliance/registry";
import { comparisonCheckpointBlocker } from "@/lib/filings/operations";
import { registeredAgentConsentRequired } from "@/lib/filings/packet";
import "server-only";
import { createHash } from "node:crypto";
import { isUuid } from "@/components/admin/format";
import { stableStringify } from "@/lib/compliance/hash-core";
import type { IntakeSchema } from "@/lib/compliance/types";
import { isFilingStatus, type FilingStatus } from "@/lib/domain/filing-status";
import { validateAll } from "@/lib/intake/validate";
import { createClient } from "@/lib/supabase/server";
import { one, profilesByIds, staffDirectory } from "../../_lib/data";

/**
 * Everything the order detail page and the filing packet need for one filing.
 * Staff-only: the caller has run requireStaff(); reads use the RLS client.
 */

export interface RuleSnapshot {
  id?: string;
  rule_id?: string;
  version?: number;
  verification_status?: string;
  publication_status?: string;
  effective_from?: string;
  filing_name?: string;
  form_number?: string | null;
  state_fee_cents?: number;
  nonprofit_state_fee_cents?: number | null;
  intake_schema?: IntakeSchema;
  official_filing_url?: string | null;
  official_info_url?: string | null;
  filing_method_summary?: string | null;
  processing_summary?: string | null;
  content_hash?: string;
  last_verified_at?: string | null;
  verified_by?: string | null;
  notes?: string | null;
}

export interface FilingRow {
  id: string;
  user_id: string;
  business_id: string;
  requirement_id: string | null;
  order_id: string | null;
  state_code: string;
  filing_type_code: string;
  rule_version_id: string;
  rule_snapshot: RuleSnapshot;
  period_year: number;
  due_date: string;
  status: FilingStatus;
  assigned_to: string | null;
  state_confirmation_number: string | null;
  submitted_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface BusinessRow {
  id: string;
  legal_name: string;
  state_code: string;
  entity_type: string;
  is_foreign: boolean;
  home_jurisdiction: string | null;
  state_entity_number: string | null;
  formation_date: string | null;
  is_nonprofit: boolean;
  standing: string;
  standing_source: string;
  standing_checked_at: string | null;
}

export interface OrderRow {
  id: string;
  status: string;
  government_fee_cents: number;
  service_fee_cents: number;
  total_cents: number;
  payment_mode: string;
  paid_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface AuthorizationRow {
  id: string;
  signer_name: string;
  signer_title: string;
  terms_version: string;
  authorization_text: string;
  answers_sha256: string;
  answers_snapshot: Record<string, unknown> | null;
  packet_snapshot: unknown;
  packet_sha256: string | null;
  facts_certified: boolean | null;
  certification_text: string | null;
  filing_agent_name: string | null;
  registered_agent_consent: Record<string, unknown> | null;
  rule_version_id: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  provider: string;
  mode: string;
  status: string;
  amount_cents: number;
  amount_refunded_cents: number;
  provider_payment_id: string | null;
  failure_reason: string | null;
  receipt_url: string | null;
  requires_review: boolean;
  review_reason: string | null;
  created_at: string;
}

export interface RefundRow {
  id: string;
  amount_cents: number;
  government_fee_cents: number;
  service_fee_cents: number;
  reason: string;
  status: string;
  provider_refund_id: string | null;
  requested_by: string | null;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  kind: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  visible_to_customer: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export interface ReceiptRow {
  id: string;
  document_id: string | null;
  confirmation_number: string | null;
  state_fee_paid_cents: number | null;
  submitted_at: string | null;
  recorded_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface SourceRow {
  id: string;
  fact_key: string;
  url: string;
  title: string | null;
  publisher: string | null;
  quote: string | null;
  last_verified_at: string;
}

export interface AddressRow {
  kind: string;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  county: string | null;
  crop_name: string | null;
}

export interface OwnerRow {
  full_name: string;
  title: string;
  role_kind: string;
  sort_order: number;
}

export interface MessageRow {
  id: string;
  author_id: string | null;
  author_type: string;
  body: string;
  created_at: string;
}

export interface NoteRow {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface HistoryRow {
  id: number;
  from_status: string | null;
  to_status: string;
  actor_user_id: string | null;
  actor_type: string;
  note: string | null;
  customer_visible: boolean;
  created_at: string;
}

export interface AuditRow {
  id: number;
  actor_user_id: string | null;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  created_at: string;
}

export const RECEIPT_KINDS = ["state_receipt", "filed_report", "acknowledgement"] as const;

function answersHash(schema: IntakeSchema | undefined, answers: Record<string, unknown>): string | null {
  if (!schema?.sections) return null;
  const values = validateAll(schema, answers).values;
  return createHash("sha256").update(stableStringify(values)).digest("hex");
}

export async function loadFilingDetail(id: string) {
  if (!isUuid(id)) return null;
  const db = await createClient();
  const { data: raw } = await db.from("filings").select("*, businesses(*), states(name), orders(*)").eq("id", id).maybeSingle();
  if (!raw || !isFilingStatus(raw.status)) return null;

  const filing = raw as FilingRow;
  const business = one(raw.businesses) as BusinessRow | null;
  const order = one(raw.orders) as OrderRow | null;
  const stateName = (one(raw.states) as { name: string } | null)?.name ?? filing.state_code;
  const snapshot = (filing.rule_snapshot ?? {}) as RuleSnapshot;

  const [
    answersRes,
    authRes,
    paymentsRes,
    refundsRes,
    notesRes,
    messagesRes,
    historyRes,
    auditRes,
    docsRes,
    receiptsRes,
    sourcesRes,
    addressesRes,
    ownersRes,
    ruleRes,
    staff,
  ] = await Promise.all([
    db.from("filing_answers").select("answers, is_complete, updated_at").eq("filing_id", id).maybeSingle(),
    db
      .from("filing_authorizations")
      .select(
        "id, signer_name, signer_title, terms_version, authorization_text, answers_sha256, answers_snapshot, packet_snapshot, packet_sha256, facts_certified, certification_text, filing_agent_name, registered_agent_consent, rule_version_id, created_at",
      )
      .eq("filing_id", id)
      .order("created_at", { ascending: false }),
    filing.order_id
      ? db.from("payments").select("*").eq("order_id", filing.order_id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    filing.order_id
      ? db.from("refunds").select("*").eq("order_id", filing.order_id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    db.from("admin_notes").select("id, author_id, body, created_at").eq("filing_id", id).order("created_at", { ascending: false }),
    db.from("messages").select("id, author_id, author_type, body, created_at").eq("filing_id", id).order("created_at", { ascending: true }),
    db.from("filing_status_history").select("*").eq("filing_id", id).order("created_at", { ascending: false }),
    db.from("audit_logs").select("*").eq("filing_id", id).order("created_at", { ascending: false }).limit(100),
    db.from("filing_documents").select("*").eq("filing_id", id).order("created_at", { ascending: false }),
    db.from("filing_receipts").select("*").eq("filing_id", id).order("created_at", { ascending: false }),
    db.from("state_rule_sources").select("*").eq("rule_version_id", filing.rule_version_id).order("fact_key"),
    db.from("business_addresses").select("*").eq("business_id", filing.business_id),
    db.from("business_owners").select("full_name, title, role_kind, sort_order").eq("business_id", filing.business_id).order("sort_order"),
    snapshot.rule_id
      ? db.from("compliance_rules").select("rule_key, current_version_id").eq("id", snapshot.rule_id).maybeSingle()
      : Promise.resolve({ data: null }),
    staffDirectory(),
  ]);

  const answers = ((answersRes.data?.answers ?? {}) as Record<string, unknown>) ?? {};
  const authorizations = (authRes.data ?? []) as AuthorizationRow[];
  const authorization = authorizations[0] ?? null;
  const payments = (paymentsRes.data ?? []) as PaymentRow[];
  const refunds = (refundsRes.data ?? []) as RefundRow[];
  const notes = (notesRes.data ?? []) as NoteRow[];
  const messages = (messagesRes.data ?? []) as MessageRow[];
  const history = (historyRes.data ?? []) as HistoryRow[];
  const auditRows = (auditRes.data ?? []) as AuditRow[];
  const documents = (docsRes.data ?? []) as DocumentRow[];
  const receipts = (receiptsRes.data ?? []) as ReceiptRow[];
  const sources = (sourcesRes.data ?? []) as SourceRow[];
  const addresses = (addressesRes.data ?? []) as AddressRow[];
  const owners = (ownersRes.data ?? []) as OwnerRow[];
  const rule = ruleRes.data as { rule_key: string; current_version_id: string | null } | null;

  const people = await profilesByIds([
    filing.user_id,
    ...notes.map((n) => n.author_id),
    ...messages.map((m) => m.author_id),
    ...history.map((h) => h.actor_user_id),
    ...auditRows.map((a) => a.actor_user_id),
    ...documents.map((d) => d.uploaded_by),
    ...receipts.map((r) => r.recorded_by),
    ...refunds.map((r) => r.requested_by),
  ]);

  const liveRefunds = refunds.filter((r) => r.status !== "failed");
  const refundedGov = liveRefunds.reduce((s, r) => s + r.government_fee_cents, 0);
  const refundedSvc = liveRefunds.reduce((s, r) => s + r.service_fee_cents, 0);
  const capturedPayment = payments.find((p) => p.status === "succeeded" || p.status === "partially_refunded") ?? null;

  const currentHash = answersHash(snapshot.intake_schema, answers);
  const answersChangedSinceAuthorization = Boolean(authorization && currentHash && currentHash !== authorization.answers_sha256);

  // State-specific authorization (Washington): packet confirmation, registered-agent consent
  // and the operator's comparison checkpoint. Same inputs the server checks before filing.
  const stateAuth = stateAuthorizationForState(filing.state_code);
  const currentValues = snapshot.intake_schema ? validateAll(snapshot.intake_schema, answers).values : answers;
  const consentRequired = stateAuth ? registeredAgentConsentRequired(stateAuth.auth, currentValues) : false;
  const consentDocumentOnFile = documents.some((doc) => doc.kind === "registered_agent_consent");
  const stateAuthorization = stateAuth
    ? {
        factsCertified: Boolean(authorization?.facts_certified),
        consentRequired,
        consentMode: (authorization?.registered_agent_consent?.mode as string | undefined) ?? null,
        consentDocumentOnFile,
      }
    : null;
  const checkpointRow = auditRows.find((a) => a.action === "filing.state_comparison_confirmed") ?? null;
  const checkpoint = checkpointRow
    ? { answers_sha256: ((checkpointRow.after ?? {}) as { answers_sha256?: string }).answers_sha256 ?? null, created_at: checkpointRow.created_at }
    : null;
  const comparison = stateAuth?.auth.operatorCheckpoint
    ? { checkpoint, blocker: comparisonCheckpointBlocker({ required: true, authorization, checkpoint }) }
    : null;

  return {
    filing,
    business,
    order,
    stateName,
    snapshot,
    answers,
    answersComplete: Boolean(answersRes.data?.is_complete),
    authorization,
    authorizationCount: authorizations.length,
    answersChangedSinceAuthorization,
    stateAuthorization,
    comparison,
    payments,
    refunds,
    refundedGov,
    refundedSvc,
    capturedPayment,
    notes,
    messages,
    history,
    auditRows,
    documents,
    receipts,
    sources,
    addresses,
    owners,
    rule,
    staff,
    people,
    customer: people.get(filing.user_id) ?? null,
    hasReceiptDocument: documents.some((d) => (RECEIPT_KINDS as readonly string[]).includes(d.kind) && d.visible_to_customer),
  };
}

export type FilingDetail = NonNullable<Awaited<ReturnType<typeof loadFilingDetail>>>;
