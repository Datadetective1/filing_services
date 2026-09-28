import type { Metadata } from "next";
import { site } from "@/config/site";
import { listJurisdictions } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import { todayInTimeZone } from "@/lib/domain/dates";
import { ENTITY_TYPE_LABELS, ENTITY_TYPES, isEntityType } from "@/lib/domain/types";
import { readPendingLookup } from "@/lib/lookup/pending";
import { LookupForm } from "@/components/funnel/lookup-form";
import type { LookupJurisdictionOption, LookupValues } from "@/components/funnel/types";
import { Card, Container, Notice } from "@/components/ui/surface";
import { submitLookup } from "./actions";
import { readLookupHomeJurisdiction } from "./lookup-extras";

export const metadata: Metadata = {
  title: "Find your business",
  description: "See what your business needs to file, when it's due and what it costs.",
  robots: { index: false, follow: false },
};

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FindPage({ searchParams }: PageProps<"/find">) {
  const sp = await searchParams;
  const jurisdictions = listJurisdictions();
  const codes = new Set(jurisdictions.map((j) => j.code));

  const options: LookupJurisdictionOption[] = [...jurisdictions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((j) => {
      const searchUrl = j.code === "PA" ? PENNSYLVANIA_FACTS.businessSearchUrl : (j.agency.businessSearchUrl ?? j.agency.websiteUrl);
      return { code: j.code, name: j.name, searchUrl, isBusinessSearch: j.code === "PA" || Boolean(j.agency.businessSearchUrl) };
    });

  // Start from what the visitor entered earlier (the "Edit details" path), then let
  // ?state= and ?entity= from a state page take precedence.
  const [pending, pendingHome] = await Promise.all([readPendingLookup(), readLookupHomeJurisdiction()]);
  const qsState = one(sp.state)?.toUpperCase();
  const qsEntity = one(sp.entity);

  const defaults: LookupValues = {
    legalName: pending?.legalName ?? "",
    stateCode: qsState && codes.has(qsState) ? qsState : (pending?.stateCode ?? "PA"),
    entityType: qsEntity && isEntityType(qsEntity) ? qsEntity : (pending?.entityType ?? ""),
    formationDate: pending?.formationDate ?? "",
    entityNumber: pending?.entityNumber ?? "",
    isForeign: pending?.isForeign ?? false,
    homeJurisdiction: pendingHome ?? "",
    isNonprofit: pending?.isNonprofit ?? false,
    alreadyFiledThisYear: pending?.alreadyFiledThisYear ?? false,
  };

  const entityOptions = ENTITY_TYPES.map((t) => ({ value: t, label: ENTITY_TYPE_LABELS[t] }));

  return (
    <Container className="max-w-2xl py-10 sm:py-16">
      <div className="grid gap-3">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-fg sm:text-4xl">Find your business</h1>
        <p className="max-w-[58ch] text-[17px] leading-relaxed text-muted">
          Tell us about your business and we&apos;ll show what it needs to file, when it&apos;s due and what it costs. We
          currently prepare and file Pennsylvania annual reports. For other states we&apos;ll point you to the official
          agency.
        </p>
      </div>

      {one(sp.missing) === "1" ? (
        <Notice tone="info" role="status" title="Let's pick up where you left off" className="mt-6">
          We couldn&apos;t find the details you entered earlier in this browser. Enter them again to continue.
        </Notice>
      ) : null}

      <Card className="mt-8 p-5 sm:p-8">
        <LookupForm
          action={submitLookup}
          jurisdictions={options}
          entityOptions={entityOptions}
          defaults={defaults}
          maxDate={todayInTimeZone("America/New_York")}
        />
      </Card>

      <p className="mt-6 text-sm leading-relaxed text-muted">
        {site.disclaimer} You can always file directly with your state for the state fee alone.
      </p>
    </Container>
  );
}
