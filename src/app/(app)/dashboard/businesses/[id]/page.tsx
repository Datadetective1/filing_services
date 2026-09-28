import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { getJurisdiction } from "@/lib/compliance/registry";
import { formatLongDate, isISODate } from "@/lib/domain/dates";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { formatAddress } from "@/lib/intake/validate";
import { Badge, FilingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { Card, Container, Facts, PageHeader } from "@/components/ui/surface";
import { OfficialSource } from "@/components/compliance/official-source";
import { StatusPair, businessMeta } from "@/components/dashboard/business-row";
import { DaysRemaining, DueDate } from "@/components/dashboard/due-info";
import { formatTimestampDate, requirementStatusLabel, standingText } from "@/components/dashboard/format";
import { DashboardNotices } from "@/components/dashboard/notices";
import { FileDirectlyNote, RequirementActions } from "@/components/dashboard/requirement-actions";
import { backLinkClass, DashboardSection, quietLinkClass } from "@/components/dashboard/section";
import { filingHref } from "@/components/dashboard/steps";
import { loadBusinessDetail, type AddressView, type BusinessView, type PersonView } from "../../_lib/data";

export const metadata: Metadata = {
  title: "Business",
  robots: { index: false, follow: false },
};

const ADDRESS_LABELS: Record<AddressView["kind"], string> = {
  principal_office: "Principal office",
  registered_office: "Registered office",
  mailing: "Mailing address",
};

function addressText(a: AddressView): string {
  if (a.kind === "registered_office" && a.cropName) {
    return `${a.cropName} (commercial registered office provider)${a.county ? `, ${a.county} County` : ""}`;
  }
  const base = formatAddress({
    line1: a.line1 ?? "",
    line2: a.line2 ?? "",
    city: a.city ?? "",
    region: a.region ?? "",
    postal_code: a.postalCode ?? "",
  });
  return a.county ? `${base} (${a.county} County)` : base;
}

function publicRulesHref(business: BusinessView): string | null {
  if (!business.stateSlug) return null;
  if (business.rule) return `/annual-report/${business.stateSlug}/${ENTITY_TYPE_SLUGS[business.entityType]}`;
  return `/states/${business.stateSlug}`;
}

function governorLabel(business: BusinessView): string {
  const field = business.rule?.intake.sections.flatMap((s) => s.fields).find((f) => f.key === "governors");
  return field?.label ?? "Governors";
}

function PeopleGroup({ title, people }: { title: string; people: PersonView[] }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-sm text-muted">{title}</p>
      {people.length > 0 ? (
        <ul className="grid gap-1 text-[15px] text-fg">
          {people.map((p) => (
            <li key={p.id}>
              {p.fullName}
              <span className="text-muted">, {p.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15px] text-subtle">None on file</p>
      )}
    </div>
  );
}

export default async function BusinessPage(props: PageProps<"/dashboard/businesses/[id]">) {
  const { id } = await props.params;
  const user = await requireUser(`/dashboard/businesses/${encodeURIComponent(id)}`);
  const [searchParams, detail] = await Promise.all([props.searchParams, loadBusinessDetail(user.id, id)]);
  if (!detail) notFound();

  const { business, addresses, people, requirements, filings } = detail;
  const jurisdiction = getJurisdiction(business.stateCode);
  const agency = jurisdiction?.agency.name.split(" - ")[0] ?? `${business.stateName} state agency`;
  const openRequirements = requirements
    .filter((r) => r.status === "open")
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
  const rulesHref = publicRulesHref(business);
  const returnTo = `/dashboard/businesses/${business.id}` as const;

  const governors = people.filter((p) => p.roleKind === "governor" || p.roleKind === "governor_and_officer");
  const officers = people.filter((p) => p.roleKind === "officer" || p.roleKind === "governor_and_officer");

  return (
    <Container className="grid gap-10 py-8 sm:py-12">
      <div className="grid gap-4">
        <Link href="/dashboard" className={backLinkClass}>
          <ArrowLeft size={16} aria-hidden />
          All businesses
        </Link>
        <PageHeader title={<span className="break-words">{business.legalName}</span>} description={businessMeta(business)} />
      </div>

      <DashboardNotices searchParams={searchParams} addedMessage="Business added. We'll remind you before it's due." />

      <DashboardSection id="open-filings" title={openRequirements.length > 1 ? "Open filings" : "Next filing"}>
        {openRequirements.length > 0 ? (
          <div className="grid gap-4">
            {openRequirements.map((req) => (
              <Card key={req.id} className="overflow-hidden">
                <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="grid gap-3">
                    <div className="grid gap-0.5">
                      <h3 className="text-lg font-semibold tracking-tight text-fg">
                        {req.periodYear} {business.stateName} {req.filingName}
                      </h3>
                      <p className="text-[15px] text-fg">
                        Due <DueDate value={req.dueDate} />
                        <span aria-hidden className="mx-1.5 text-subtle">
                          ·
                        </span>
                        <DaysRemaining requirement={req} />
                      </p>
                    </div>
                    <StatusPair filing={req.activeFiling} />
                  </div>
                  <RequirementActions business={business} requirement={req} returnTo={returnTo} className="md:justify-items-end" />
                </div>
                {business.rule && (!req.activeFiling || req.activeFiling.status === "draft") ? (
                  <div className="border-t border-border bg-surface-2/50 px-5 py-3 sm:px-6">
                    <FileDirectlyNote business={business} />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-5 sm:p-6">
            <p className="font-medium text-fg">Nothing open right now</p>
            <p className="mt-1 text-sm text-muted">
              {business.rule
                ? "When the next filing period opens, it will appear here and we'll remind you before it's due."
                : "We don't track filings for this state and entity type yet."}
            </p>
          </Card>
        )}

        {business.rule ? (
          <div className="grid gap-2 text-sm text-muted">
            <p className="max-w-[70ch]">
              Based on the {agency}&apos;s published requirements: {business.rule.customerSummary}
            </p>
            <OfficialSource href={business.rule.officialInfoUrl} agency={agency} lastVerifiedAt={business.rule.lastVerifiedAt} />
          </div>
        ) : null}
      </DashboardSection>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
        <DashboardSection id="record" title="Business record">
          <Card className="grid gap-5 p-5 sm:p-6">
            <Facts
              items={[
                { term: "Legal name", value: <span className="break-words">{business.legalName}</span> },
                { term: "State", value: business.stateName },
                { term: "Entity type", value: ENTITY_TYPE_LABELS[business.entityType] },
                {
                  term: "Entity number",
                  value: business.entityNumber ? (
                    <span className="tnum">{business.entityNumber}</span>
                  ) : (
                    <span className="text-subtle">Not provided</span>
                  ),
                },
                {
                  term: "Formation date",
                  value:
                    business.formationDate && isISODate(business.formationDate) ? (
                      <span className="tnum">{formatLongDate(business.formationDate)}</span>
                    ) : (
                      <span className="text-subtle">Not provided</span>
                    ),
                },
                {
                  term: "Domestic or foreign",
                  value: business.isForeign
                    ? `Foreign, formed in ${business.homeJurisdiction ?? "another jurisdiction"}`
                    : `Domestic, formed in ${business.stateName}`,
                },
                { term: "Not-for-profit purpose", value: business.isNonprofit ? "Yes" : "No" },
                { term: "Standing", value: standingText(business.standing, business.standingSource) },
              ]}
            />
            <p className="border-t border-border pt-4 text-sm text-muted">
              These details come from what you told us. They update each time you authorize a filing with us.
            </p>
          </Card>
        </DashboardSection>

        <DashboardSection id="addresses-people" title="Addresses and people">
          <Card className="grid gap-6 p-5 sm:p-6">
            {addresses.length > 0 ? (
              <dl className="grid gap-4">
                {addresses.map((a) => (
                  <div key={a.kind} className="grid gap-1">
                    <dt className="text-sm text-muted">{ADDRESS_LABELS[a.kind] ?? "Address"}</dt>
                    <dd className="break-words text-[15px] text-fg">{addressText(a)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted">No addresses on file yet. We&apos;ll save them when you complete a filing.</p>
            )}
            <div className="grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
              <PeopleGroup title={governorLabel(business)} people={governors} />
              <PeopleGroup title="Principal officers" people={officers} />
            </div>
          </Card>
        </DashboardSection>
      </div>

      <DashboardSection
        id="periods"
        title="Filing periods"
        description="Every report period we track for this business."
      >
        {requirements.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
            {requirements.map((req) => {
              const linkedFiling = req.activeFiling ?? filings.find((f) => f.requirementId === req.id) ?? null;
              return (
                <li key={req.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="font-medium text-fg">
                      {req.periodYear} {req.filingName}
                    </p>
                    <p className="text-sm text-muted">
                      Due <DueDate value={req.dueDate} short />
                    </p>
                  </div>
                  <Badge
                    tone={
                      req.status === "filed_with_us" ? "success" : req.status === "open" ? "info" : "neutral"
                    }
                  >
                    {requirementStatusLabel(req.status)}
                  </Badge>
                  {linkedFiling ? (
                    <Link href={filingHref(linkedFiling.id)} className={`${quietLinkClass} text-sm`}>
                      View filing
                      <span className="sr-only">
                        {" "}
                        for {req.periodYear}
                      </span>
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No filing periods yet.</p>
        )}
      </DashboardSection>

      <DashboardSection id="history" title="Filing history">
        {filings.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface">
            {filings.map((f) => (
              <li key={f.id}>
                <Link
                  href={filingHref(f.id)}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-2"
                >
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="font-medium text-fg">
                      {f.periodYear} {f.filingName}
                    </p>
                    <p className="tnum text-sm text-muted">Started {formatTimestampDate(f.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FilingStatusBadge status={f.status} />
                    <PaymentStatusBadge status={f.orderStatus} />
                  </div>
                  <CaretRight size={16} className="text-subtle" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[var(--radius-surface)] border border-dashed border-border-strong px-4 py-6 text-sm text-muted">
            No filings yet. When you have us file a report, it will be listed here with its receipt.
          </p>
        )}
      </DashboardSection>

      {rulesHref ? (
        <p className="text-sm text-muted">
          <Link href={rulesHref} className={quietLinkClass}>
            {business.rule
              ? `Read about the ${business.stateName} ${ENTITY_TYPE_LABELS[business.entityType]} annual report`
              : `About filings in ${business.stateName}`}
          </Link>
        </p>
      ) : null}
    </Container>
  );
}
