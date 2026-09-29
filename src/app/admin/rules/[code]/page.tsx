import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { StatusPill } from "@/components/admin/badges";
import { formatDate, humanize, money } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, KeyValues, Panel, tableLink } from "@/components/admin/layout-bits";
import { Notice } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { getJurisdiction } from "@/lib/compliance/registry";
import { ENTITY_TYPE_LABELS, isEntityType } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "State rules" };

interface RuleRow {
  id: string;
  rule_key: string;
  entity_type: string;
  applies_to: string;
  filing_type_code: string;
  current_version_id: string | null;
}

interface VersionRow {
  id: string;
  rule_id: string;
  version: number;
  verification_status: string;
  publication_status: string;
  effective_from: string;
  effective_to: string | null;
  filing_name: string;
  form_number: string | null;
  state_fee_cents: number;
  nonprofit_state_fee_cents: number | null;
  content_hash: string;
  last_verified_at: string | null;
  verified_by: string | null;
  notes: string | null;
}

interface SourceRow {
  id: string;
  rule_version_id: string;
  fact_key: string;
  url: string;
  title: string | null;
  publisher: string | null;
  quote: string | null;
  last_verified_at: string;
}

export default async function StateRulesPage(props: PageProps<"/admin/rules/[code]">) {
  await requireStaff();
  const { code: raw } = await props.params;
  const code = raw.toUpperCase();
  const jurisdiction = getJurisdiction(code);
  if (!/^[A-Z]{2}$/.test(code) || !jurisdiction) notFound();

  const db = await createClient();
  const { data: rulesData } = await db
    .from("compliance_rules")
    .select("id, rule_key, entity_type, applies_to, filing_type_code, current_version_id")
    .eq("state_code", code)
    .order("rule_key");
  const rules = (rulesData ?? []) as RuleRow[];
  const ruleIds = rules.map((r) => r.id);

  const { data: versionsData } = ruleIds.length
    ? await db.from("state_rule_versions").select("*").in("rule_id", ruleIds).order("version", { ascending: false })
    : { data: [] };
  const versions = (versionsData ?? []) as VersionRow[];
  const currentIds = rules.map((r) => r.current_version_id).filter((v): v is string => Boolean(v));
  const { data: sourcesData } = currentIds.length
    ? await db.from("state_rule_sources").select("*").in("rule_version_id", currentIds).order("fact_key")
    : { data: [] };
  const sources = (sourcesData ?? []) as SourceRow[];

  return (
    <div className="grid grid-cols-1 gap-5">
      <Link href="/admin/rules" className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-[var(--radius-control)] text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden />
        State rules
      </Link>
      <ConsoleHeader
        title={`${jurisdiction.name} rules`}
        description={`${jurisdiction.agency.name}. Support level: ${humanize(jurisdiction.supportLevel).toLowerCase()}. Filing ${jurisdiction.filingEnabled ? "enabled" : "not enabled"}.`}
      />

      {!rules.length ? (
        <Notice tone="warning" title="UNVERIFIED, no rules loaded">
          We make no claims about {jurisdiction.name}&apos;s filing requirements. Customers see only the official agency link:{" "}
          <a className="underline underline-offset-2" href={jurisdiction.agency.websiteUrl} target="_blank" rel="noopener noreferrer">
            {jurisdiction.agency.websiteUrl}
          </a>
          .
        </Notice>
      ) : null}

      {rules.map((rule) => {
        const current = versions.find((v) => v.id === rule.current_version_id) ?? null;
        const older = versions.filter((v) => v.rule_id === rule.id && v.id !== rule.current_version_id);
        const ruleSources = current ? sources.filter((s) => s.rule_version_id === current.id) : [];
        const entity = isEntityType(rule.entity_type) ? ENTITY_TYPE_LABELS[rule.entity_type] : rule.entity_type;
        return (
          <Panel
            key={rule.id}
            id={rule.entity_type}
            title={`${entity}: ${current?.filing_name ?? humanize(rule.filing_type_code)}`}
            description={
              <span className="font-mono text-xs">
                {rule.rule_key} · {humanize(rule.applies_to).toLowerCase()}
              </span>
            }
            actions={current ? <StatusPill status={current.verification_status} /> : <StatusPill status="no version" tone="danger" />}
          >
            {current ? (
              <div className="grid gap-4">
                <KeyValues
                  items={[
                    { term: "Current version", value: `v${current.version} (${humanize(current.publication_status).toLowerCase()})` },
                    { term: "Effective from", value: formatDate(current.effective_from) },
                    { term: "Form", value: current.form_number ?? "None" },
                    {
                      term: "State fee",
                      value: (
                        <span className="tnum">
                          {money(current.state_fee_cents)}
                          {current.nonprofit_state_fee_cents !== null ? ` (not-for-profit: ${money(current.nonprofit_state_fee_cents)})` : ""}
                        </span>
                      ),
                    },
                    { term: "Content hash", value: <span className="font-mono text-xs" title={current.content_hash}>{current.content_hash.slice(0, 12)}</span> },
                    { term: "Last verified", value: current.last_verified_at ? formatDate(current.last_verified_at) : "Never" },
                    { term: "Verified by", value: current.verified_by ?? "Unknown" },
                    ...(current.notes ? [{ term: "Notes", value: current.notes }] : []),
                    ...(older.length ? [{ term: "Earlier versions", value: older.map((v) => `v${v.version} (${v.publication_status})`).join(", ") }] : []),
                  ]}
                />
                <div className="grid gap-2">
                  <h3 className="text-sm font-semibold text-fg">Sources ({ruleSources.length})</h3>
                  {ruleSources.length ? (
                    <ul className="grid divide-y divide-border rounded-[var(--radius-control)] border border-border">
                      {ruleSources.map((s) => (
                        <li key={s.id} className="grid gap-1 px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <a className={tableLink} href={s.url} target="_blank" rel="noopener noreferrer">
                              {s.title ?? s.url}
                            </a>
                            <span className="font-mono text-xs text-subtle">{s.fact_key}</span>
                          </div>
                          {s.quote ? <p className="text-muted">&ldquo;{s.quote}&rdquo;</p> : null}
                          <p className="text-xs text-subtle">
                            {s.publisher ? `${s.publisher} · ` : ""}Last verified {formatDate(s.last_verified_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyRow>No sources recorded for this version.</EmptyRow>
                  )}
                </div>
              </div>
            ) : (
              <EmptyRow>No current version is published for this rule.</EmptyRow>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
