import "server-only";
import { findRule, getJurisdiction, isRuleSellable, RULES } from "@/lib/compliance/registry";
import type { ComplianceRuleDef, IntakeSchema } from "@/lib/compliance/types";
import { daysBetween, isISODate, todayInTimeZone } from "@/lib/domain/dates";
import { isFilingStatus, type FilingStatus } from "@/lib/domain/filing-status";
import { isEntityType, type EntityType } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { many, one, type RequirementStatus } from "@/components/dashboard/format";

/**
 * Data loaders for the customer dashboard. Every read uses the RLS client (acting as
 * the signed-in user) AND filters by the user's id explicitly: staff members can
 * read all rows under RLS, and the customer dashboard must only ever show the
 * viewer's own records.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessView {
  id: string;
  legalName: string;
  stateCode: string;
  stateName: string;
  stateSlug: string | null;
  timeZone: string;
  entityType: EntityType;
  isForeign: boolean;
  isNonprofit: boolean;
  homeJurisdiction: string | null;
  entityNumber: string | null;
  formationDate: string | null;
  standing: string;
  standingSource: string;
  createdAt: string;
  /** The verified annual report rule for this business, if we have one. */
  rule: ComplianceRuleDef | null;
  sellable: boolean;
}

export interface FilingSummary {
  id: string;
  businessId: string;
  requirementId: string | null;
  status: FilingStatus;
  periodYear: number;
  dueDate: string;
  createdAt: string;
  orderStatus: string | null;
  isComplete: boolean;
  authorized: boolean;
  filingName: string;
}

export interface RequirementView {
  id: string;
  businessId: string;
  periodYear: number;
  dueDate: string;
  status: RequirementStatus;
  rule: ComplianceRuleDef | null;
  filingName: string;
  daysRemaining: number;
  /** The non-cancelled filing for this requirement, if any. */
  activeFiling: FilingSummary | null;
}

export interface NotificationView {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

const BUSINESS_COLUMNS =
  "id, legal_name, state_code, entity_type, is_foreign, is_nonprofit, home_jurisdiction, state_entity_number, formation_date, standing, standing_source, created_at";

const FILING_SUMMARY_COLUMNS =
  "id, business_id, requirement_id, status, period_year, due_date, created_at, filing_name:rule_snapshot->>filing_name, orders(status), filing_answers(is_complete), filing_authorizations(id)";

const REQUIREMENT_COLUMNS = "id, business_id, period_year, due_date, status, filing_id, compliance_rules(rule_key)";

type Row = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v !== "" ? v : null;
}

function mapBusiness(row: Row): BusinessView {
  const stateCode = str(row.state_code);
  const jurisdiction = getJurisdiction(stateCode);
  const entityType: EntityType = isEntityType(row.entity_type) ? row.entity_type : "other";
  const isForeign = Boolean(row.is_foreign);
  const rule = findRule(stateCode, entityType, "annual_report", isForeign) ?? null;
  const verified = rule && rule.verificationStatus === "verified" ? rule : null;
  return {
    id: str(row.id),
    legalName: str(row.legal_name),
    stateCode,
    stateName: jurisdiction?.name ?? stateCode,
    stateSlug: jurisdiction?.slug ?? null,
    timeZone: jurisdiction?.timezone ?? "America/New_York",
    entityType,
    isForeign,
    isNonprofit: Boolean(row.is_nonprofit),
    homeJurisdiction: strOrNull(row.home_jurisdiction),
    entityNumber: strOrNull(row.state_entity_number),
    formationDate: strOrNull(row.formation_date),
    standing: str(row.standing) || "unknown",
    standingSource: str(row.standing_source) || "none",
    createdAt: str(row.created_at),
    rule: verified,
    sellable: verified ? isRuleSellable(verified) : false,
  };
}

function ruleByKey(key: unknown): ComplianceRuleDef | null {
  if (typeof key !== "string") return null;
  const rule = RULES.find((r) => r.ruleKey === key);
  return rule && rule.verificationStatus === "verified" ? rule : null;
}

function mapFilingSummary(row: Row): FilingSummary | null {
  if (!isFilingStatus(row.status)) return null;
  const order = one(row.orders as Row | Row[] | null);
  const answers = one(row.filing_answers as Row | Row[] | null);
  const auths = many(row.filing_authorizations as Row | Row[] | null);
  const snapshot = (row.rule_snapshot ?? {}) as Row;
  const filingName = str(row.filing_name) || str(snapshot.filing_name) || "Annual Report";
  return {
    id: str(row.id),
    businessId: str(row.business_id),
    requirementId: strOrNull(row.requirement_id),
    status: row.status,
    periodYear: Number(row.period_year),
    dueDate: str(row.due_date),
    createdAt: str(row.created_at),
    orderStatus: order ? strOrNull(order.status) : null,
    isComplete: Boolean(answers?.is_complete),
    authorized: auths.length > 0,
    filingName,
  };
}

function mapRequirement(row: Row, business: BusinessView | undefined, filings: FilingSummary[]): RequirementView {
  const rule = ruleByKey(one(row.compliance_rules as Row | Row[] | null)?.rule_key) ?? business?.rule ?? null;
  const dueDate = str(row.due_date);
  const today = todayInTimeZone(business?.timeZone ?? "America/New_York");
  const id = str(row.id);
  const activeFiling =
    filings.find((f) => f.requirementId === id && f.status !== "cancelled" && f.status !== "refunded") ?? null;
  return {
    id,
    businessId: str(row.business_id),
    periodYear: Number(row.period_year),
    dueDate,
    status: (str(row.status) || "open") as RequirementStatus,
    rule,
    filingName: rule?.filingName ?? "Annual Report",
    daysRemaining: isISODate(dueDate) ? daysBetween(today, dueDate) : 0,
    activeFiling,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardData {
  businesses: BusinessView[];
  /** Open requirements across all businesses, earliest due first. */
  openRequirements: RequirementView[];
  /** Non-cancelled filings, newest first. */
  filings: FilingSummary[];
  notifications: NotificationView[];
}

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const db = await createClient();
  const [businessesRes, requirementsRes, filingsRes, notificationsRes] = await Promise.all([
    db
      .from("businesses")
      .select(BUSINESS_COLUMNS)
      .eq("owner_user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: true }),
    db
      .from("filing_requirements")
      .select(REQUIREMENT_COLUMNS)
      .eq("owner_user_id", userId)
      .eq("status", "open")
      .order("due_date", { ascending: true }),
    db
      .from("filings")
      .select(FILING_SUMMARY_COLUMNS)
      .eq("user_id", userId)
      .not("status", "in", "(cancelled,refunded)")
      .order("created_at", { ascending: false }),
    db
      .from("notifications")
      .select("id, subject, status, created_at, sent_at")
      .eq("user_id", userId)
      .neq("subject", "(pending)")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const businesses = ((businessesRes.data ?? []) as Row[]).map(mapBusiness);
  const byId = new Map(businesses.map((b) => [b.id, b]));
  const filings = ((filingsRes.data ?? []) as Row[])
    .map(mapFilingSummary)
    .filter((f): f is FilingSummary => f !== null);
  const openRequirements = ((requirementsRes.data ?? []) as Row[])
    .filter((r) => byId.has(str(r.business_id)))
    .map((r) => mapRequirement(r, byId.get(str(r.business_id)), filings))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));

  return {
    businesses,
    openRequirements,
    filings,
    notifications: ((notificationsRes.data ?? []) as Row[]).map(mapNotification),
  };
}

function mapNotification(row: Row): NotificationView {
  return {
    id: str(row.id),
    subject: str(row.subject),
    status: str(row.status),
    createdAt: str(row.created_at),
    sentAt: strOrNull(row.sent_at),
  };
}

// ---------------------------------------------------------------------------
// Business detail
// ---------------------------------------------------------------------------

export interface AddressView {
  kind: "principal_office" | "registered_office" | "mailing";
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  county: string | null;
  cropName: string | null;
}

export interface PersonView {
  id: string;
  fullName: string;
  title: string;
  roleKind: string;
}

export interface BusinessDetail {
  business: BusinessView;
  addresses: AddressView[];
  people: PersonView[];
  /** All requirement periods, newest first. */
  requirements: RequirementView[];
  /** All filings for this business (including cancelled), newest first. */
  filings: FilingSummary[];
}

export async function loadBusinessDetail(userId: string, businessId: string): Promise<BusinessDetail | null> {
  if (!isUuid(businessId)) return null;
  const db = await createClient();
  const { data: businessRow } = await db
    .from("businesses")
    .select(BUSINESS_COLUMNS)
    .eq("id", businessId)
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (!businessRow) return null;
  const business = mapBusiness(businessRow as Row);

  const [addressesRes, peopleRes, requirementsRes, filingsRes] = await Promise.all([
    db
      .from("business_addresses")
      .select("kind, line1, line2, city, region, postal_code, county, crop_name")
      .eq("business_id", businessId),
    db
      .from("business_owners")
      .select("id, full_name, title, role_kind, sort_order")
      .eq("business_id", businessId)
      .order("sort_order", { ascending: true }),
    db
      .from("filing_requirements")
      .select(REQUIREMENT_COLUMNS)
      .eq("business_id", businessId)
      .eq("owner_user_id", userId)
      .order("period_year", { ascending: false }),
    db
      .from("filings")
      .select(FILING_SUMMARY_COLUMNS)
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const filings = ((filingsRes.data ?? []) as Row[])
    .map(mapFilingSummary)
    .filter((f): f is FilingSummary => f !== null);
  const requirements = ((requirementsRes.data ?? []) as Row[]).map((r) => mapRequirement(r, business, filings));

  const order: Record<string, number> = { principal_office: 0, registered_office: 1, mailing: 2 };
  const addresses = ((addressesRes.data ?? []) as Row[])
    .map(
      (a): AddressView => ({
        kind: str(a.kind) as AddressView["kind"],
        line1: strOrNull(a.line1),
        line2: strOrNull(a.line2),
        city: strOrNull(a.city),
        region: strOrNull(a.region),
        postalCode: strOrNull(a.postal_code),
        county: strOrNull(a.county),
        cropName: strOrNull(a.crop_name),
      }),
    )
    .sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));

  const people = ((peopleRes.data ?? []) as Row[]).map(
    (p): PersonView => ({ id: str(p.id), fullName: str(p.full_name), title: str(p.title), roleKind: str(p.role_kind) }),
  );

  return { business, addresses, people, requirements, filings };
}

// ---------------------------------------------------------------------------
// Filing detail
// ---------------------------------------------------------------------------

export interface TimelineEntry {
  id: string;
  fromStatus: string | null;
  toStatus: FilingStatus;
  actorType: string;
  note: string | null;
  createdAt: string;
}

export interface DocumentView {
  id: string;
  kind: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ReceiptView {
  id: string;
  confirmationNumber: string | null;
  submittedAt: string | null;
  stateFeePaidCents: number | null;
  createdAt: string;
}

export interface MessageView {
  id: string;
  authorType: string;
  body: string;
  createdAt: string;
}

export interface OrderView {
  id: string;
  status: string;
  governmentFeeCents: number;
  serviceFeeCents: number;
  totalCents: number;
  createdAt: string;
  paidAt: string | null;
}

export interface PaymentView {
  id: string;
  status: string;
  amountCents: number;
  receiptUrl: string | null;
  createdAt: string;
}

export interface RefundView {
  id: string;
  amountCents: number;
  governmentFeeCents: number;
  serviceFeeCents: number;
  status: string;
  createdAt: string;
}

export interface AuthorizationView {
  signerName: string;
  signerTitle: string;
  createdAt: string;
}

export interface FilingDetail {
  filing: FilingSummary & {
    stateCode: string;
    confirmationNumber: string | null;
    submittedAt: string | null;
    acceptedAt: string | null;
    completedAt: string | null;
    rejectionReason: string | null;
    snapshot: Record<string, unknown>;
    schema: IntakeSchema | null;
    answers: Record<string, unknown>;
  };
  business: BusinessView | null;
  timeline: TimelineEntry[];
  authorization: AuthorizationView | null;
  order: OrderView | null;
  payments: PaymentView[];
  refunds: RefundView[];
  documents: DocumentView[];
  receipts: ReceiptView[];
  messages: MessageView[];
}

export async function loadFilingDetail(userId: string, filingId: string): Promise<FilingDetail | null> {
  if (!isUuid(filingId)) return null;
  const db = await createClient();
  const { data } = await db
    .from("filings")
    .select(
      `id, business_id, requirement_id, status, period_year, due_date, created_at, rule_snapshot, state_code, order_id, state_confirmation_number, submitted_at, accepted_at, completed_at, rejection_reason, orders(status), filing_answers(answers, is_complete), filing_authorizations(id), businesses(${BUSINESS_COLUMNS})`,
    )
    .eq("id", filingId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Row;
  const summary = mapFilingSummary(row);
  if (!summary) return null;

  const orderId = strOrNull(row.order_id);
  const [historyRes, authRes, documentsRes, receiptsRes, messagesRes, orderRes, paymentsRes, refundsRes] = await Promise.all([
    db
      .from("filing_status_history")
      .select("id, from_status, to_status, actor_type, note, created_at")
      .eq("filing_id", filingId)
      .eq("customer_visible", true)
      .order("created_at", { ascending: true }),
    db
      .from("filing_authorizations")
      .select("signer_name, signer_title, created_at")
      .eq("filing_id", filingId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
    db
      .from("filing_documents")
      .select("id, kind, file_name, mime_type, size_bytes, created_at")
      .eq("filing_id", filingId)
      .eq("user_id", userId)
      .eq("visible_to_customer", true)
      .order("created_at", { ascending: true }),
    db
      .from("filing_receipts")
      .select("id, confirmation_number, submitted_at, state_fee_paid_cents, created_at")
      .eq("filing_id", filingId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    db
      .from("messages")
      .select("id, author_type, body, created_at")
      .eq("filing_id", filingId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    orderId
      ? db
          .from("orders")
          .select("id, status, government_fee_cents, service_fee_cents, total_cents, created_at, paid_at")
          .eq("id", orderId)
          .eq("user_id", userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    orderId
      ? db
          .from("payments")
          .select("id, status, amount_cents, receipt_url, created_at")
          .eq("order_id", orderId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    orderId
      ? db
          .from("refunds")
          .select("id, amount_cents, government_fee_cents, service_fee_cents, status, created_at")
          .eq("order_id", orderId)
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const snapshot = (row.rule_snapshot ?? {}) as Record<string, unknown>;
  const schema = (snapshot.intake_schema as IntakeSchema | undefined) ?? null;
  const answersRow = one(row.filing_answers as Row | Row[] | null);
  const businessRow = one(row.businesses as Row | Row[] | null);
  const authRow = ((authRes.data ?? []) as Row[])[0];
  const orderRow = orderRes.data as Row | null;

  const timeline: TimelineEntry[] = [];
  for (const h of (historyRes.data ?? []) as Row[]) {
    if (!isFilingStatus(h.to_status)) continue;
    timeline.push({
      id: str(h.id),
      fromStatus: strOrNull(h.from_status),
      toStatus: h.to_status,
      actorType: str(h.actor_type),
      note: strOrNull(h.note),
      createdAt: str(h.created_at),
    });
  }

  return {
    filing: {
      ...summary,
      stateCode: str(row.state_code),
      confirmationNumber: strOrNull(row.state_confirmation_number),
      submittedAt: strOrNull(row.submitted_at),
      acceptedAt: strOrNull(row.accepted_at),
      completedAt: strOrNull(row.completed_at),
      rejectionReason: strOrNull(row.rejection_reason),
      snapshot,
      schema: schema && Array.isArray(schema.sections) ? schema : null,
      answers: ((answersRow?.answers ?? {}) as Record<string, unknown>) ?? {},
    },
    business: businessRow ? mapBusiness(businessRow) : null,
    timeline,
    authorization: authRow
      ? { signerName: str(authRow.signer_name), signerTitle: str(authRow.signer_title), createdAt: str(authRow.created_at) }
      : null,
    order: orderRow
      ? {
          id: str(orderRow.id),
          status: str(orderRow.status),
          governmentFeeCents: Number(orderRow.government_fee_cents ?? 0),
          serviceFeeCents: Number(orderRow.service_fee_cents ?? 0),
          totalCents: Number(orderRow.total_cents ?? 0),
          createdAt: str(orderRow.created_at),
          paidAt: strOrNull(orderRow.paid_at),
        }
      : null,
    payments: ((paymentsRes.data ?? []) as Row[]).map((p) => ({
      id: str(p.id),
      status: str(p.status),
      amountCents: Number(p.amount_cents ?? 0),
      receiptUrl: strOrNull(p.receipt_url),
      createdAt: str(p.created_at),
    })),
    refunds: ((refundsRes.data ?? []) as Row[]).map((r) => ({
      id: str(r.id),
      amountCents: Number(r.amount_cents ?? 0),
      governmentFeeCents: Number(r.government_fee_cents ?? 0),
      serviceFeeCents: Number(r.service_fee_cents ?? 0),
      status: str(r.status),
      createdAt: str(r.created_at),
    })),
    documents: ((documentsRes.data ?? []) as Row[]).map((d) => ({
      id: str(d.id),
      kind: str(d.kind),
      fileName: str(d.file_name),
      mimeType: str(d.mime_type),
      sizeBytes: Number(d.size_bytes ?? 0),
      createdAt: str(d.created_at),
    })),
    receipts: ((receiptsRes.data ?? []) as Row[]).map((r) => ({
      id: str(r.id),
      confirmationNumber: strOrNull(r.confirmation_number),
      submittedAt: strOrNull(r.submitted_at),
      stateFeePaidCents: r.state_fee_paid_cents == null ? null : Number(r.state_fee_paid_cents),
      createdAt: str(r.created_at),
    })),
    messages: ((messagesRes.data ?? []) as Row[]).map((m) => ({
      id: str(m.id),
      authorType: str(m.author_type),
      body: str(m.body),
      createdAt: str(m.created_at),
    })),
  };
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ProfileView {
  email: string;
  fullName: string | null;
  phone: string | null;
  reminderEmailsEnabled: boolean;
}

export async function loadSettings(userId: string): Promise<{ profile: ProfileView | null; notifications: NotificationView[] }> {
  const db = await createClient();
  const [profileRes, notificationsRes] = await Promise.all([
    db.from("profiles").select("email, full_name, phone, reminder_emails_enabled").eq("id", userId).maybeSingle(),
    db
      .from("notifications")
      .select("id, subject, status, created_at, sent_at")
      .eq("user_id", userId)
      .neq("subject", "(pending)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const p = profileRes.data as Row | null;
  return {
    profile: p
      ? {
          email: str(p.email),
          fullName: strOrNull(p.full_name),
          phone: strOrNull(p.phone),
          reminderEmailsEnabled: p.reminder_emails_enabled !== false,
        }
      : null,
    notifications: ((notificationsRes.data ?? []) as Row[]).map(mapNotification),
  };
}
