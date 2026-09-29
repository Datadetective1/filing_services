import { SealCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { findRule, getJurisdiction, listJurisdictions } from "@/lib/compliance/registry";
import { PENNSYLVANIA_FACTS } from "@/lib/compliance/states/pennsylvania";
import { verifiedText } from "@/lib/compliance/view";
import { todayInTimeZone } from "@/lib/domain/dates";
import { ENTITY_TYPE_LABELS, ENTITY_TYPES, isEntityType } from "@/lib/domain/types";
import { readPendingLookup } from "@/lib/lookup/pending";
import { LookupForm } from "@/components/funnel/lookup-form";
import type { LookupJurisdictionOption, LookupValues } from "@/components/funnel/types";
import { Photo } from "@/components/media/photo";
import { Container, Notice } from "@/components/ui/surface";
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

  // The trust note on the photo cites the verified Pennsylvania rules and when they were last checked.
  const pa = getJurisdiction("PA");
  const paRule = findRule("PA", "llc");
  const agency = pa?.agency.name.split(" - ")[0] ?? "Pennsylvania Department of State";

  return (
    <section aria-labelledby="find-title" className="overflow-hidden">
      <Container className="grid gap-10 pb-16 pt-8 sm:pt-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-14 lg:pb-24 lg:pt-14">
        <div className="grid min-w-0 content-start gap-7 sm:gap-8">
          <div className="grid gap-3">
            <h1
              id="find-title"
              className="text-[36px] font-semibold leading-[1.04] tracking-[-0.03em] text-fg sm:text-[52px]"
            >
              Find out <span className="mark-highlight">what&apos;s due</span>.
            </h1>
            <p className="max-w-[44ch] text-[17px] leading-relaxed text-muted sm:text-lg">
              Your deadline, the state fee and the official source, in about a minute. No account needed.
            </p>
          </div>

          {one(sp.missing) === "1" ? (
            <Notice tone="info" role="status" title="Let's pick up where you left off">
              We couldn&apos;t find the details you entered earlier in this browser. Enter them again to continue.
            </Notice>
          ) : null}

          <div className="rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-8">
            <LookupForm
              action={submitLookup}
              jurisdictions={options}
              entityOptions={entityOptions}
              defaults={defaults}
              maxDate={todayInTimeZone("America/New_York")}
            />
          </div>

          <p className="max-w-[62ch] text-sm leading-6 text-subtle">
            {site.disclaimer} You can always file directly with your state for the state fee alone.
          </p>
        </div>

        <div className="relative max-lg:hidden lg:sticky lg:top-[92px] lg:self-start">
          <Photo
            photo="cafeLaptop"
            priority
            sizes="(min-width: 1024px) 42vw, 1px"
            className="aspect-[4/5] max-h-[calc(100dvh-8rem)] min-h-[34rem] w-full"
            focus="50% 28%"
          />
          {paRule ? (
            <div className="absolute inset-x-5 bottom-5 flex items-start gap-3 rounded-[var(--radius-surface)] bg-surface/95 p-4 shadow-lift backdrop-blur-sm">
              <SealCheck size={22} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-accent" />
              <p className="text-[15px] leading-6 text-fg">
                <span className="font-semibold">Pennsylvania deadlines and fees come from the {agency}.</span>{" "}
                <span className="text-muted">Last checked {verifiedText(paRule.lastVerifiedAt)}.</span>
              </p>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
