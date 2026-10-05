import type { Metadata } from "next";
import { formatDateTime } from "@/components/admin/format";
import { cn } from "@/components/ui/cn";
import { site } from "@/config/site";
import { OWNER_CHECKS, OWNER_CHECKS_PREAMBLE, type CheckState } from "@/lib/admin/owner-checks";
import { requireAdmin } from "@/lib/auth/session";
import { stateSalesEnabled } from "@/lib/compliance/launch";
import { openQuestionsFor } from "@/lib/compliance/open-questions";
import { WA_CERTIFICATION_TEXT } from "@/lib/compliance/states/washington";
import { authorizationText, filingAgentName } from "@/lib/filings/customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckItem } from "./check-item";
import { Md } from "./md";

export const metadata: Metadata = { title: "Owner checks", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface Saved {
  item_key: string;
  done: boolean;
  note: string | null;
  updated_at: string;
}

/**
 * The owner's human checks for Washington, Nevada and Utah (docs/OWNER_CHECKS.md), with
 * progress saved per item. Admin only. Read-only view of the launch switches: nothing on
 * this page changes a live-sales flag.
 */
export default async function OwnerChecksPage() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: rows }, { data: prices }] = await Promise.all([
    db.from("owner_checks").select("item_key, done, note, updated_at"),
    db.from("service_prices").select("state_code, approved").eq("active", true).is("entity_type", null).in("state_code", ["WA", "NV", "UT"]),
  ]);
  const saved = new Map(((rows ?? []) as Saved[]).map((r) => [r.item_key, r]));
  const approved = new Map(((prices ?? []) as { state_code: string; approved: boolean }[]).map((p) => [p.state_code, p.approved]));

  const counselText = authorizationText({
    businessName: "[Business legal name]",
    stateName: "Washington",
    filingName: "Annual Report",
    brand: site.name,
    state: { filingAgent: filingAgentName(site.name, site.legalEntity, site.legalEntityConfigured), certificationText: WA_CERTIFICATION_TEXT },
  });

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <header className="grid gap-3">
        <p className="text-sm font-semibold text-subtle">Admin only · not indexed</p>
        <h1 className="text-[28px] font-semibold leading-tight text-fg sm:text-[32px]">Owner checks</h1>
        <div className="grid gap-2 text-[15px] leading-relaxed text-muted">
          {OWNER_CHECKS_PREAMBLE.map((p) => (
            <Md key={p} text={p} />
          ))}
        </div>
      </header>

      <section aria-labelledby="summary-title" className="grid gap-3">
        <h2 id="summary-title" className="text-lg font-semibold text-fg">
          Readiness
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {OWNER_CHECKS.map((st) => (
            <Summary key={st.stateCode} st={st} saved={saved} priceApproved={approved.get(st.stateCode) ?? false} />
          ))}
        </div>
        <p className="text-sm text-muted">Live-sales switches are shown read-only. This page never changes them.</p>
      </section>

      <nav aria-label="States" className="flex flex-wrap gap-2">
        {OWNER_CHECKS.map((st) => (
          <a
            key={st.stateCode}
            href={`#${st.stateCode.toLowerCase()}`}
            className="inline-flex min-h-11 items-center rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold text-fg hover:bg-surface-2"
          >
            {st.name}
          </a>
        ))}
      </nav>

      {OWNER_CHECKS.map((st) => (
        <section key={st.stateCode} id={st.stateCode.toLowerCase()} aria-labelledby={`${st.stateCode}-title`} className="grid scroll-mt-6 gap-6">
          <h2 id={`${st.stateCode}-title`} className="border-b-2 border-fg/80 pb-2 text-2xl font-semibold text-fg">
            {st.name}
          </h2>
          {st.sections.map((sec) => (
            <div key={sec.key} className="grid gap-4">
              <h3 className="text-lg font-semibold leading-snug text-fg">{sec.title}</h3>
              {sec.intro.map((p) => (
                <Md key={p} text={p} className="grid gap-2 text-[15px] leading-relaxed text-muted" />
              ))}
              {sec.counselText ? (
                <blockquote className="max-h-80 overflow-y-auto rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-[15px] leading-7 text-fg">
                  {counselText}
                </blockquote>
              ) : null}
              {sec.body?.map((p) => (
                <Md key={p} text={p} className="grid gap-2 text-[15px] leading-relaxed text-muted" />
              ))}
              <div className="grid gap-3">
                {sec.items.map((item) => {
                  const s = saved.get(item.key);
                  return (
                    <CheckItem
                      key={item.key}
                      itemKey={item.key}
                      done={s?.done ?? false}
                      note={s?.note ?? ""}
                      noteLabel={item.noteLabel}
                      updated={s ? formatDateTime(s.updated_at) : undefined}
                    >
                      <Md text={item.text} className="grid gap-1.5 font-medium" />
                      {item.columns ? (
                        <dl className="mt-2 grid gap-1.5 text-sm font-normal">
                          {item.columns.slice(1).map((c) => (
                            <div key={c.label} className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
                              <dt className="text-subtle">{c.label}</dt>
                              <dd className="text-fg">
                                <Md text={c.value} className="grid" />
                              </dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                      {item.stop ? <Md text={item.stop} className="mt-2 text-sm text-danger" /> : null}
                    </CheckItem>
                  );
                })}
              </div>
              {sec.outro?.map((p) => (
                <Md key={p} text={p} className="grid gap-2 text-[15px] leading-relaxed text-muted" />
              ))}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function Summary({ st, saved, priceApproved }: { st: CheckState; saved: Map<string, Saved>; priceApproved: boolean }) {
  const keys = st.sections.flatMap((s) => s.items.map((i) => i.key));
  const done = keys.filter((k) => saved.get(k)?.done).length;
  const open = openQuestionsFor(st.stateCode);
  const live = stateSalesEnabled(st.stateCode);
  const complete = done === keys.length;
  const status = live
    ? "Live sales ON"
    : open.length
      ? "Blocked until the open state questions are answered and closed in code"
      : complete && priceApproved
        ? "Checks complete: ready to ask for the live-sales switch"
        : "Not ready: finish the checks";
  return (
    <div className="grid gap-2 rounded-[var(--radius-control)] border border-border bg-surface p-4">
      <p className="text-base font-semibold text-fg">{st.name}</p>
      <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((done / keys.length) * 100)}%` }} />
      </div>
      <dl className="grid gap-1 text-sm">
        <Row term="Checks done" value={`${done} of ${keys.length}`} />
        <Row term="Open state questions" value={open.length ? open.map((q) => q.key).join(", ") : "None"} warn={open.length > 0} />
        <Row term="$49 price" value={priceApproved ? "Approved" : "Not approved"} warn={!priceApproved} />
        <Row term="Live sales" value={live ? "ON" : "Off"} />
      </dl>
      <p className={cn("text-sm font-medium", complete && !open.length && priceApproved ? "text-accent-soft-fg" : "text-muted")}>{status}</p>
    </div>
  );
}

function Row({ term, value, warn }: { term: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <dt className="text-subtle">{term}</dt>
      <dd className={cn("text-right [overflow-wrap:anywhere]", warn ? "font-medium text-warning" : "text-fg")}>{value}</dd>
    </div>
  );
}
