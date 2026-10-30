import type { BillingStatus, ProviderOrderKind, ProviderOrderStatus, ServiceStatus } from "@/lib/registered-agent/status";

/**
 * "What happens next" for a registered agent order, in the customer's words. Built only from
 * recorded statuses, so it never claims a step happened before an operator recorded it, and
 * it promises no dates.
 */

export type StepState = "done" | "current" | "upcoming";

export interface ProgressStep {
  key: string;
  label: string;
  detail: string;
  state: StepState;
}

const PLACED: ProviderOrderStatus[] = ["submitted_to_provider", "processing", "active", "completed"];

export function serviceProgress(input: {
  billingStatus: BillingStatus;
  serviceStatus: ServiceStatus;
  origin: "switching" | "new_entity" | "formation_add_on";
  orders: { kind: ProviderOrderKind; status: ProviderOrderStatus }[];
}): { steps: ProgressStep[]; needsCustomer: boolean } | null {
  // Ending or ended service has its own messages; the tracker is for getting set up.
  if (input.serviceStatus !== "pending_appointment" && input.serviceStatus !== "active") return null;
  const agent = input.orders.find((o) => o.kind === "registered_agent");
  const change = input.orders.find((o) => o.kind === "change_of_agent");
  const paid = input.billingStatus !== "pending" && input.billingStatus !== "incomplete";
  const placed = !!agent && PLACED.includes(agent.status);
  const stateDone = input.origin === "switching" ? change?.status === "completed" : input.serviceStatus === "active";
  const active = input.serviceStatus === "active";
  const needsCustomer = input.orders.some((o) => o.status === "information_needed");

  const raw: Omit<ProgressStep, "state">[] = [
    { key: "paid", label: "Payment confirmed", detail: paid ? "Thanks. Your receipt is in your email." : "We're confirming your payment." },
    {
      key: "placed",
      label: "We set up your agent",
      detail: needsCustomer ? "We need something from you first. We've emailed you what it is." : "We place the order with our registered agent provider.",
    },
    input.origin === "switching"
      ? { key: "state", label: "The state updates its record", detail: "We file the change of agent. The state's processing time varies." }
      : { key: "state", label: "You name us when you form", detail: "Use our agent's name and address in your formation filing. We confirm once the state approves it." },
    { key: "active", label: "You're covered", detail: "Legal papers and state notices appear here, and we email you when they arrive." },
  ];
  const done = [paid, placed, stateDone, active];
  const firstOpen = done.findIndex((d) => !d);
  const steps = raw.map((s, i) => ({ ...s, state: (done[i] ? "done" : i === firstOpen ? "current" : "upcoming") as StepState }));
  return { steps, needsCustomer };
}
