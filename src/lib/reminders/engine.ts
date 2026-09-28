import "server-only";
import { getJurisdiction, RULES } from "@/lib/compliance/registry";
import { addDays, daysBetween, todayInTimeZone } from "@/lib/domain/dates";
import { nextFilingPeriod } from "@/lib/domain/deadlines";
import type { FilingStatus } from "@/lib/domain/filing-status";
import {
  DEFAULT_REMINDER_OFFSETS,
  dueDatePhrase,
  planReminders,
  reminderDecision,
  type RequirementStatus,
} from "@/lib/domain/reminders";
import { formatLongDate } from "@/lib/domain/dates";
import { sendNotification } from "@/lib/notifications/send";
import { createAdminClient } from "@/lib/supabase/admin";

const db = () => createAdminClient();

function stateToday(stateCode: string, now: Date): string {
  return todayInTimeZone(getJurisdiction(stateCode)?.timezone ?? "America/New_York", now);
}

async function reminderOffsets(filingTypeCode: string, stateCode: string): Promise<number[]> {
  const { data } = await db()
    .from("reminder_schedules")
    .select("offsets_days, filing_type_code, state_code")
    .eq("active", true);
  const rows = data ?? [];
  const score = (r: { filing_type_code: string | null; state_code: string | null }) =>
    (r.state_code === stateCode ? 2 : r.state_code ? -10 : 0) + (r.filing_type_code === filingTypeCode ? 1 : r.filing_type_code ? -10 : 0);
  const best = rows.filter((r) => score(r) >= 0).sort((a, b) => score(b) - score(a))[0];
  return (best?.offsets_days as number[] | undefined) ?? [...DEFAULT_REMINDER_OFFSETS];
}

async function ruleMeta(ruleId: string) {
  const { data } = await db()
    .from("compliance_rules")
    .select("rule_key, state_code, filing_type_code")
    .eq("id", ruleId)
    .single();
  return data as { rule_key: string; state_code: string; filing_type_code: string };
}

/** Idempotently create the reminder rows for a requirement's current due date. */
export async function ensureRemindersForRequirement(requirementId: string, now = new Date()): Promise<number> {
  const { data: req } = await db().from("filing_requirements").select("*").eq("id", requirementId).single();
  if (!req || req.status !== "open") return 0;
  const meta = await ruleMeta(req.rule_id);
  const offsets = await reminderOffsets(meta.filing_type_code, meta.state_code);
  const plan = planReminders(req.due_date, offsets, stateToday(meta.state_code, now));
  const rows = plan.map((p) => ({
    requirement_id: req.id,
    user_id: req.owner_user_id,
    business_id: req.business_id,
    due_date: req.due_date,
    offset_days: p.offsetDays,
    channel: "email",
    scheduled_for: p.scheduledFor,
    status: p.status,
    skip_reason: p.skipReason ?? null,
    processed_at: p.status === "skipped" ? now.toISOString() : null,
  }));
  const { error, count } = await db()
    .from("reminders")
    .upsert(rows, { onConflict: "requirement_id,due_date,offset_days,channel", ignoreDuplicates: true, count: "exact" });
  if (error) throw new Error(`reminder planning failed: ${error.message}`);
  return count ?? 0;
}

/** Once a period is resolved, open the next one so reminders continue next year. */
export async function rollForwardRequirement(requirementId: string, now = new Date()): Promise<string | null> {
  const { data: req } = await db().from("filing_requirements").select("*").eq("id", requirementId).single();
  if (!req || !["filed_with_us", "filed_elsewhere"].includes(req.status)) return null;
  const meta = await ruleMeta(req.rule_id);
  const rule = RULES.find((r) => r.ruleKey === meta.rule_key);
  if (!rule) return null;
  const { data: business } = await db().from("businesses").select("formation_date, archived_at").eq("id", req.business_id).single();
  if (!business || business.archived_at) return null;
  const next = nextFilingPeriod(rule, req.period_year, business.formation_date);
  if (!next) return null;
  const { data: created, error } = await db()
    .from("filing_requirements")
    .upsert(
      {
        business_id: req.business_id,
        owner_user_id: req.owner_user_id,
        rule_id: req.rule_id,
        period_year: next.periodYear,
        due_date: next.dueDate,
        status: "open",
      },
      { onConflict: "business_id,rule_id,period_year", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`roll forward failed: ${error.message}`);
  const nextId =
    created?.id ??
    (
      await db()
        .from("filing_requirements")
        .select("id")
        .eq("business_id", req.business_id)
        .eq("rule_id", req.rule_id)
        .eq("period_year", next.periodYear)
        .single()
    ).data?.id;
  if (nextId) await ensureRemindersForRequirement(nextId, now);
  return nextId ?? null;
}

export interface DispatchSummary {
  examined: number;
  sent: number;
  skipped: number;
  cancelled: number;
  failed: number;
  /** Examined but scheduled for a later day in the state's time zone; left untouched. */
  deferred: number;
  rolledForward: number;
  planned: number;
}

/**
 * Daily job: roll resolved periods forward, make sure open requirements have their
 * reminders planned, then evaluate every reminder that is due today (or slightly
 * overdue) and send, skip or cancel it.
 */
export async function runReminderCycle(now = new Date()): Promise<DispatchSummary> {
  const summary: DispatchSummary = { examined: 0, sent: 0, skipped: 0, cancelled: 0, failed: 0, deferred: 0, rolledForward: 0, planned: 0 };
  const today = todayInTimeZone("America/New_York", now);

  // 1. Roll forward resolved requirements that don't yet have a successor.
  const { data: resolved } = await db()
    .from("filing_requirements")
    .select("id, business_id, rule_id, period_year")
    .in("status", ["filed_with_us", "filed_elsewhere"])
    .gte("period_year", Number(today.slice(0, 4)) - 1);
  for (const r of resolved ?? []) {
    const { count } = await db()
      .from("filing_requirements")
      .select("id", { count: "exact", head: true })
      .eq("business_id", r.business_id)
      .eq("rule_id", r.rule_id)
      .gt("period_year", r.period_year);
    if (!count) {
      if (await rollForwardRequirement(r.id, now)) summary.rolledForward++;
    }
  }

  // 2. Plan reminders for open requirements in the active window.
  const { data: open } = await db()
    .from("filing_requirements")
    .select("id")
    .eq("status", "open")
    .gte("due_date", addDays(today, -45))
    .lte("due_date", addDays(today, 120));
  for (const r of open ?? []) summary.planned += await ensureRemindersForRequirement(r.id, now);

  // 3. Dispatch.
  const { data: due } = await db()
    .from("reminders")
    .select("id, requirement_id, user_id, business_id, due_date, offset_days, scheduled_for")
    .eq("status", "scheduled")
    .lte("scheduled_for", addDays(today, 1))
    .order("scheduled_for", { ascending: true })
    .limit(1000);

  for (const rem of due ?? []) {
    summary.examined++;
    try {
      const outcome = await dispatchOne(rem, now);
      summary[outcome]++;
    } catch {
      summary.failed++;
      await db().from("reminders").update({ status: "failed", processed_at: now.toISOString() }).eq("id", rem.id);
    }
  }
  return summary;
}

async function dispatchOne(
  rem: { id: string; requirement_id: string; user_id: string; business_id: string; due_date: string; offset_days: number; scheduled_for: string },
  now: Date,
): Promise<"sent" | "skipped" | "cancelled" | "failed" | "deferred"> {
  const { data: req } = await db()
    .from("filing_requirements")
    .select("id, status, due_date, rule_id, period_year, business_id")
    .eq("id", rem.requirement_id)
    .single();
  const meta = await ruleMeta(req!.rule_id);
  const today = stateToday(meta.state_code, now);

  // Do not act on reminders scheduled for tomorrow in the state's time zone.
  if (rem.scheduled_for > today) return "deferred";

  const [{ data: filing }, { data: profile }, { data: business }] = await Promise.all([
    db()
      .from("filings")
      .select("id, status")
      .eq("requirement_id", rem.requirement_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db().from("profiles").select("reminder_emails_enabled").eq("id", rem.user_id).single(),
    db().from("businesses").select("legal_name, archived_at").eq("id", rem.business_id).single(),
  ]);

  const decision = business?.archived_at
    ? ({ action: "cancel", reason: "business_archived" } as const)
    : reminderDecision({
        today,
        scheduledFor: rem.scheduled_for,
        offsetDays: rem.offset_days,
        requirementStatus: (req!.status as RequirementStatus) ?? "open",
        filingStatus: (filing?.status as FilingStatus | undefined) ?? null,
        remindersEnabled: profile?.reminder_emails_enabled ?? true,
      });

  if (decision.action === "skip" && decision.reason === "not_yet_due") return "deferred";

  if (decision.action !== "send") {
    await db()
      .from("reminders")
      .update({
        status: decision.action === "cancel" ? "cancelled" : "skipped",
        skip_reason: decision.reason,
        processed_at: now.toISOString(),
      })
      .eq("id", rem.id)
      .eq("status", "scheduled");
    return decision.action === "cancel" ? "cancelled" : "skipped";
  }

  const jurisdiction = getJurisdiction(meta.state_code);
  const rule = RULES.find((r) => r.ruleKey === meta.rule_key);
  const result = await sendNotification({
    userId: rem.user_id,
    templateKey: decision.templateKey,
    dedupeKey: `reminder:${rem.id}`,
    vars: {
      company_name: business?.legal_name ?? "Your business",
      state_name: jurisdiction?.name ?? meta.state_code,
      filing_title: rule?.filingName ?? "Annual Report",
      due_date: formatLongDate(rem.due_date),
      due_phrase: dueDatePhrase(daysBetween(today, rem.due_date)),
    },
    ctaPath: filing ? `/dashboard/filings/${filing.id}` : `/dashboard/businesses/${rem.business_id}`,
    businessId: rem.business_id,
    filingId: filing?.id ?? null,
  });

  const status = result.status === "sent" || result.status === "duplicate" ? "sent" : result.status === "suppressed" ? "skipped" : "failed";
  await db()
    .from("reminders")
    .update({
      status,
      notification_id: result.notificationId,
      skip_reason: result.status === "suppressed" ? "no_email" : null,
      processed_at: now.toISOString(),
    })
    .eq("id", rem.id);
  return status === "sent" ? "sent" : status === "skipped" ? "skipped" : "failed";
}
