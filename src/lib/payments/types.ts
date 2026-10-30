export type PaymentMode = "sandbox" | "test" | "live";
export type ProviderName = "stripe" | "sandbox";

export interface CheckoutLineItem {
  kind: "government_fee" | "government_late_fee" | "service_fee";
  name: string;
  amountCents: number;
  /**
   * A yearly recurring price (registered agent service). Any recurring line turns the
   * checkout into a subscription: recurring lines renew every year at the same amount,
   * one-time lines (state fees) are charged once, on the first invoice only.
   */
  recurring?: { interval: "year" };
}

export interface CreateCheckoutInput {
  orderId: string;
  paymentId: string;
  lineItems: CheckoutLineItem[];
  totalCents: number;
  currency: "usd";
  customerEmail: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

export interface SessionStatus {
  sessionId: string;
  status: "open" | "complete" | "expired";
  paid: boolean;
  amountCents: number | null;
  currency: string | null;
  providerPaymentId: string | null;
  orderId: string | null;
  paymentId: string | null;
  /** Set for subscription checkouts. */
  subscriptionId?: string | null;
  invoiceId?: string | null;
}

export type NormalizedEventType =
  | "checkout.completed"
  | "payment.failed"
  | "checkout.expired"
  | "refund.succeeded"
  | "refund.failed"
  /** A subscription invoice was paid (first year or a renewal). */
  | "subscription.invoice_paid"
  /** A subscription invoice failed (Stripe retries on its own schedule). */
  | "subscription.invoice_failed"
  /** Subscription status, period or cancel-at-period-end changed. */
  | "subscription.updated"
  /** The subscription ended (billing only: the legal appointment is handled by operators). */
  | "subscription.deleted"
  | "ignored";

export interface NormalizedPaymentEvent {
  provider: ProviderName;
  id: string;
  rawType: string;
  type: NormalizedEventType;
  createdAt: Date;
  sessionId?: string | null;
  providerPaymentId?: string | null;
  orderId?: string | null;
  internalPaymentId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  receiptUrl?: string | null;
  failureReason?: string | null;
  providerRefundId?: string | null;
  internalRefundId?: string | null;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  /** Stripe invoice billing_reason: "subscription_create" (first year) or "subscription_cycle" (renewal). */
  billingReason?: string | null;
  subscriptionStatus?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  attemptCount?: number | null;
  nextAttemptAt?: Date | null;
  payload: unknown;
}

export interface RefundInput {
  providerPaymentId: string;
  amountCents: number;
  internalRefundId: string;
  reason: string;
  idempotencyKey: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: "pending" | "succeeded" | "failed";
}

export interface PaymentProvider {
  readonly name: ProviderName;
  readonly mode: PaymentMode;
  createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession>;
  retrieveSession(sessionId: string): Promise<SessionStatus | null>;
  /** Verifies the signature and timestamp, then normalizes. Throws WebhookVerificationError. */
  parseWebhook(rawBody: string, headers: Headers): NormalizedPaymentEvent;
  refund(input: RefundInput): Promise<RefundResult>;
  expireSession(sessionId: string): Promise<void>;
  /** Stop (true) or resume (false) future renewals. Never ends the current paid year early. */
  setCancelAtPeriodEnd(subscriptionId: string, cancel: boolean): Promise<void>;
  /** The processor's actual fee for a payment or invoice, when it can be read; null otherwise. */
  processingFeeCents(ref: { paymentIntentId?: string | null; invoiceId?: string | null }): Promise<number | null>;
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/** The processor definitively refused the refund (nothing was refunded). */
export class RefundRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RefundRejectedError";
  }
}

export class PaymentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}
