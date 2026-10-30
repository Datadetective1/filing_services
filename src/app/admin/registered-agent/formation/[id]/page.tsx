import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import {
  formatDate,
  formatDateTime,
  isUuid,
  money,
} from "@/components/admin/format";
import {
  ConsoleHeader,
  EmptyRow,
  KeyValues,
  Panel,
} from "@/components/admin/layout-bits";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { requireStaff } from "@/lib/auth/session";
import { ENTITY_TYPE_LABELS, isEntityType } from "@/lib/domain/types";
import { getRaJurisdiction } from "@/lib/registered-agent/jurisdictions";
import { providerEntrySheet } from "@/lib/registered-agent/manual-provider";
import {
  nextOperatorAction,
  PROVIDER_ORDER_STATUS_LABELS,
  PROVIDER_ORDER_TRANSITIONS,
  type ProviderOrderStatus,
} from "@/lib/registered-agent/status";
import { createClient } from "@/lib/supabase/server";
import { transitionAction } from "../../actions";

export const metadata: Metadata = { title: "Formation order" };

/**
 * A formation order without registered agent service (with the add-on, it is worked from the
 * service page instead). Same workflow as every provider order: the database enforces it.
 */
export default async function FormationOrderAdminPage(
  props: PageProps<"/admin/registered-agent/formation/[id]">,
) {
  await requireStaff();
  const { id } = await props.params;
  if (!isUuid(id)) notFound();
  const db = await createClient();
  const { data: o } = await db
    .from("provider_orders")
    .select("*, businesses(legal_name, entity_type, lifecycle, formation_date)")
    .eq("id", id)
    .eq("kind", "formation")
    .maybeSingle();
  if (!o) notFound();
  if (o.ra_subscription_id)
    redirect(`/admin/registered-agent/${o.ra_subscription_id}`);
  const { data: events } = await db
    .from("provider_order_events")
    .select("*")
    .eq("provider_order_id", o.id)
    .order("created_at", { ascending: false });
  const business = (
    Array.isArray(o.businesses) ? o.businesses[0] : o.businesses
  ) as {
    legal_name: string;
    entity_type: string;
    lifecycle: string;
    formation_date: string | null;
  } | null;
  const details = (o.details ?? {}) as Record<string, unknown>;
  const str = (k: string) =>
    typeof details[k] === "string" ? (details[k] as string) : null;
  const stateName = getRaJurisdiction(o.state_code)?.name ?? o.state_code;
  const status = o.status as ProviderOrderStatus;
  const next = PROVIDER_ORDER_TRANSITIONS[status];
  const entityTypeLabel =
    business && isEntityType(business.entity_type)
      ? ENTITY_TYPE_LABELS[business.entity_type]
      : (business?.entity_type ?? "");
  const sheet = providerEntrySheet({
    kind: "formation",
    legalName: business?.legal_name ?? "",
    stateName,
    entityTypeLabel,
    entityNumber: null,
    contactName: str("contact_name"),
    contactPhone: str("contact_phone"),
    contactAddress: str("principal_address"),
    currentAgentName: null,
    details,
  });

  return (
    <div className="grid gap-6">
      <ConsoleHeader
        eyebrow={<Link href="/admin/registered-agent">Registered agent</Link>}
        title={`${business?.legal_name ?? "Business"} · ${stateName}`}
        description={`Formation of a ${entityTypeLabel}. The customer names their own registered agent.`}
      >
        <div className="flex flex-wrap gap-2">
          <Badge
            tone={
              status === "completed"
                ? "success"
                : status === "information_needed"
                  ? "warning"
                  : "info"
            }
          >
            {PROVIDER_ORDER_STATUS_LABELS[status]}
          </Badge>
          <Badge>
            {business?.lifecycle === "forming"
              ? "Being formed"
              : `Formed ${business?.formation_date ? formatDate(business.formation_date) : ""}`}
          </Badge>
        </div>
      </ConsoleHeader>

      <Panel
        title={`Formation filing · ${PROVIDER_ORDER_STATUS_LABELS[status]}`}
        description={nextOperatorAction("formation", status) ?? undefined}
      >
        {status === "payment_confirmed" ||
        status === "information_needed" ||
        status === "ready_for_provider" ? (
          <div className="mb-5 grid gap-2 rounded-[var(--radius-control)] border border-border bg-bg p-4">
            <p className="text-sm font-semibold text-fg">
              Partner dashboard entry sheet
            </p>
            {sheet.missing.length > 0 ? (
              <p className="text-sm text-danger">
                Missing: {sheet.missing.join(", ")}. Ask the customer first.
              </p>
            ) : null}
            <KeyValues
              items={sheet.rows.map((r) => ({
                term: r.label,
                value: r.value || "Missing",
              }))}
            />
          </div>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-2">
          <KeyValues
            items={[
              {
                term: "Provider order number",
                value: o.provider_reference ?? "Not placed",
              },
              {
                term: "Submitted",
                value: o.submitted_at ? formatDateTime(o.submitted_at) : "",
              },
              {
                term: "Confirmed on",
                value: o.confirmed_on
                  ? `${formatDate(o.confirmed_on)}: ${o.evidence}`
                  : "",
              },
              {
                term: "State fee collected",
                value: money(o.government_fee_cents),
              },
              {
                term: "State fee paid",
                value:
                  o.government_fee_remitted_cents === null
                    ? "Not recorded"
                    : money(o.government_fee_remitted_cents),
              },
              { term: "Wholesale cost", value: money(o.wholesale_cost_cents) },
            ]}
          />
          {next.length > 0 ? (
            <ActionForm
              action={transitionAction}
              submitLabel="Update order"
              pendingLabel="Saving..."
            >
              <input type="hidden" name="providerOrderId" value={o.id} />
              <input type="hidden" name="expectedFrom" value={status} />
              <Field label="Move to" htmlFor="to">
                <Select id="to" name="to" defaultValue={next[0]}>
                  {next.map((s) => (
                    <option key={s} value={s}>
                      {PROVIDER_ORDER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Provider order number" htmlFor="ref" optional>
                <Input
                  id="ref"
                  name="providerReference"
                  maxLength={100}
                  defaultValue={o.provider_reference ?? ""}
                />
              </Field>
              <Field
                label="Confirmed on (YYYY-MM-DD)"
                htmlFor="conf"
                optional
                hint="The state's approval date. Required to mark completed."
              >
                <Input id="conf" name="confirmedOn" type="date" />
              </Field>
              <Field
                label="Evidence"
                htmlFor="ev"
                optional
                hint="The state's approval or the state record and the date you checked it."
              >
                <Textarea id="ev" name="evidence" rows={2} maxLength={2000} />
              </Field>
              <Field label="State fee paid (dollars)" htmlFor="fee" optional>
                <Input
                  id="fee"
                  name="governmentFeeRemitted"
                  inputMode="decimal"
                />
              </Field>
              <Field
                label="Note"
                htmlFor="note"
                optional
                hint="Required when asking the customer for information; it is emailed to them."
              >
                <Textarea id="note" name="note" rows={2} maxLength={2000} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="customerVisible" defaultChecked />{" "}
                Show this update to the customer
              </label>
            </ActionForm>
          ) : (
            <EmptyRow>No further steps.</EmptyRow>
          )}
        </div>
      </Panel>

      <Panel title="History">
        {(events ?? []).length === 0 ? (
          <EmptyRow>No changes yet.</EmptyRow>
        ) : (
          <ul className="grid gap-2 text-sm">
            {(events ?? []).map((e) => (
              <li key={String(e.id)}>
                {formatDateTime(String(e.created_at))}:{" "}
                {String(e.from_status ?? "")} to {String(e.to_status ?? "")}
                {e.note ? ` (${String(e.note)})` : ""}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
