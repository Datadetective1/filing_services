import { todayInTimeZone } from "@/lib/domain/dates";
import { filingWindowOpensOn, isFilingWindowOpen } from "@/lib/domain/deadlines";
import { FILED_STATUSES } from "@/lib/domain/filing-status";
import type { StatusTone } from "@/lib/domain/filing-status";
import type { BusinessView, FilingSummary, RequirementView } from "@/app/(app)/dashboard/_lib/data";
import { continueHref, filingHref, isCustomerEditable, nextCustomerStep, type NextStep } from "./steps";

/**
 * Presentation state for an open requirement. Pure functions, so the dashboard's
 * "what do I need to do next?" panel and the per-business actions describe the
 * same thing.
 *
 *   draft / waiting on you        -> "continue"
 *   in our hands                  -> "view"
 *   filing window not open yet    -> "opens_later" (no "Have us file it" before the window opens)
 *   open and we can file it       -> "start"
 *   otherwise                     -> "none"
 */
export type RequirementAction =
  | { kind: "continue"; filing: FilingSummary; href: string; step: NextStep }
  | { kind: "view"; filing: FilingSummary; href: string }
  | { kind: "opens_later"; opensOn: string }
  | { kind: "start" }
  | { kind: "none" };

export function requirementAction(business: BusinessView, requirement: RequirementView): RequirementAction {
  const filing = requirement.activeFiling;
  if (filing && isCustomerEditable(filing.status)) {
    return { kind: "continue", filing, href: continueHref(filing), step: nextCustomerStep(filing) };
  }
  if (filing) return { kind: "view", filing, href: filingHref(filing.id) };
  if (
    requirement.status === "open" &&
    business.sellable &&
    business.rule &&
    !isFilingWindowOpen(business.rule, requirement.periodYear, requirement.dueDate, todayInTimeZone("America/New_York"))
  ) {
    return { kind: "opens_later", opensOn: filingWindowOpensOn(business.rule, requirement.periodYear, requirement.dueDate) };
  }
  if (requirement.status === "open" && business.sellable) return { kind: "start" };
  return { kind: "none" };
}

/** The "already filed it yourself" escape hatch is offered until we have the filing in hand. */
export function canMarkFiled(requirement: RequirementView): boolean {
  const filing = requirement.activeFiling;
  return requirement.status === "open" && (!filing || filing.status === "draft");
}

// ---------------------------------------------------------------------------
// "What do I need to do next?"
// ---------------------------------------------------------------------------

export interface FocusItem {
  business: BusinessView;
  requirement: RequirementView;
  action: RequirementAction;
}

/** True when the next move is the customer's (not ours, and not "wait for the window"). */
export function needsCustomer(item: FocusItem): boolean {
  const { action, business, requirement } = item;
  if (action.kind === "continue" || action.kind === "start") return true;
  // We can't file it, but the owner still has to: surface it once it's close.
  return action.kind === "none" && Boolean(business.rule) && requirement.daysRemaining <= 90;
}

/**
 * Orders open requirements for the top panel: anything we're waiting on the
 * customer for after an order comes first, then everything else they need to do,
 * earliest due first. `requirements` is already sorted by due date.
 */
export function rankFocus(
  businesses: BusinessView[],
  requirements: RequirementView[],
): { focus: FocusItem | null; others: FocusItem[]; upcoming: FocusItem | null } {
  const byId = new Map(businesses.map((b) => [b.id, b]));
  const items: FocusItem[] = [];
  for (const requirement of requirements) {
    const business = byId.get(requirement.businessId);
    if (!business) continue;
    items.push({ business, requirement, action: requirementAction(business, requirement) });
  }
  const waitingOnYou = (i: FocusItem) =>
    i.action.kind === "continue" && (i.action.filing.status === "needs_customer_action" || i.action.filing.status === "needs_information");
  const needed = items.filter(needsCustomer);
  const ordered = [...needed.filter(waitingOnYou), ...needed.filter((i) => !waitingOnYou(i))];
  const focus = ordered[0] ?? null;
  return {
    focus,
    others: ordered.slice(1),
    upcoming: focus ? null : (items[0] ?? null),
  };
}

// ---------------------------------------------------------------------------
// Business summary pill
// ---------------------------------------------------------------------------

/**
 * One plain label for where a business stands when it has no filing in progress
 * (a filing in progress shows its own status badge instead).
 */
export function businessStanding(
  requirement: RequirementView | null,
  action: RequirementAction | null,
  latestFiling: FilingSummary | null,
): { tone: StatusTone; label: string } {
  if (!requirement || !action) {
    return latestFiling && FILED_STATUSES.includes(latestFiling.status)
      ? { tone: "success", label: "Up to date" }
      : { tone: "neutral", label: "Nothing due" };
  }
  if (action.kind === "opens_later") return { tone: "neutral", label: "Nothing to do yet" };
  const days = requirement.daysRemaining;
  if (days < 0) return { tone: "warning", label: "Past due" };
  if (days <= 30) return { tone: "warning", label: "Due soon" };
  return action.kind === "start" ? { tone: "info", label: "Ready to file" } : { tone: "neutral", label: "Open" };
}
