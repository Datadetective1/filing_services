import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatDate, humanize } from "@/components/admin/format";
import { tableLink } from "@/components/admin/layout-bits";
import { Notice, PageHeader } from "@/components/ui/surface";
import { Table, TableScroll, TD, TH, THead, TR } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { listJurisdictions } from "@/lib/compliance/registry";
import { createClient } from "@/lib/supabase/server";
import { one } from "../_lib/data";

export const metadata: Metadata = { title: "State rules" };

interface StateRow {
  code: string;
  name: string;
  support_level: string;
  filing_enabled: boolean;
  state_agencies:
    | { name: string; website_url: string; verification_status: string; last_verified_at: string | null }
    | { name: string; website_url: string; verification_status: string; last_verified_at: string | null }[]
    | null;
}

export default async function RulesPage() {
  await requireStaff();
  const db = await createClient();
  const [statesRes, rulesRes, versionsRes] = await Promise.all([
    db.from("states").select("code, name, support_level, filing_enabled, state_agencies(name, website_url, verification_status, last_verified_at)").order("name"),
    db.from("compliance_rules").select("id, state_code, current_version_id"),
    db.from("state_rule_versions").select("id, rule_id, verification_status, publication_status").eq("publication_status", "published"),
  ]);

  const dbStates = (statesRes.data ?? []) as StateRow[];
  const rules = (rulesRes.data ?? []) as { id: string; state_code: string; current_version_id: string | null }[];
  const versions = (versionsRes.data ?? []) as { id: string; rule_id: string; verification_status: string }[];

  const ruleState = new Map(rules.map((r) => [r.id, r.state_code]));
  const verifiedStates = new Set<string>();
  const ruleCounts = new Map<string, number>();
  for (const r of rules) ruleCounts.set(r.state_code, (ruleCounts.get(r.state_code) ?? 0) + 1);
  for (const v of versions) {
    const code = ruleState.get(v.rule_id);
    if (code && v.verification_status === "verified") verifiedStates.add(code);
  }

  // Fall back to the code registry if the database has not been seeded.
  const usingRegistry = dbStates.length === 0;
  const states = usingRegistry
    ? listJurisdictions().map((j) => ({
        code: j.code,
        name: j.name,
        supportLevel: j.supportLevel,
        filingEnabled: j.filingEnabled,
        agency: { name: j.agency.name, website: j.agency.websiteUrl, status: j.agency.verificationStatus, verifiedAt: j.agency.lastVerifiedAt },
      }))
    : dbStates.map((s) => {
        const a = one(s.state_agencies);
        return {
          code: s.code,
          name: s.name,
          supportLevel: s.support_level,
          filingEnabled: s.filing_enabled,
          agency: a ? { name: a.name, website: a.website_url, status: a.verification_status, verifiedAt: a.last_verified_at } : null,
        };
      });

  return (
    <div className="grid gap-4">
      <PageHeader
        title="State rules"
        description="Read-only. Rules change only through versioned code and the seed script, and each published version is immutable."
      />
      {usingRegistry ? (
        <Notice tone="warning" title="The database has no states yet">
          Showing the code registry. Run the seed script to load states, agencies and rule versions.
        </Notice>
      ) : null}
      <p className="text-sm text-muted">
        {verifiedStates.size} of {states.length} jurisdictions have verified rules. Every other state is unverified: the product shows only the official agency
        link there and makes no claims.
      </p>
      <TableScroll>
        <Table className="min-w-[56rem]">
          <THead>
            <tr>
              <TH>State</TH>
              <TH>Support level</TH>
              <TH>Filing enabled</TH>
              <TH>Rule verification</TH>
              <TH>Agency directory</TH>
            </tr>
          </THead>
          <tbody>
            {states.map((s) => {
              const verified = verifiedStates.has(s.code);
              return (
                <TR key={s.code}>
                  <TD className="py-2">
                    <Link className={tableLink} href={`/admin/rules/${s.code}`}>
                      {s.name}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-subtle">{s.code}</span>
                  </TD>
                  <TD className="py-2">{humanize(s.supportLevel)}</TD>
                  <TD className="py-2">{s.filingEnabled ? <Badge tone="success">Enabled</Badge> : <span className="text-muted">No</span>}</TD>
                  <TD className="py-2">
                    {verified ? (
                      <Badge tone="success">Verified ({ruleCounts.get(s.code) ?? 0} rules)</Badge>
                    ) : (
                      <Badge tone="warning">UNVERIFIED, no rules loaded</Badge>
                    )}
                  </TD>
                  <TD className="py-2">
                    {s.agency ? (
                      <span className="grid gap-0.5">
                        <span className="flex flex-wrap items-center gap-2">
                          <Badge tone={s.agency.status === "verified" ? "success" : "warning"}>{humanize(s.agency.status)}</Badge>
                          {s.agency.verifiedAt ? <span className="tnum text-xs text-muted">{formatDate(s.agency.verifiedAt)}</span> : null}
                        </span>
                        <a className="max-w-80 truncate text-xs text-muted underline underline-offset-2 hover:text-fg" href={s.agency.website} target="_blank" rel="noopener noreferrer">
                          {s.agency.name}
                        </a>
                      </span>
                    ) : (
                      <span className="text-muted">No agency record</span>
                    )}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </TableScroll>
    </div>
  );
}
