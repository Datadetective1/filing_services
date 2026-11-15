import { findRule, getJurisdiction } from "@/lib/compliance/registry";
import { isEntityType, type EntityType } from "@/lib/domain/types";

/** Where the calendar event sends the reader back to, tagged so visits show as "calendar". */
export function deadlineHref(stateCode: string): string {
  return `/find?state=${stateCode}&utm_source=calendar&utm_medium=ics&utm_campaign=deadline`;
}

/** Letters, digits and ordinary business-name punctuation only, at most 80 characters. */
export function cleanBusinessName(raw: string | null): string {
  return (raw ?? "")
    .replace(/[^\p{L}\p{N} &.,'()-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** The link the result page puts on "Add to calendar". */
export function calendarLink(input: { stateCode: string; entityType: EntityType; isForeign: boolean; dueDate: string; businessName: string }): string {
  const q = new URLSearchParams({
    state: input.stateCode,
    entity: input.entityType,
    date: input.dueDate,
    name: cleanBusinessName(input.businessName),
  });
  if (input.isForeign) q.set("foreign", "1");
  return `/api/calendar/deadline?${q.toString()}`;
}

export interface DeadlineQuery {
  stateCode: string;
  stateName: string;
  filingName: string;
  dueDate: string;
  businessName: string;
}

/**
 * Validate an "Add to calendar" request. Null when the state, entity type or date isn't one
 * we could have shown (a date more than a year back or two years ahead is refused).
 */
export function parseDeadlineQuery(params: URLSearchParams, today: Date = new Date()): DeadlineQuery | null {
  const j = getJurisdiction(params.get("state") ?? "");
  const entity = params.get("entity");
  const date = params.get("date") ?? "";
  if (!j || !isEntityType(entity) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const due = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(due.getTime()) || due.toISOString().slice(0, 10) !== date) return null;
  const days = (due.getTime() - today.getTime()) / 86_400_000;
  if (days < -366 || days > 731) return null;
  const rule = findRule(j.code, entity, "annual_report", params.get("foreign") === "1");
  if (!rule) return null;
  return { stateCode: j.code, stateName: j.name, filingName: rule.filingName, dueDate: date, businessName: cleanBusinessName(params.get("name")) };
}
