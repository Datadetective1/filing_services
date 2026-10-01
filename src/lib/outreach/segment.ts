import { findRule } from "@/lib/compliance/registry";
import type { ComplianceRuleDef } from "@/lib/compliance/types";
import { currentFilingPeriod } from "@/lib/domain/deadlines";
import type { ISODate } from "@/lib/domain/types";
import type { EntityType } from "@/lib/domain/types";

/**
 * Which Pennsylvania annual-report situation a business on the register is in, from the
 * verified rules only (deadlines differ by association type: corporations June 30, LLCs
 * September 30, other associations December 31).
 *
 * Filing status is "unknown" unless a source actually says the report was filed. The
 * Department of State open dataset does not publish filing history, so with it every
 * business is "unknown": we never claim a report is outstanding, and the outreach copy
 * says "may be due".
 */

export type EntityGroup = "llc" | "corporation" | "other";
export type CampaignSegment = "approaching_deadline" | "deadline_passed_outstanding" | "unknown_status";

export type Situation =
  | { kind: "unsupported"; reason: string }
  | {
      kind: "assessed";
      group: EntityGroup;
      periodYear: number;
      dueDate: ISODate;
      daysRemaining: number;
      /** First report is a future year (formed this year): nothing is due yet. */
      firstReportLater: boolean;
      /** Known only from a source that publishes filing history; null = unknown. */
      filed: boolean | null;
      /** The campaign segment this business falls in, or null if it should not be contacted. */
      segment: CampaignSegment | null;
      why: string;
    };

export const APPROACHING_WINDOW_DAYS = 60;

/**
 * Sources whose filing-history data may be used to call a report filed or unfiled. Only an
 * authoritative, real-time source may ever be added here. The Department of State monthly
 * open dataset is NOT one (it has no filing history and lags the live register), so this
 * is empty today and every business's filing status is "unknown".
 */
export const AUTHORITATIVE_STATUS_SOURCES: ReadonlySet<string> = new Set<string>();

export function entityGroup(t: EntityType): EntityGroup {
  if (t === "llc") return "llc";
  if (t === "corporation" || t === "nonprofit_corporation") return "corporation";
  return "other";
}

export function assessSituation(input: {
  stateCode: string;
  entityType: EntityType | null;
  isForeign: boolean | null;
  formationDate: ISODate | null;
  /** Years the source says were filed; null when the source doesn't publish history. */
  filedYears: number[] | null;
  /** Where filedYears came from. Ignored unless it is an AUTHORITATIVE_STATUS_SOURCES entry. */
  statusSource?: string | null;
  /** Tests only: override the trusted-source list. */
  trustedSources?: ReadonlySet<string>;
  today: ISODate;
  rule?: ComplianceRuleDef | null;
}): Situation {
  if (!input.entityType) return { kind: "unsupported", reason: "registration type we don't handle" };
  const rule = input.rule ?? findRule(input.stateCode, input.entityType, "annual_report", Boolean(input.isForeign));
  if (!rule || rule.verificationStatus !== "verified") return { kind: "unsupported", reason: "no verified rule for this entity type" };

  const period = currentFilingPeriod(rule, { today: input.today, formationDate: input.formationDate });
  const group = entityGroup(input.entityType);
  const base = {
    kind: "assessed" as const,
    group,
    periodYear: period.periodYear,
    dueDate: period.dueDate,
    daysRemaining: period.daysRemaining,
    firstReportLater: period.phase === "first_report_later",
  };

  if (period.phase === "first_report_later") {
    return { ...base, filed: null, segment: null, why: `first report is the ${period.periodYear} report; nothing due yet` };
  }
  const trusted = Boolean(input.statusSource && (input.trustedSources ?? AUTHORITATIVE_STATUS_SOURCES).has(input.statusSource));
  const filed = trusted && input.filedYears ? input.filedYears.includes(period.periodYear) : null;
  if (filed === true) return { ...base, filed, segment: null, why: `a real-time source verified the ${period.periodYear} report as filed` };

  if (period.daysRemaining >= 0) {
    if (period.daysRemaining > APPROACHING_WINDOW_DAYS) {
      return { ...base, filed, segment: null, why: `due ${period.dueDate}, more than ${APPROACHING_WINDOW_DAYS} days away` };
    }
    return { ...base, filed, segment: "approaching_deadline", why: `${period.periodYear} report due ${period.dueDate} (${period.daysRemaining} days)` };
  }
  if (filed === false) {
    return { ...base, filed, segment: "deadline_passed_outstanding", why: `${period.periodYear} report was due ${period.dueDate}; a real-time source verified it unfiled` };
  }
  return { ...base, filed, segment: "unknown_status", why: `${period.periodYear} report was due ${period.dueDate}; filing status unknown` };
}
