import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CaretRight, Info, MapPin } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/auth/session";
import { getJurisdiction } from "@/lib/compliance/registry";
import { formatLongDate, isISODate } from "@/lib/domain/dates";
import { ENTITY_TYPE_LABELS, ENTITY_TYPE_SLUGS } from "@/lib/domain/types";
import { formatAddress } from "@/lib/intake/validate";
import { Badge, FilingStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Container } from "@/components/ui/surface";
import { DocumentSheet } from "@/components/visual/document-tile";
import { OfficialSource } from "@/components/compliance/official-source";
import { businessMeta } from "@/components/dashboard/business-row";
import { BusinessMark, businessInitials } from "@/components/dashboard/business-mark";
import { DueDate } from "@/components/dashboard/due-info";
import { formatTimestampDate, requirementStatusLabel, standingText } from "@/components/dashboard/format";
import { DashboardNotices } from "@/components/dashboard/notices";
import { OpenRequirement } from "@/components/dashboard/open-requirement";
import { backLinkClass, DashboardSection, QuietEmpty, quietLinkClass } from "@/components/dashboard/section";
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

const notProvided = <span className="font-normal text-subtle">Not provided</span>;

function PeopleGroup({ title, people }: { title: string; people: PersonView[] }) {
  return (
    <div className="grid content-start gap-2.5">
      <p className="text-[13px] font-medium text-muted">{title}</p>
      {people.length > 0 ? (
        <ul className="grid gap-2.5">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold text-fg"
              >
                {businessInitials(p.fullName)}
              </span>
              <span className="grid min-w-0 leading-snug">
                <span className="break-words text-[15px] font-semibold text-fg">{p.fullName}</span>
                <span className="text-sm text-muted">{p.title}</span>
              </span>
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

  const record: { term: string; value: ReactNode; wide?: "always" | "mobile" }[] = [
    { term: "Legal name", value: <span className="break-words">{business.legalName}</span>, wide: "always" },
    { term: "State", value: business.stateName },
    { term: "Entity type", value: ENTITY_TYPE_LABELS[business.entityType] },
    {
      term: "Entity number",
      value: business.entityNumber ? <span className="tnum">{business.entityNumber}</span> : notProvided,
    },
    {
      term: "Formation date",
      value:
        business.formationDate && isISODate(business.formationDate) ? (
          <span className="tnum">{formatLongDate(business.formationDate)}</span>
        ) : (
          notProvided
        ),
    },
    {
      term: "Domestic or foreign",
      value: business.isForeign
        ? `Foreign, formed in ${business.homeJurisdiction ?? "another jurisdiction"}`
        : `Domestic, formed in ${business.stateName}`,
      wide: "mobile",
    },
    { term: "Not-for-profit purpose", value: business.isNonprofit ? "Yes" : "No" },
    { term: "Standing", value: standingText(business.standing, business.standingSource), wide: "always" },
  ];

  return (
    <Container className="py-8 sm:py-12">
      <Link href="/dashboard" className={backLinkClass}>
        <ArrowLeft size={16} weight="bold" aria-hidden className="transition-transform group-hover:-translate-x-0.5" />
        All businesses
      </Link>

      <header className="mt-4 flex items-center gap-4 sm:gap-5">
        <BusinessMark id={business.id} name={business.legalName} size="lg" />
        <div className="grid min-w-0 gap-1">
          <h1 className="break-words text-[28px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[40px]">
            {business.legalName}
          </h1>
          <p className="text-[15px] text-muted">{businessMeta(business)}</p>
        </div>
      </header>

      <DashboardNotices
        searchParams={searchParams}
        addedMessage="Business added. We'll remind you before it's due."
        className="mt-6"
      />

      <div className="mt-10 grid gap-14">
        <DashboardSection id="open-filings" title={openRequirements.length > 1 ? "Open filings" : "Next filing"}>
          {openRequirements.length > 0 ? (
            <div className="grid gap-4">
              {openRequirements.map((req) => (
                <OpenRequirement key={req.id} business={business} requirement={req} returnTo={returnTo} />
              ))}
            </div>
          ) : (
            <QuietEmpty>
              <span className="block font-semibold text-fg">Nothing open right now</span>
              {business.rule
                ? "When the next filing period opens, it will appear here and we'll remind you before it's due."
                : "We don't track filings for this state and entity type yet."}
            </QuietEmpty>
          )}

          {business.rule ? (
            <div className="grid max-w-[72ch] gap-2 text-sm leading-6 text-muted">
              <p>
                Based on the {agency}&apos;s published requirements: {business.rule.customerSummary}
              </p>
              <OfficialSource href={business.rule.officialInfoUrl} agency={agency} lastVerifiedAt={business.rule.lastVerifiedAt} />
            </div>
          ) : null}
        </DashboardSection>

        <div className="grid gap-14 lg:grid-cols-2 lg:gap-8">
          <DashboardSection id="record" title="Business record">
            <div className="grid gap-5 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
                {record.map((item) => (
                  <div key={item.term} className={cn(
                      "grid min-w-0 content-start gap-0.5",
                      item.wide === "always" && "col-span-2",
                      item.wide === "mobile" && "col-span-2 sm:col-span-1",
                    )}>
                    <dt className="text-[13px] font-medium text-muted">{item.term}</dt>
                    <dd className="text-[15px] font-semibold text-fg">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="flex items-start gap-2 border-t border-border pt-4 text-sm leading-6 text-muted">
                <Info size={17} aria-hidden className="mt-0.5 shrink-0 text-subtle" />
                These details come from what you told us. They update each time you authorize a filing with us.
              </p>
            </div>
          </DashboardSection>

          <DashboardSection id="addresses-people" title="Addresses and people">
            <div className="grid gap-6 rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
              {addresses.length > 0 ? (
                <ul className="grid gap-4">
                  {addresses.map((a) => (
                    <li key={a.kind} className="flex items-start gap-3">
                      <span
                        aria-hidden
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"
                      >
                        <MapPin size={17} weight="fill" />
                      </span>
                      <div className="grid min-w-0 gap-0.5">
                        <p className="text-[13px] font-medium text-muted">{ADDRESS_LABELS[a.kind] ?? "Address"}</p>
                        <p className="break-words text-[15px] font-semibold leading-snug text-fg">{addressText(a)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[15px] text-muted">No addresses on file yet. We&apos;ll save them when you complete a filing.</p>
              )}
              <div className="grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
                <PeopleGroup title={governorLabel(business)} people={governors} />
                <PeopleGroup title="Principal officers" people={officers} />
              </div>
            </div>
          </DashboardSection>
        </div>

        <div className="grid gap-14 lg:grid-cols-2 lg:gap-8">
          <DashboardSection id="periods" title="Filing years" description="Every report period we track for this business.">
            {requirements.length > 0 ? (
              <ol className="rounded-[var(--radius-surface)] border border-border bg-surface p-5 sm:p-6">
                {requirements.map((req, i) => {
                  const linkedFiling = req.activeFiling ?? filings.find((f) => f.requirementId === req.id) ?? null;
                  const last = i === requirements.length - 1;
                  const done = req.status === "filed_with_us" || req.status === "filed_elsewhere";
                  return (
                    <li key={req.id} className="relative grid grid-cols-[3.25rem_1.25rem_minmax(0,1fr)] gap-x-3 pb-6 last:pb-0">
                      <span className="tnum pt-px font-display text-lg font-semibold leading-6 text-fg">{req.periodYear}</span>
                      <span aria-hidden className="relative flex justify-center">
                        {!last ? <span className="absolute top-6 bottom-[-1.5rem] w-0.5 bg-border" /> : null}
                        <span
                          className={cn(
                            "relative mt-1 size-4 rounded-full border-2",
                            done
                              ? "border-accent bg-accent"
                              : req.status === "open"
                                ? "border-highlight-strong bg-highlight-soft"
                                : "border-border-strong bg-surface",
                          )}
                        />
                      </span>
                      <div className="grid min-w-0 gap-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <p className="font-semibold text-fg">{req.filingName}</p>
                          <Badge
                            tone={req.status === "filed_with_us" ? "success" : req.status === "open" ? "info" : "neutral"}
                          >
                            {requirementStatusLabel(req.status)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted">
                          Due <DueDate value={req.dueDate} short />
                        </p>
                        {linkedFiling ? (
                          <Link href={filingHref(linkedFiling.id)} className={`${quietLinkClass} justify-self-start text-sm`}>
                            View filing
                            <span className="sr-only"> for {req.periodYear}</span>
                            <ArrowRight size={14} weight="bold" aria-hidden />
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <QuietEmpty>No filing periods yet.</QuietEmpty>
            )}
          </DashboardSection>

          <DashboardSection id="history" title="Filing history" description="Filings you've started with us, newest first.">
            {filings.length > 0 ? (
              <ul className="grid gap-3">
                {filings.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={filingHref(f.id)}
                      className="group flex items-center gap-4 rounded-[var(--radius-surface)] border border-border bg-surface p-4 transition-[border-color,box-shadow] hover:border-accent/40 hover:shadow-card"
                    >
                      <DocumentSheet
                        title={`${f.periodYear} ${f.filingName}`}
                        size="sm"
                        stamp={f.status === "accepted" || f.status === "completed" ? "Filed" : undefined}
                        className="max-sm:hidden"
                      />
                      <div className="grid min-w-0 flex-1 gap-1.5">
                        <p className="font-semibold text-fg group-hover:text-accent">
                          {f.periodYear} {f.filingName}
                        </p>
                        <p className="tnum text-sm text-muted">Started {formatTimestampDate(f.createdAt)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <FilingStatusBadge status={f.status} />
                          <PaymentStatusBadge status={f.orderStatus} />
                        </div>
                      </div>
                      <CaretRight size={18} weight="bold" className="shrink-0 text-subtle group-hover:text-accent" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <QuietEmpty>No filings yet. When you have us file a report, it will be listed here with its receipt.</QuietEmpty>
            )}
          </DashboardSection>
        </div>

        {rulesHref ? (
          <p className="text-sm text-muted">
            <Link href={rulesHref} className={quietLinkClass}>
              {business.rule
                ? `Read about the ${business.stateName} ${ENTITY_TYPE_LABELS[business.entityType]} annual report`
                : `About filings in ${business.stateName}`}
              <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          </p>
        ) : null}
      </div>
    </Container>
  );
}
