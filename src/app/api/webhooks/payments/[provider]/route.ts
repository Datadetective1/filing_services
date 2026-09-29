import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { processPaymentEvent } from "@/lib/payments/process-event";
import { PaymentConfigurationError, type PaymentProvider, WebhookVerificationError } from "@/lib/payments/types";

export const dynamic = "force-dynamic";

/**
 * Payment webhooks. The raw body is verified (signature + timestamp) by the active
 * provider before anything is parsed or trusted. Processing is idempotent, so
 * provider retries and duplicate deliveries are safe; a 5xx asks the provider to retry.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/webhooks/payments/[provider]">) {
  const { provider: name } = await ctx.params;
  if (name !== "stripe" && name !== "sandbox") return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  let provider: PaymentProvider;
  try {
    provider = getPaymentProvider();
  } catch (e) {
    // Payments are switched off or misconfigured here (for example test payments on
    // the production deployment). 503 tells the processor to retry later.
    if (e instanceof PaymentConfigurationError) {
      console.error("[payments] webhook received while payments are not configured");
      return NextResponse.json({ error: "payments not configured" }, { status: 503 });
    }
    throw e;
  }
  if (provider.name !== name) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const raw = await request.text();
  if (raw.length > 512 * 1024) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  let event;
  try {
    event = provider.parseWebhook(raw, request.headers);
  } catch (e) {
    if (e instanceof WebhookVerificationError) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    throw e;
  }

  try {
    const outcome = await processPaymentEvent(event);
    return NextResponse.json({ received: true, outcome: outcome.status });
  } catch {
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
