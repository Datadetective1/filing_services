import { describe, expect, it } from "vitest";
import { FILING_STATUSES, type FilingStatus } from "@/lib/domain/filing-status";
import {
  DEFAULT_REMINDER_OFFSETS,
  dueDatePhrase,
  planReminders,
  type ReminderContext,
  reminderDecision,
  STALE_AFTER_DAYS,
  supersededReminderIds,
} from "@/lib/domain/reminders";

describe("planReminders", () => {
  it("dedupes and sorts offsets, and skips offsets whose date has already passed", () => {
    const plan = planReminders("2026-09-30", [0, -30, 7, -90, -30, -1, -3], "2026-09-27");
    expect(plan.map((p) => p.offsetDays)).toEqual([-90, -30, -3, -1, 0, 7]);
    expect(plan).toEqual([
      { offsetDays: -90, scheduledFor: "2026-07-02", status: "skipped", skipReason: "planned_after_send_date" },
      { offsetDays: -30, scheduledFor: "2026-08-31", status: "skipped", skipReason: "planned_after_send_date" },
      // A reminder that falls on the planning day itself is still sent.
      { offsetDays: -3, scheduledFor: "2026-09-27", status: "scheduled" },
      { offsetDays: -1, scheduledFor: "2026-09-29", status: "scheduled" },
      { offsetDays: 0, scheduledFor: "2026-09-30", status: "scheduled" },
      { offsetDays: 7, scheduledFor: "2026-10-07", status: "scheduled" },
    ]);
  });

  it("plans every default offset when planned well ahead", () => {
    const plan = planReminders("2027-09-30", DEFAULT_REMINDER_OFFSETS, "2026-09-27");
    expect(plan).toHaveLength(DEFAULT_REMINDER_OFFSETS.length);
    expect(plan.every((p) => p.status === "scheduled")).toBe(true);
    expect(plan[0]).toMatchObject({ offsetDays: -90, scheduledFor: "2027-07-02" });
    expect(plan.at(-1)).toMatchObject({ offsetDays: 30, scheduledFor: "2027-10-30" });
    const dates = plan.map((p) => p.scheduledFor);
    expect([...dates].sort()).toEqual(dates);
  });

  it("returns an empty plan for no offsets", () => {
    expect(planReminders("2026-09-30", [], "2026-09-27")).toEqual([]);
  });
});

describe("reminderDecision", () => {
  const base: ReminderContext = {
    today: "2026-09-27",
    scheduledFor: "2026-09-27",
    offsetDays: -3,
    requirementStatus: "open",
    filingStatus: null,
    remindersEnabled: true,
  };
  const decide = (over: Partial<ReminderContext>) => reminderDecision({ ...base, ...over });

  it("cancels when the requirement is no longer open", () => {
    for (const s of ["filed_with_us", "filed_elsewhere", "not_required", "cancelled"] as const) {
      expect(decide({ requirementStatus: s })).toEqual({ action: "cancel", reason: `requirement_${s}` });
    }
  });

  it("cancels once the filing is with the state", () => {
    for (const s of ["submitted", "accepted", "completed"] as const) {
      expect(decide({ filingStatus: s })).toEqual({ action: "cancel", reason: "already_filed" });
    }
  });

  it("cancels when the order was cancelled or refunded", () => {
    expect(decide({ filingStatus: "cancelled" })).toEqual({ action: "cancel", reason: "order_cancelled" });
    expect(decide({ filingStatus: "refunded" })).toEqual({ action: "cancel", reason: "order_cancelled" });
  });

  it("cancellation takes precedence over opt-out and timing", () => {
    expect(decide({ filingStatus: "accepted", remindersEnabled: false })).toMatchObject({ action: "cancel" });
    expect(decide({ requirementStatus: "filed_elsewhere", scheduledFor: "2026-12-01" })).toMatchObject({
      action: "cancel",
    });
  });

  it("skips when the customer opted out", () => {
    expect(decide({ remindersEnabled: false })).toEqual({ action: "skip", reason: "opted_out" });
  });

  it("skips a reminder that is not yet due", () => {
    expect(decide({ scheduledFor: "2026-09-28" })).toEqual({ action: "skip", reason: "not_yet_due" });
  });

  it("skips stale reminders instead of sending a backlog", () => {
    expect(STALE_AFTER_DAYS).toBe(2);
    expect(decide({ scheduledFor: "2026-09-24" })).toEqual({ action: "skip", reason: "stale" });
    // Exactly at the staleness limit it still goes out.
    expect(decide({ scheduledFor: "2026-09-25" })).toEqual({ action: "send", templateKey: "reminder_upcoming" });
  });

  it("sends the needs-information variant while waiting on the customer", () => {
    for (const s of ["needs_information", "needs_customer_action"] as const) {
      expect(decide({ filingStatus: s })).toEqual({ action: "send", templateKey: "reminder_needs_information" });
    }
  });

  it("stays silent while the filing is in progress with us", () => {
    for (const s of ["ready_for_review", "ready_to_file", "in_progress", "rejected"] as const) {
      expect(decide({ filingStatus: s })).toEqual({ action: "skip", reason: "in_progress_with_us" });
    }
  });

  it("sends upcoming, due-today and overdue templates when there is no order (or an unpaid draft)", () => {
    for (const filingStatus of [null, "draft"] as const) {
      expect(decide({ filingStatus, offsetDays: -3 })).toEqual({ action: "send", templateKey: "reminder_upcoming" });
      expect(decide({ filingStatus, offsetDays: 0 })).toEqual({ action: "send", templateKey: "reminder_due_today" });
      expect(decide({ filingStatus, offsetDays: 7 })).toEqual({ action: "send", templateKey: "reminder_overdue" });
    }
  });

  it("returns a decision for every filing status", () => {
    for (const s of FILING_STATUSES as readonly FilingStatus[]) {
      const d = decide({ filingStatus: s });
      expect(["send", "skip", "cancel"]).toContain(d.action);
    }
  });
});

describe("dueDatePhrase", () => {
  it("phrases relative due dates", () => {
    expect(dueDatePhrase(0)).toBe("today");
    expect(dueDatePhrase(1)).toBe("tomorrow");
    expect(dueDatePhrase(30)).toBe("in 30 days");
    expect(dueDatePhrase(-1)).toBe("yesterday");
    expect(dueDatePhrase(-7)).toBe("7 days ago");
  });
});

describe("supersededReminderIds", () => {
  const rem = (id: string, scheduled_for: string, requirement_id = "req-1", due_date = "2026-09-30") => ({ id, requirement_id, due_date, scheduled_for });

  it("sends only the most recent of several reminders due in one run (planned late the evening before)", () => {
    // Production case 2026-09-30: the day-before reminder was planned at 10:44 PM on Sep 29,
    // after that day's run, so both it and the due-today reminder were due the next morning.
    const skip = supersededReminderIds([rem("day-before", "2026-09-29"), rem("due-today", "2026-09-30")], "2026-09-30");
    expect([...skip]).toEqual(["day-before"]);
  });

  it("keeps one reminder per requirement and due date, and ignores reminders not due yet", () => {
    const skip = supersededReminderIds(
      [rem("a", "2026-09-28"), rem("b", "2026-09-29"), rem("other", "2026-09-29", "req-2"), rem("tomorrow", "2026-10-01")],
      "2026-09-30",
    );
    expect([...skip].sort()).toEqual(["a"]);
  });

  it("supersedes nothing when a single reminder is due", () => {
    expect(supersededReminderIds([rem("only", "2026-09-30")], "2026-09-30").size).toBe(0);
  });
});
