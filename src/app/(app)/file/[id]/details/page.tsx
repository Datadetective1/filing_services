import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { CUSTOMER_EDITABLE_STATUSES, CUSTOMER_STATUS_DESCRIPTIONS, type FilingStatus } from "@/lib/domain/filing-status";
import { validateAll } from "@/lib/intake/validate";
import { FilingContext } from "@/components/funnel/filing-context";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { IntakeForm } from "@/components/intake/intake-form";
import { SectionNav } from "@/components/intake/section-nav";
import { Card, Container, Notice } from "@/components/ui/surface";
import { filingSummary, loadOwnFiling } from "../../_lib/filing";
import { saveSectionAction } from "./actions";

export const metadata: Metadata = {
  title: "Business details",
  robots: { index: false, follow: false },
};

export default async function FilingDetailsPage({ params, searchParams }: PageProps<"/file/[id]/details">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/file/${id}/details`);
  const loaded = await loadOwnFiling(user, id);
  if (!loaded) notFound();

  const status = loaded.filing.status as FilingStatus;
  if (!CUSTOMER_EDITABLE_STATUSES.includes(status)) redirect(`/dashboard/filings/${id}`);

  const sections = loaded.schema?.sections ?? [];
  if (sections.length === 0) notFound();

  const summary = filingSummary(loaded);
  const all = validateAll(loaded.schema, loaded.answers);
  const incomplete = new Set(all.incompleteSections);
  const visited = new Set(loaded.completedSteps);

  const requested = typeof sp.step === "string" ? sp.step : undefined;
  const current =
    sections.find((s) => s.key === requested) ??
    sections.find((s) => !visited.has(s.key)) ??
    sections.find((s) => incomplete.has(s.key)) ??
    sections[0];
  const index = sections.indexOf(current);
  const backHref = index > 0 ? `/file/${id}/details?step=${encodeURIComponent(sections[index - 1].key)}` : null;
  const nextUnvisited = sections.slice(index + 1).find((s) => !visited.has(s.key));
  const allVisited = sections.every((s) => visited.has(s.key) || s.key === current.key);

  const navItems = sections.map((s) => ({ key: s.key, title: s.title, done: visited.has(s.key) && !incomplete.has(s.key) }));
  const initialValues = Object.fromEntries(current.fields.map((f) => [f.key, loaded.answers[f.key]]));
  const action = saveSectionAction.bind(null, id, current.key);
  const paid = status !== "draft";

  return (
    <Container className="max-w-5xl py-8 sm:py-10">
      <FunnelSteps current="details" paid={paid} className="mb-8" />

      <div className="grid gap-1.5">
        <FilingContext
          businessName={summary.businessName}
          stateName={summary.stateName}
          filingName={summary.filingName}
          periodYear={summary.periodYear}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">Business details</h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">
          Enter these as they appear on your {summary.stateName} business record. We use them to prepare your filing, and
          you&apos;ll review everything before you sign.
        </p>
      </div>

      {paid ? (
        <Notice tone="warning" title="We need a few more details" className="mt-6">
          {CUSTOMER_STATUS_DESCRIPTIONS[status]} Once everything is complete, review and sign again so we can continue.
        </Notice>
      ) : all.ok && allVisited ? (
        <Notice tone="success" role="status" title="All details are complete" className="mt-6">
          You can keep editing, or{" "}
          <Link href={`/file/${id}/review`} className="font-medium text-fg underline underline-offset-4">
            go to review
          </Link>
          .
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <SectionNav filingId={id} sections={navItems} currentKey={current.key} />
        </aside>

        <section aria-labelledby="section-title">
          <Card className="p-5 sm:p-8">
            <div className="grid gap-1.5">
              <h2 id="section-title" className="text-xl font-semibold tracking-tight text-fg">
                {current.title}
              </h2>
              {current.description ? <p className="text-[15px] leading-relaxed text-muted">{current.description}</p> : null}
            </div>
            <div className="mt-7">
              <IntakeForm
                key={current.key}
                action={action}
                section={current}
                initialValues={initialValues}
                submitLabel={nextUnvisited ? "Save and continue" : "Save and review"}
                backHref={backHref}
              />
            </div>
          </Card>
        </section>
      </div>
    </Container>
  );
}
