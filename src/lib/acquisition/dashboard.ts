import "server-only";
import { PAID_SOURCES } from "@/lib/analytics/attribution";
import type { AnalyticsEvent } from "@/lib/analytics/events";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Organic acquisition numbers for the admin dashboard, from first-party analytics events,
 * live paid orders and the attribution captured with each business. Aggregates only: no
 * names, emails or other personal data leave this module.
 */

const db = () => createAdminClient();
const BATCH = 1000;
const MAX_ROWS = 100_000;

export const ACQ_STEPS: { key: string; label: string; events: AnalyticsEvent[] }[] = [
  { key: "visits", label: "Visits", events: ["visit_started"] },
  { key: "searches", label: "Business searches", events: ["registry_search"] },
  { key: "records", label: "Records viewed", events: ["lookup_completed"] },
  { key: "optins", label: "Reminder opt-ins", events: ["reminder_opt_in"] },
  { key: "starts", label: "Filing starts", events: ["intake_started"] },
  { key: "checkouts", label: "Checkout starts", events: ["checkout_started"] },
];

export interface StepCount {
  key: string;
  label: string;
  total: number;
  bySource: Record<string, number>;
}

export interface AcquisitionSummary {
  since: string;
  steps: StepCount[];
  paid: { total: number; bySource: Record<string, number>; zeroPaidMedia: number; serviceRevenueCents: number; stripeFeeCents: number };
  sources: string[];
  reminders: { optIns: number; confirmed: number; unsubscribed: number; sent: number; clicks: number; startsFromReminder: number; paidFromReminder: number; activeSubscribers: number };
  byState: StateRow[];
  truncated: boolean;
}

interface EventRow {
  event_name: AnalyticsEvent;
  state_code: string | null;
  properties: Record<string, unknown> | null;
}

export const COMPARE_STATES = ["PA", "WA", "NV", "UT"] as const;

export interface StateRow {
  state: string;
  pageViews: number;
  searches: number;
  records: number;
  optins: number;
  starts: number;
  checkouts: number;
  paid: number;
  revenueCents: number;
}

const sourceOf = (p: Record<string, unknown> | null | undefined, key: "lt_source" | "ft_source" = "lt_source") =>
  (typeof p?.[key] === "string" ? (p[key] as string) : "unknown") || "unknown";

/** Stripe's standard US card pricing, as an estimate: 2.9% + $0.30 per charge. */
export const stripeFeeEstimate = (totalCents: number) => Math.round(totalCents * 0.029) + 30;

export async function acquisitionSummary(sinceIso: string, model: "lt_source" | "ft_source" = "lt_source"): Promise<AcquisitionSummary> {
  const events = [
    ...new Set<AnalyticsEvent>([
      ...ACQ_STEPS.flatMap((s) => s.events),
      "reminder_confirmed",
      "reminder_unsubscribed",
      "reminder_sent",
      "reminder_clicked",
      "state_page_viewed",
      "lookup_started",
    ]),
  ];
  const rows: EventRow[] = [];
  let truncated = false;
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const { data, error } = await db()
      .from("analytics_events")
      .select("event_name, state_code, properties")
      .in("event_name", events)
      .gte("created_at", sinceIso)
      .order("id", { ascending: true })
      .range(offset, offset + BATCH - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as EventRow[]));
    if ((data ?? []).length < BATCH) break;
    if (offset + BATCH >= MAX_ROWS) truncated = true;
  }

  const steps: StepCount[] = ACQ_STEPS.map((s) => ({ key: s.key, label: s.label, total: 0, bySource: {} }));
  const stepByEvent = new Map<string, StepCount>();
  ACQ_STEPS.forEach((s, i) => s.events.forEach((e) => stepByEvent.set(e, steps[i])));
  const reminders = { optIns: 0, confirmed: 0, unsubscribed: 0, sent: 0, clicks: 0, startsFromReminder: 0, paidFromReminder: 0, activeSubscribers: 0 };
  const byState = new Map<string, StateRow>(
    COMPARE_STATES.map((st) => [st, { state: st, pageViews: 0, searches: 0, records: 0, optins: 0, starts: 0, checkouts: 0, paid: 0, revenueCents: 0 }]),
  );
  for (const r of rows) {
    const sr = r.state_code ? byState.get(r.state_code) : undefined;
    if (sr) {
      if (r.event_name === "state_page_viewed") sr.pageViews++;
      if (r.event_name === "registry_search" || r.event_name === "lookup_started") sr.searches++;
      if (r.event_name === "lookup_completed") sr.records++;
      if (r.event_name === "reminder_opt_in") sr.optins++;
      if (r.event_name === "intake_started") sr.starts++;
      if (r.event_name === "checkout_started") sr.checkouts++;
    }
    const src = sourceOf(r.properties, model);
    const step = stepByEvent.get(r.event_name);
    if (step) {
      step.total++;
      step.bySource[src] = (step.bySource[src] ?? 0) + 1;
    }
    if (r.event_name === "reminder_opt_in") reminders.optIns++;
    if (r.event_name === "reminder_confirmed") reminders.confirmed++;
    if (r.event_name === "reminder_unsubscribed") reminders.unsubscribed++;
    if (r.event_name === "reminder_sent") reminders.sent++;
    if (r.event_name === "reminder_clicked" && r.properties?.channel === "subscriber") reminders.clicks++;
    if (r.event_name === "intake_started" && (sourceOf(r.properties) === "reminder" || sourceOf(r.properties, "ft_source") === "reminder")) {
      reminders.startsFromReminder++;
    }
  }

  // Paid customers: live paid orders in the range, attributed through the business.
  const { data: orders } = await db()
    .from("orders")
    .select("business_id, user_id, service_fee_cents, total_cents, businesses(state_code)")
    .in("status", ["paid", "partially_refunded"])
    .eq("payment_mode", "live")
    .gte("paid_at", sinceIso)
    .limit(20000);
  const businessIds = [...new Set((orders ?? []).map((o) => o.business_id as string))];
  const attrByBusiness = new Map<string, { ft?: { s?: string }; lt?: { s?: string } }>();
  if (businessIds.length) {
    const { data: attrs } = await db().from("business_attribution").select("business_id, attribution").in("business_id", businessIds);
    for (const a of attrs ?? []) attrByBusiness.set(a.business_id as string, a.attribution as { ft?: { s?: string }; lt?: { s?: string } });
  }
  const paid = { total: 0, bySource: {} as Record<string, number>, zeroPaidMedia: 0, serviceRevenueCents: 0, stripeFeeCents: 0 };
  const customers = new Set<string>();
  for (const o of orders ?? []) {
    const a = attrByBusiness.get(o.business_id as string);
    const src = (model === "ft_source" ? a?.ft?.s : a?.lt?.s) ?? "unknown";
    paid.bySource[src] = (paid.bySource[src] ?? 0) + 1;
    paid.serviceRevenueCents += Number(o.service_fee_cents);
    const bst = (o.businesses as unknown as { state_code?: string } | null)?.state_code;
    const sr = bst ? byState.get(bst) : undefined;
    if (sr) {
      sr.paid++;
      sr.revenueCents += Number(o.service_fee_cents);
    }
    paid.stripeFeeCents += stripeFeeEstimate(Number(o.total_cents));
    if (!customers.has(o.user_id as string)) {
      customers.add(o.user_id as string);
      if (!PAID_SOURCES.has(a?.ft?.s ?? "") && !PAID_SOURCES.has(a?.lt?.s ?? "")) paid.zeroPaidMedia++;
    }
    if (a?.lt?.s === "reminder" || a?.ft?.s === "reminder") reminders.paidFromReminder++;
  }
  paid.total = customers.size;

  const { count: active } = await db().from("reminder_subscribers").select("id", { count: "exact", head: true }).eq("status", "confirmed");
  reminders.activeSubscribers = active ?? 0;

  const sourceTotals = new Map<string, number>();
  for (const s of steps) for (const [k, v] of Object.entries(s.bySource)) sourceTotals.set(k, (sourceTotals.get(k) ?? 0) + v);
  for (const k of Object.keys(paid.bySource)) sourceTotals.set(k, (sourceTotals.get(k) ?? 0) + 1000);
  const sources = [...sourceTotals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  return { since: sinceIso, steps, paid, sources, reminders, byState: [...byState.values()], truncated };
}
