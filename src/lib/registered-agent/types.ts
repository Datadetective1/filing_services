/**
 * Registered-agent service (future product) via a WHOLESALE provider.
 *
 * We do not operate statutory registered-agent infrastructure ourselves. A wholesale
 * provider supplies the in-state address and mail/service-of-process handling; the
 * customer relationship, UI, billing and notifications stay ours. Implement this
 * interface for the chosen provider and keep provider identifiers on our records.
 */

export interface RegisteredAgentAddress {
  providerName: string; // the commercial registered office provider name used on filings
  line1: string;
  line2?: string;
  city: string;
  region: string;
  postalCode: string;
  county?: string;
}

export interface RegisteredAgentOrder {
  providerOrderId: string;
  stateCode: string;
  status: "pending" | "active" | "cancelled";
  address: RegisteredAgentAddress;
  startsOn: string;
  renewsOn: string | null;
}

export interface ServiceOfProcessEvent {
  providerEventId: string;
  providerOrderId: string;
  receivedAt: string;
  documentUrl: string | null; // provider-hosted; copy into our private storage on receipt
  summary: string;
}

export interface RegisteredAgentProvider {
  readonly name: string;
  quote(stateCode: string): Promise<{ wholesaleCents: number; currency: "usd" }>;
  order(input: { stateCode: string; businessLegalName: string; entityNumber?: string; contactEmail: string }): Promise<RegisteredAgentOrder>;
  cancel(providerOrderId: string): Promise<void>;
  /** Verify + parse the provider's webhook (service of process, mail, status changes). */
  parseWebhook(rawBody: string, headers: Headers): ServiceOfProcessEvent | RegisteredAgentOrder;
}

/** Placeholder until a provider is contracted: every call fails loudly, nothing is sent. */
export class UnconfiguredRegisteredAgentProvider implements RegisteredAgentProvider {
  readonly name = "unconfigured";
  private fail(): never {
    throw new Error("Registered-agent service is not available yet: no wholesale provider is configured.");
  }
  async quote(): Promise<never> {
    this.fail();
  }
  async order(): Promise<never> {
    this.fail();
  }
  async cancel(): Promise<never> {
    this.fail();
  }
  parseWebhook(): never {
    this.fail();
  }
}
