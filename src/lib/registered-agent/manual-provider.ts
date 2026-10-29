import { WHOLESALE } from "@/lib/services/catalog";
import type { RegisteredAgentOrder, RegisteredAgentProvider, ServiceOfProcessEvent } from "./types";

/**
 * Registered Agents Inc. through its partner dashboard, by hand. There is no API integration:
 * an operator places each order in the dashboard and records the result in
 * /admin/registered-agent, where the database enforces the workflow. This adapter therefore
 * never calls the provider. It prices from the quoted wholesale rates and refuses the calls a
 * person must make, saying what to do instead.
 */
export class ManualFulfillmentRequired extends Error {}

export class ManualRegisteredAgentsIncProvider implements RegisteredAgentProvider {
  readonly name = "registered_agents_inc_manual";

  async quote(): Promise<{ wholesaleCents: number; currency: "usd" }> {
    return { wholesaleCents: WHOLESALE.registeredAgentPerYear, currency: "usd" };
  }

  async order(): Promise<RegisteredAgentOrder> {
    throw new ManualFulfillmentRequired(
      "Place this order in the Registered Agents Inc. partner dashboard, then record its order number in /admin/registered-agent.",
    );
  }

  async cancel(): Promise<void> {
    throw new ManualFulfillmentRequired(
      "Cancel in the partner dashboard (at least 30 days before the provider's renewal), then record it in /admin/registered-agent.",
    );
  }

  parseWebhook(): ServiceOfProcessEvent | RegisteredAgentOrder {
    throw new ManualFulfillmentRequired("The provider sends no webhooks: documents arrive by email to Filewell's account and are uploaded by an operator.");
  }
}

export interface ProviderEntrySheet {
  rows: { label: string; value: string }[];
  missing: string[];
}

/**
 * What an operator types into the partner dashboard for one order, in one place, with anything
 * missing called out before the order is placed.
 */
export function providerEntrySheet(input: {
  kind: "registered_agent" | "change_of_agent" | "formation";
  legalName: string;
  stateName: string;
  entityTypeLabel: string;
  entityNumber: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  currentAgentName: string | null;
}): ProviderEntrySheet {
  const rows = [
    { label: "Business legal name", value: input.legalName },
    { label: "Jurisdiction", value: input.stateName },
    { label: "Entity type", value: input.entityTypeLabel },
    { label: "State entity number", value: input.entityNumber ?? "" },
    { label: "Communications contact", value: input.contactName ?? "" },
    { label: "Contact phone", value: input.contactPhone ?? "" },
    { label: "Contact physical address", value: input.contactAddress ?? "" },
    ...(input.kind === "change_of_agent"
      ? [{ label: "Current registered agent", value: input.currentAgentName ?? "Not given: read it from the state record" }]
      : []),
  ];
  const required = ["Business legal name", "Jurisdiction", "Communications contact", "Contact phone", "Contact physical address"];
  // The current agent is on the state record, so the customer isn't asked for it.
  if (input.kind === "change_of_agent") required.push("State entity number");
  const missing = rows.filter((r) => required.includes(r.label) && !r.value.trim()).map((r) => r.label);
  return { rows, missing };
}
