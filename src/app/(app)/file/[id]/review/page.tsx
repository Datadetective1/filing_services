import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { site } from "@/config/site";
import { requireUser } from "@/lib/auth/session";
import { CUSTOMER_EDITABLE_STATUSES, type FilingStatus } from "@/lib/domain/filing-status";
import { authorizationText } from "@/lib/filings/customer";
import { validateAll } from "@/lib/intake/validate";
import { createClient } from "@/lib/supabase/server";
import { FilingContext } from "@/components/funnel/filing-context";
import { FunnelSteps } from "@/components/funnel/funnel-steps";
import { AnswerSummary } from "@/components/intake/answer-summary";
import { AuthorizeForm } from "@/components/intake/authorize-form";
import { Card, Container, Notice } from "@/components/ui/surface";
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
  const text = authorizationText({
    businessName: summary.businessName,
    stateName: summary.stateName,
    filingName: summary.filingName,
    brand: site.name,
  });

  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <FunnelSteps current="review" paid={paid} className="mb-8" />

      <div className="grid gap-1.5">
        <FilingContext
          businessName={summary.businessName}
          stateName={summary.stateName}
          filingName={summary.filingName}
          periodYear={summary.periodYear}
        />
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">Review and sign</h1>
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-muted">
          Check everything below. This is the information we&apos;ll submit to the {summary.agencyName} on your
          business&apos;s behalf.
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
                    className="font-medium text-fg underline underline-offset-4"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
          </ul>
        </Notice>
      ) : null}

      <div className="mt-8 grid gap-4">
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

      {all.ok ? (
        <Card className="mt-10 p-5 sm:p-8">
          <div className="grid gap-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-fg">Sign and authorize</h2>
            <p className="text-[15px] leading-relaxed text-muted">
              {paid
                ? "Sign again to confirm the updated details. We'll pick your filing back up right away."
                : "Next is payment. You'll see the state fee and our service fee separately before you pay."}
            </p>
          </div>
          <div className="mt-6">
            <AuthorizeForm
              action={authorizeAction.bind(null, id)}
              defaults={defaults}
              authorizationText={text}
              titleSuggestions={titleSuggestions}
              submitLabel={paid ? "Sign and resubmit" : "Sign and continue"}
            />
          </div>
        </Card>
      ) : null}
    </Container>
  );
}
