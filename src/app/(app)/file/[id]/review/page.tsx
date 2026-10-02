import { PenNib } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { site } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/domain/dates";
import { CUSTOMER_EDITABLE_STATUSES, type FilingStatus } from "@/lib/domain/filing-status";
import { authorizationBusinessName, authorizationText, filingAgentName, stateAuthorizationFor } from "@/lib/filings/customer";
import { buildFilingPacket, registeredAgentConsentRequired } from "@/lib/filings/packet";
import { FilingPacketView } from "@/components/intake/filing-packet-view";
import { validateAll } from "@/lib/intake/validate";
import { createClient } from "@/lib/supabase/server";
import { FilingContext } from "@/components/funnel/filing-context";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { AnswerSummary } from "@/components/intake/answer-summary";
import { AuthorizeForm } from "@/components/intake/authorize-form";
import { Container, Notice } from "@/components/ui/surface";
import { filingSummary, loadOwnFiling } from "../../_lib/filing";
import { authorizeAction } from "./actions";

export const metadata: Metadata = {
  title: "Review and sign",
  robots: { index: false, follow: false },
};

async function signerDefaults(filingId: string, userId: string): Promise<{ signerName: string; signerTitle: string }> {
  const db = await createClient();
  const { data: auths } = await db
    .from("filing_authorizations")
    .select("signer_name, signer_title")
    .eq("filing_id", filingId)
    .order("created_at", { ascending: false })
    .limit(1);
  const latest = auths?.[0];
  if (latest) return { signerName: String(latest.signer_name ?? ""), signerTitle: String(latest.signer_title ?? "") };
  const { data: profile } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return { signerName: typeof profile?.full_name === "string" ? profile.full_name : "", signerTitle: "" };
}

export default async function FilingReviewPage({ params, searchParams }: PageProps<"/file/[id]/review">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/file/${id}/review`);
  const loaded = await loadOwnFiling(user, id);
  if (!loaded) notFound();

  const status = loaded.filing.status as FilingStatus;
  if (!CUSTOMER_EDITABLE_STATUSES.includes(status)) redirect(`/dashboard/filings/${id}`);

  const sections = loaded.schema?.sections ?? [];
  const summary = filingSummary(loaded);
  const all = validateAll(loaded.schema, loaded.answers);
  const incomplete = new Set(all.incompleteSections);
  const paid = status !== "draft";

  const titleSuggestions = Array.from(
    new Set(sections.flatMap((s) => s.fields.flatMap((f) => (f.type === "people" ? f.titleSuggestions : [])))),
  );
  const defaults = await signerDefaults(id, user.id);
  // State-specific signing (Washington): the full packet in the state's order, the agent's
  // certification, and the new registered agent's consent when the agent changes.
  const stateAuth = stateAuthorizationFor(summary.stateCode, loaded.business);
  const filingAgent = filingAgentName(site.name, site.legalEntity, site.legalEntityConfigured);
  const packet = stateAuth ? buildFilingPacket(stateAuth.runbook, loaded.schema, all.values) : null;
  const sectionOf = new Map(sections.flatMap((s) => s.fields.map((f) => [f.key, s.key] as const)));
  const consentNeeded = stateAuth ? registeredAgentConsentRequired(stateAuth.auth, all.values) : false;
  const ra = stateAuth?.auth.registeredAgentConsent;
  // Signed text names the business exactly as the server will store it (a corrected legal name wins).
  const text = authorizationText({
    businessName: authorizationBusinessName(loaded.business, all.values),
    stateName: summary.stateName,
    filingName: summary.filingName,
    brand: site.name,
    state: stateAuth ? { filingAgent, certificationText: stateAuth.auth.certificationText } : undefined,
  });

  return (
    <Container className="max-w-4xl pt-8 sm:pt-10">
      <FunnelSteps current="review" paid={paid} className="mb-10" />

      <div className="grid gap-2.5">
        <FilingContext
          businessName={summary.businessName}
          stateName={summary.stateName}
          filingName={summary.filingName}
          periodYear={summary.periodYear}
        />
        <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-fg sm:text-[38px]">Review and sign</h1>
        <p className="max-w-[60ch] text-[16px] leading-relaxed text-muted">
          This is what we&apos;ll submit to the {summary.agencyName} for your business. Check it once, then sign below.
        </p>
      </div>

      {sp.changed === "1" ? (
        <Notice tone="info" role="status" title="Your details changed after you signed" className="mt-6">
          Please review them and sign again before paying.
        </Notice>
      ) : null}

      {!all.ok ? (
        <Notice tone="warning" role="alert" title="A few details are missing" className="mt-6">
          <p>Finish these sections before you sign:</p>
          <ul className="mt-2 grid gap-1">
            {sections
              .filter((s) => incomplete.has(s.key))
              .map((s) => (
                <li key={s.key}>
                  <Link
                    href={`/file/${id}/details?step=${encodeURIComponent(s.key)}`}
                    className="font-semibold text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
          </ul>
        </Notice>
      ) : null}

      <article
        aria-labelledby="summary-title"
        className="relative mt-8 rounded-[14px] border border-border bg-surface px-5 shadow-lift sm:px-9"
      >
        <span aria-hidden className="absolute right-0 top-0 size-7 rounded-bl-[10px] rounded-tr-[14px] bg-surface-3" />
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-dashed border-border py-6 sm:py-7">
          <div className="grid gap-1">
            <p className="font-mono text-[11px] uppercase tracking-wider text-subtle">Summary for your review</p>
            <h2 id="summary-title" className="text-[22px] font-semibold leading-tight text-fg [overflow-wrap:anywhere] sm:text-[26px]">
              {summary.stateName} {summary.filingName} <span className="tnum">{summary.periodYear}</span>
            </h2>
            <p className="text-[15px] text-muted [overflow-wrap:anywhere]">{summary.businessName}</p>
          </div>
          <p className="tnum text-sm text-muted">
            Due <span className="font-semibold text-fg">{formatLongDate(summary.dueDate)}</span>
          </p>
        </header>
        {packet && all.ok ? (
          <div className="grid gap-3 py-6 sm:py-7">
            <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">
              This is everything we&apos;ll enter on the {summary.agencyName}&apos;s online form, in the same order. Check each item: the
              person who files will certify it to the state based on your confirmation.
            </p>
            <FilingPacketView
              rows={packet}
              editHref={(key) => {
                const step = sectionOf.get(key);
                return step ? `/file/${id}/details?step=${encodeURIComponent(step)}` : null;
              }}
            />
          </div>
        ) : null}
        <div className={packet && all.ok ? "hidden" : "divide-y divide-border"}>
          {sections.map((section) => (
            <AnswerSummary
              key={section.key}
              section={section}
              answers={loaded.answers}
              editHref={`/file/${id}/details?step=${encodeURIComponent(section.key)}`}
              incomplete={incomplete.has(section.key)}
            />
          ))}
        </div>
      </article>

      {all.ok ? (
        <section
          aria-labelledby="sign-title"
          className="grain mt-12 overflow-hidden rounded-[var(--radius-surface)] border border-border bg-surface-2 p-5 sm:p-9"
        >
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg" aria-hidden>
              <PenNib size={22} weight="fill" />
            </span>
            <div className="grid gap-1">
              <h2 id="sign-title" className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-fg">
                Sign and authorize
              </h2>
              <p className="max-w-[56ch] text-[15px] leading-relaxed text-muted">
                {paid
                  ? "Sign again to confirm the updated details. We'll pick your filing back up right away."
                  : "Nothing is filed until you sign. Next is payment, where you'll see the state fee and our fee as separate lines."}
              </p>
            </div>
          </div>
          <div className="mt-7">
            <AuthorizeForm
              action={authorizeAction.bind(null, id)}
              defaults={defaults}
              authorizationText={text}
              titleSuggestions={titleSuggestions}
              submitLabel={paid ? "Sign and resubmit" : "Sign and continue"}
              certify={stateAuth ? { stateName: summary.stateName, filingAgent, certificationText: stateAuth.auth.certificationText } : undefined}
              agentConsent={
                consentNeeded && ra ? { agentName: String(all.values[ra.agentNameKey] ?? "the new agent"), consentText: ra.consentText } : undefined
              }
            />
          </div>
        </section>
      ) : null}
    </Container>
  );
}
