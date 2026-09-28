import "server-only";
import { formatCents } from "@/lib/domain/money";
import { formatLongDate } from "@/lib/domain/dates";
import { FILING_STATUS_LABELS, type FilingStatus } from "@/lib/domain/filing-status";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FilingContext {
  filing: {
    id: string;
    userId: string;
    businessId: string;
    orderId: string | null;
    requirementId: string | null;
    status: FilingStatus;
    stateCode: string;
    periodYear: number;
    dueDate: string;
    confirmationNumber: string | null;
    ruleSnapshot: Record<string, unknown>;
  };
  businessName: string;
  stateName: string;
  filingTitle: string;
  vars: Record<string, string>;
}

/** Server-only loader used to build notifications and operator views. */
export async function loadFilingContext(filingId: string): Promise<FilingContext | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("filings")
    .select(
      "id, user_id, business_id, order_id, requirement_id, status, state_code, period_year, due_date, state_confirmation_number, rule_snapshot, businesses(legal_name), states(name), orders(total_cents)",
    )
    .eq("id", filingId)
    .maybeSingle();
  if (!data) return null;

  const business = one(data.businesses) as { legal_name: string } | null;
  const state = one(data.states) as { name: string } | null;
  const order = one(data.orders) as { total_cents: number } | null;
  const snapshot = (data.rule_snapshot ?? {}) as Record<string, unknown>;
  const filingTitle = String(snapshot.filing_name ?? "Annual Report");
  const status = data.status as FilingStatus;

  return {
    filing: {
      id: data.id,
      userId: data.user_id,
      businessId: data.business_id,
      orderId: data.order_id,
      requirementId: data.requirement_id,
      status,
      stateCode: data.state_code,
      periodYear: data.period_year,
      dueDate: data.due_date,
      confirmationNumber: data.state_confirmation_number,
      ruleSnapshot: snapshot,
    },
    businessName: business?.legal_name ?? "Your business",
    stateName: state?.name ?? data.state_code,
    filingTitle,
    vars: {
      company_name: business?.legal_name ?? "Your business",
      state_name: state?.name ?? data.state_code,
      filing_title: filingTitle,
      due_date: formatLongDate(data.due_date),
      status_label: FILING_STATUS_LABELS[status],
      confirmation_number: data.state_confirmation_number ?? "—",
      amount: order ? formatCents(order.total_cents) : "",
    },
  };
}

/** PostgREST returns embedded to-one relations as an object or a one-element array. */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
