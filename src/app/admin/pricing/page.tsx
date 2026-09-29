import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/action-form";
import { centsToDollarsInput, formatDateTime, money } from "@/components/admin/format";
import { ConsoleHeader, EmptyRow, Panel } from "@/components/admin/layout-bits";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { requireStaff } from "@/lib/auth/session";
import { FILING_TYPES, getJurisdiction } from "@/lib/compliance/registry";
import { ENTITY_TYPE_LABELS, isEntityType } from "@/lib/domain/types";
import { createClient } from "@/lib/supabase/server";
import { profilesByIds } from "../_lib/data";
import { approvePriceAction, changeFeeAction } from "./actions";

export const metadata: Metadata = { title: "Pricing" };

interface PriceRow {
  id: string;
  filing_type_code: string;
  state_code: string | null;
  entity_type: string | null;
  service_fee_cents: number;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  active: boolean;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

function scopeLabel(p: PriceRow): string {
  const type = FILING_TYPES.find((t) => t.code === p.filing_type_code)?.name ?? p.filing_type_code;
  const state = p.state_code ? (getJurisdiction(p.state_code)?.name ?? p.state_code) : "All states";
  const entity = p.entity_type ? (isEntityType(p.entity_type) ? ENTITY_TYPE_LABELS[p.entity_type] : p.entity_type) : "All entity types";
  return `${type} · ${state} · ${entity}`;
}

export default async function PricingPage() {
  const staff = await requireStaff();
  const isAdmin = staff.role === "admin";
  const db = await createClient();
  const { data, error } = await db
    .from("service_prices")
    .select("id, filing_type_code, state_code, entity_type, service_fee_cents, approved, approved_at, approved_by, active, notes, updated_by, updated_at")
    .order("active", { ascending: false })
    .order("filing_type_code")
    .order("state_code", { nullsFirst: true })
    .order("entity_type", { nullsFirst: true });
  const prices = (data ?? []) as PriceRow[];
  const people = await profilesByIds(prices.flatMap((p) => [p.approved_by, p.updated_by]));

  return (
    <div className="grid grid-cols-1 gap-6">
      <ConsoleHeader
        title="Pricing"
        description="Our service fees. The state's government fee always comes from the filing's rule and is shown to customers as a separate line."
      />
      <Notice tone="info" title="How prices reach checkout">
        The most specific active price wins (state and entity type, then state, then entity type, then the default). Live checkout refuses any price that is
        not approved, and changing a fee resets its approval. Customers always see the state fee separately and are told they can file directly with the state
        for the state fee alone.
      </Notice>
      {!isAdmin ? <Notice tone="neutral">Only admins can change or approve prices.</Notice> : null}
      {error ? (
        <Notice tone="danger" role="alert" title="Prices could not be loaded">
          {error.message}
        </Notice>
      ) : null}

      {prices.length ? (
        <div className="grid gap-4">
          {prices.map((p) => (
            <Panel
              key={p.id}
              title={scopeLabel(p)}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {!p.active ? <Badge>Inactive</Badge> : null}
                  {p.approved ? <Badge tone="success">Approved</Badge> : <Badge tone="warning">Provisional, not approved</Badge>}
                </div>
              }
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid content-start gap-4">
                <div className="grid gap-1">
                  <p className="text-[13px] font-medium text-muted">Service fee</p>
                  <p className="tnum font-display text-[34px] font-semibold leading-none text-fg">{money(p.service_fee_cents)}</p>
                  <p className="text-xs text-muted">Plus the state&apos;s government fee, shown to customers as its own line.</p>
                </div>
                <dl className="grid gap-x-4 gap-y-2 border-t border-border/70 pt-4 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
                  <dt className="text-muted">Approval</dt>
                  <dd className="text-fg">
                    {p.approved
                      ? `Approved ${formatDateTime(p.approved_at)}${p.approved_by ? ` by ${people.get(p.approved_by)?.email ?? "an admin"}` : ""}`
                      : "Not approved. Sandbox and test checkout only."}
                  </dd>
                  <dt className="text-muted">Notes</dt>
                  <dd className="text-fg">{p.notes || <span className="text-muted">None</span>}</dd>
                  <dt className="text-muted">Updated</dt>
                  <dd className="text-fg">
                    {formatDateTime(p.updated_at)}
                    {p.updated_by ? <span className="text-muted"> by {people.get(p.updated_by)?.email ?? "staff"}</span> : null}
                  </dd>
                </dl>
                </div>

                {isAdmin ? (
                  <div className="grid content-start gap-4">
                    <div className="rounded-[var(--radius-control)] border border-border bg-bg p-4">
                      <h3 className="mb-3 text-[15px] font-semibold text-fg">Change fee</h3>
                      <ActionForm action={changeFeeAction} submitLabel="Save fee" pendingLabel="Saving..." resetOnSuccess={false}>
                        <input type="hidden" name="priceId" value={p.id} />
                        <Field label="Service fee ($)" htmlFor={`fee-${p.id}`} hint="Between $0 and $10,000. Saving resets approval.">
                          <Input
                            id={`fee-${p.id}`}
                            name="fee"
                            inputMode="decimal"
                            required
                            defaultValue={centsToDollarsInput(p.service_fee_cents)}
                            className="tnum max-w-48"
                            autoComplete="off"
                          />
                        </Field>
                        <Field label="Note" htmlFor={`notes-${p.id}`} optional hint="Replaces the current note.">
                          <Input id={`notes-${p.id}`} name="notes" maxLength={500} autoComplete="off" />
                        </Field>
                      </ActionForm>
                    </div>
                    {!p.approved && p.active ? (
                      <div className="rounded-[var(--radius-control)] border border-highlight/50 bg-highlight-soft p-4">
                        <h3 className="mb-3 text-[15px] font-semibold text-fg">Approve {money(p.service_fee_cents)}</h3>
                        <ActionForm
                          action={approvePriceAction}
                          submitLabel="Approve price"
                          pendingLabel="Approving..."
                          variant="primary"
                          confirmLabel="I approve this price for live payments"
                        >
                          <input type="hidden" name="priceId" value={p.id} />
                          <input type="hidden" name="expectedFee" value={p.service_fee_cents} />
                        </ActionForm>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyRow>No service prices are configured. Checkout is unavailable until one exists.</EmptyRow>
      )}
    </div>
  );
}
