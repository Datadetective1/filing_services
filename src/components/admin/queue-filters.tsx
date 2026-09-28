import Link from "next/link";
import type { ReactNode } from "react";
import { Funnel } from "@phosphor-icons/react/dist/ssr";
import { Input, Label, Select } from "@/components/ui/field";
import { FILING_STATUSES } from "@/lib/domain/filing-status";
import { opsButton } from "./button-classes";
import { ADMIN_STATUS_LABELS, ORDER_STATUS_LABELS } from "./status";
import { URGENCY_DESCRIPTIONS, URGENCY_LABELS, URGENCY_LEVELS } from "./urgency";

export interface QueueFilterValues {
  state: string;
  type: string;
  due_from: string;
  due_to: string;
  status: string;
  payment: string;
  urgency: string;
  assigned: string;
}

export const STATUS_PRESETS: { value: string; label: string }[] = [
  { value: "", label: "Active (in our hands)" },
  { value: "ready_for_review,ready_to_file", label: "Ready (review or file)" },
  { value: "needs_information,needs_customer_action", label: "Waiting on customer" },
  { value: "all", label: "All statuses" },
];

export const PAYMENT_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Any" },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  { value: "none", label: "No order" },
];

/** GET filter form for the operations queue. Plain HTML: works without JavaScript. */
export function QueueFilters({
  values,
  states,
  filingTypes,
  staff,
}: {
  values: QueueFilterValues;
  states: { code: string; name: string }[];
  filingTypes: { code: string; name: string }[];
  staff: { id: string; label: string }[];
}) {
  const statusKnown = STATUS_PRESETS.some((p) => p.value === values.status) || FILING_STATUSES.includes(values.status as never);
  return (
    <form method="get" action="/admin/queue" className="grid gap-3 rounded-[var(--radius-surface)] border border-border bg-surface p-3">
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-4 2xl:grid-cols-8">
        <FilterField id="f-status" label="Status">
          <Select id="f-status" name="status" defaultValue={values.status}>
            {STATUS_PRESETS.map((p) => (
              <option key={p.value || "active"} value={p.value}>
                {p.label}
              </option>
            ))}
            {!statusKnown && values.status ? <option value={values.status}>Custom selection</option> : null}
            <optgroup label="Single status">
              {FILING_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ADMIN_STATUS_LABELS[s]}
                </option>
              ))}
            </optgroup>
          </Select>
        </FilterField>
        <FilterField id="f-urgency" label="Urgency">
          <Select id="f-urgency" name="urgency" defaultValue={values.urgency}>
            <option value="">Any</option>
            {URGENCY_LEVELS.map((u) => (
              <option key={u} value={u}>
                {URGENCY_LABELS[u]}: {URGENCY_DESCRIPTIONS[u].toLowerCase()}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="f-state" label="State">
          <Select id="f-state" name="state" defaultValue={values.state}>
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="f-type" label="Filing type">
          <Select id="f-type" name="type" defaultValue={values.type}>
            <option value="">All types</option>
            {filingTypes.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="f-from" label="Due from">
          <Input id="f-from" name="due_from" type="date" defaultValue={values.due_from} />
        </FilterField>
        <FilterField id="f-to" label="Due to">
          <Input id="f-to" name="due_to" type="date" defaultValue={values.due_to} />
        </FilterField>
        <FilterField id="f-payment" label="Payment">
          <Select id="f-payment" name="payment" defaultValue={values.payment}>
            {PAYMENT_FILTERS.map((p) => (
              <option key={p.value || "any"} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField id="f-assigned" label="Assigned">
          <Select id="f-assigned" name="assigned" defaultValue={values.assigned}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {staff.length ? (
              <optgroup label="Staff">
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </Select>
        </FilterField>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className={opsButton("primary")}>
          <Funnel size={16} aria-hidden />
          Apply filters
        </button>
        <Link href="/admin/queue" className={opsButton("ghost")}>
          Reset
        </Link>
      </div>
    </form>
  );
}

function FilterField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted">
        {label}
      </Label>
      {children}
    </div>
  );
}
