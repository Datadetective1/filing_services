export type PaymentMode = "sandbox" | "test" | "live";
export type ProviderName = "stripe" | "sandbox";

export interface CheckoutLineItem {
  kind: "government_fee" | "service_fee";
  name: string;
  amountCents: number;
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
}

export type NormalizedEventType =
  | "checkout.completed"
  | "payment.failed"
  | "checkout.expired"
  | "refund.succeeded"
  | "refund.failed"
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
