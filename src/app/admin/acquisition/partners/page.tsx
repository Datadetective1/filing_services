import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/action-form";
import { humanize, money } from "@/components/admin/format";
import { ConsoleHeader, Panel } from "@/components/admin/layout-bits";
import { listPartners, PARTNER_KINDS, PARTNER_STATUSES, type PartnerView } from "@/lib/acquisition/partners";
import { requireStaff } from "@/lib/auth/session";
import { savePartnerAction } from "../actions";

export const metadata: Metadata = { title: "Referral partners" };
export const dynamic = "force-dynamic";

const input = "h-9 w-full rounded-[var(--radius-control)] border border-border bg-surface px-2.5 text-sm text-fg";

function PartnerFields({ p }: { p?: PartnerView }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {p ? <input type="hidden" name="id" value={p.id} /> : null}
      <label className="grid gap-1 text-xs text-muted">
        Firm
        <input name="firmName" required defaultValue={p?.firmName ?? ""} className={input} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Type
        <select name="kind" defaultValue={p?.kind ?? "accountant"} className={input}>
          {PARTNER_KINDS.map((k) => (
            <option key={k} value={k}>
              {humanize(k)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Website
        <input name="websiteUrl" type="url" defaultValue={p?.websiteUrl ?? ""} placeholder="https://" className={input} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Public contact channel
        <input name="publicContact" defaultValue={p?.publicContact ?? ""} placeholder="Contact form, office phone..." className={input} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Status
        <select name="status" defaultValue={p?.status ?? "to_contact"} className={input}>
          {PARTNER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {humanize(s)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Contacted on
        <input name="contactedOn" type="date" defaultValue={p?.contactedOn ?? ""} className={input} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Referral code (optional)
        <input name="refCode" defaultValue={p?.refCode ?? ""} placeholder="e.g. smith-cpa" className={input} />
      </label>
      <label className="grid gap-1 text-xs text-muted">
        Response
        <input name="response" defaultValue={p?.response ?? ""} className={input} />
      </label>
      <label className="grid gap-1 text-xs text-muted sm:col-span-2 xl:col-span-4">
        Notes
        <input name="notes" defaultValue={p?.notes ?? ""} className={input} />
      </label>
    </div>
  );
}

/** CRM-style pipeline for referral partners. No commissions, payouts or partner logins. */
export default async function PartnersPage() {
  await requireStaff();
  const partners = await listPartners();
  return (
    <div className="grid gap-6">
      <ConsoleHeader
        eyebrow={<Link href="/admin/acquisition">Acquisition</Link>}
        title="Referral partners"
        description="Accountants, bookkeepers, tax preparers, consultants and formation services. Give an interested partner a link like https://www.getfilewell.com/?ref=their-code to see the customers they refer."
      />
      <Panel title="Add a partner">
        <ActionForm action={savePartnerAction} submitLabel="Add partner" variant="primary">
          <PartnerFields />
        </ActionForm>
      </Panel>
      {partners.map((p) => (
        <Panel
          key={p.id}
          title={p.firmName}
          description={`${humanize(p.kind)} · ${humanize(p.status)}${p.refCode ? ` · https://www.getfilewell.com/?ref=${p.refCode}` : ""}`}
          actions={
            <span className="text-sm text-muted">
              {p.referredCustomers} referred · {money(p.serviceRevenueCents)}
            </span>
          }
        >
          <ActionForm action={savePartnerAction} submitLabel="Save" resetOnSuccess={false}>
            <PartnerFields p={p} />
          </ActionForm>
        </Panel>
      ))}
    </div>
  );
}
