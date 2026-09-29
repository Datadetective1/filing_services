import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { CUSTOMER_EDITABLE_STATUSES, CUSTOMER_STATUS_DESCRIPTIONS, type FilingStatus } from "@/lib/domain/filing-status";
import { validateAll } from "@/lib/intake/validate";
import { FilingContext } from "@/components/funnel/filing-context";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { FilingTicket } from "@/components/funnel/filing-ticket";
import { IntakeForm } from "@/components/intake/intake-form";
import { SectionNav } from "@/components/intake/section-nav";
import { Container, Notice } from "@/components/ui/surface";
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
    <Container className="max-w-6xl pt-8 sm:pt-10">
      <FunnelSteps current="details" paid={paid} className="mb-10" />

      <div className="mb-8 grid gap-2.5">
        <div className="lg:hidden">
          <FilingContext
            businessName={summary.businessName}
            stateName={summary.stateName}
            filingName={summary.filingName}
            periodYear={summary.periodYear}
          />
        </div>
        <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[38px]">Business details</h1>
        <p className="max-w-[60ch] text-[16px] leading-relaxed text-muted">
          Enter these as they appear on your {summary.stateName} business record. You&apos;ll review everything before you
          sign.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] lg:gap-12">
        <aside className="grid content-start gap-6 lg:sticky lg:top-6 lg:self-start">
          <FilingTicket
            className="max-lg:hidden"
            businessName={summary.businessName}
            stateName={summary.stateName}
            filingName={summary.filingName}
            periodYear={summary.periodYear}
            dueDate={summary.dueDate}
            daysRemaining={summary.daysRemaining}
          />
          <SectionNav filingId={id} sections={navItems} currentKey={current.key} />
        </aside>

        <div className="grid min-w-0 content-start gap-6">
          {paid ? (
            <Notice tone="warning" title="We need a few more details">
              {CUSTOMER_STATUS_DESCRIPTIONS[status]} Once everything is complete, review and sign again so we can continue.
            </Notice>
          ) : all.ok && allVisited ? (
            <Notice tone="success" role="status" title="All details are complete">
              You can keep editing, or{" "}
              <Link href={`/file/${id}/review`} className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                go to review
              </Link>
              .
            </Notice>
          ) : null}

          <section
            aria-labelledby="section-title"
            className="rounded-[var(--radius-surface)] border border-border bg-surface p-5 shadow-card sm:p-9"
          >
            <div className="grid gap-2 border-b border-border pb-6">
              <p className="tnum text-[13px] font-semibold uppercase tracking-wider text-accent max-lg:hidden">
                Section {index + 1} of {sections.length}
              </p>
              <h2 id="section-title" className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-[28px]">
                {current.title}
              </h2>
              {current.description ? <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">{current.description}</p> : null}
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
          </section>

          <p className="text-sm leading-6 text-subtle">Your answers save each time you continue.</p>
        </div>
      </div>
    </Container>
  );
}
