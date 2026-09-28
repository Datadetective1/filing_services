import { ArrowLeft, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { findRule, getJurisdiction, isRuleSellable } from "@/lib/compliance/registry";
import { describeDaysRemaining, formatLongDate, todayInTimeZone } from "@/lib/domain/dates";
import type { FilingPeriod } from "@/lib/domain/deadlines";
import { ENTITY_TYPE_LABELS } from "@/lib/domain/types";
import { periodFor } from "@/lib/filings/customer";
import { readPendingLookup } from "@/lib/lookup/pending";
import { readLookupHomeJurisdiction } from "@/app/(marketing)/find/lookup-extras";
import { ActionForm } from "@/components/funnel/action-form";
import { entityPhrase } from "@/components/funnel/entity-noun";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { buttonClasses } from "@/components/ui/button";
import { Card, Container, Facts, Notice } from "@/components/ui/surface";
import { confirmStart } from "./actions";

export const metadata: Metadata = {
  title: "Confirm your business",
  robots: { index: false, follow: false },
};

export default async function FileStartPage({ searchParams }: PageProps<"/file/start">) {
  await requireUser("/file/start");
  const sp = await searchParams;
  const lookup = await readPendingLookup();
  if (!lookup) redirect("/find?missing=1");

  const homeJurisdiction = lookup.isForeign ? await readLookupHomeJurisdiction() : null;
  const jurisdiction = getJurisdiction(lookup.stateCode);
  const stateName = jurisdiction?.name ?? lookup.stateCode;
  const agencyName = jurisdiction?.agency.name.split(" - ")[0] ?? `${stateName} state agency`;
  const rule = findRule(lookup.stateCode, lookup.entityType, "annual_report", lookup.isForeign);
  const supported = Boolean(rule && rule.verificationStatus === "verified" && isRuleSellable(rule));

  let period: FilingPeriod | null = null;
  if (rule) {
    try {
      period = periodFor(rule, { formationDate: lookup.formationDate, alreadyFiledThisYear: lookup.alreadyFiledThisYear });
    } catch {
      period = null;
    }
  }
  const currentYear = Number(todayInTimeZone(jurisdiction?.timezone ?? "America/New_York").slice(0, 4));
  const nothingDueYet = period !== null && period.periodYear > currentYear;
  const track = sp.mode === "track" || nothingDueYet;

  return (
    <Container className="max-w-2xl py-8 sm:py-12">
      {!track && supported ? <FunnelSteps current="details" className="mb-8" /> : null}

      <div className="grid gap-2">
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">
          {track ? "Add your business for reminders" : "Confirm your business"}
        </h1>
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted">
          {track
            ? "We'll add it to your account and email you before the report is due. There's nothing to pay now."
            : `We'll add it to your account and start your ${stateName} ${rule?.filingName ?? "annual report"}. Next, you'll confirm the details the state asks for.`}
        </p>
      </div>

      {!supported ? (
        <Notice tone="warning" role="alert" title="We can't file this one yet" className="mt-8">
          <p>
            We don&apos;t have verified filing rules for {entityPhrase(stateName, lookup.entityType)}.
          </p>
          <p className="mt-2">
            <Link href="/find" className="font-medium text-fg underline underline-offset-4">
              Check a different business
            </Link>
          </p>
        </Notice>
      ) : (
        <Card className="mt-8 grid gap-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight text-fg">Your business</h2>
            <Link
              href="/find"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
            >
              <ArrowLeft size={16} aria-hidden />
              Edit details
            </Link>
          </div>
          <Facts
            items={[
              { term: "Legal name", value: <span className="[overflow-wrap:anywhere]">{lookup.legalName}</span> },
              { term: "State", value: stateName },
              { term: "Entity type", value: ENTITY_TYPE_LABELS[lookup.entityType] },
              { term: "Formation date", value: lookup.formationDate ? formatLongDate(lookup.formationDate) : "Not entered" },
              { term: "State entity number", value: lookup.entityNumber ?? "Not entered" },
              ...(lookup.isForeign
                ? [{ term: "Formed in", value: homeJurisdiction ?? "Outside " + stateName }]
                : []),
              ...(lookup.isNonprofit ? [{ term: "Not-for-profit purpose", value: "Yes" }] : []),
            ]}
          />

          {period ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-control)] bg-surface-2 px-3 py-2.5 text-[15px]">
              <CalendarBlank size={20} className="mt-0.5 shrink-0 text-fg" aria-hidden />
              {period.phase === "first_report_later" ? (
                <p className="text-fg">
                  No report due this year. The first one is due by {formatLongDate(period.dueDate)}.
                </p>
              ) : (
                <p className="text-fg">
                  {period.periodYear} report due {formatLongDate(period.dueDate)}
                  <span className="tnum text-muted"> ({describeDaysRemaining(period.daysRemaining).toLowerCase()})</span>
                </p>
              )}
            </div>
          ) : null}

          <ActionForm
            action={confirmStart}
            hidden={{ mode: track ? "track" : "file" }}
            label={track ? "Save and get reminders" : "Continue to details"}
            pendingLabel={track ? "Adding…" : "Starting…"}
          />
        </Card>
      )}

      <p className="mt-6 text-sm leading-relaxed text-muted">
        Nothing is charged until checkout, where you&apos;ll see the state fee and our service fee separately. You can
        also file directly with the {agencyName} for the state fee alone.
      </p>

      {!supported ? (
        <div className="mt-6">
          <Link href="/dashboard" className={buttonClasses("secondary", "md", "h-11")}>
            Go to your dashboard
          </Link>
        </div>
      ) : null}
    </Container>
  );
}
