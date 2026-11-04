import { NextResponse, type NextRequest } from "next/server";
import { recordProviderDocumentAlert } from "@/lib/registered-agent/document-events";
import { parseRaiDocumentAlert, RaiIgnoredEvent, RaiWebhookError, raiWebhookSecret } from "@/lib/registered-agent/rai-webhook";

export const dynamic = "force-dynamic";

/**
 * Registered Agents Inc. callbacks. The signed token is verified with our API secret before
 * anything in it is read. Only new-document events are recorded; other signed events
 * (invoices) are acknowledged and dropped. Recording is idempotent on the partner's document
 * ID, so retries and replays are safe; a 5xx asks the partner to try again later.
 */
export async function POST(request: NextRequest) {
  const secret = raiWebhookSecret();
  if (!secret) {
    console.error("[ra alerts] alert received but RAI_API_SECRET is not set");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const raw = await request.text();
  if (raw.length > 64 * 1024) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  let event;
  try {
    event = parseRaiDocumentAlert(raw, request.headers, secret);
  } catch (e) {
    if (e instanceof RaiIgnoredEvent) {
      // Signed and valid, just not a document (the same URL gets invoice events too).
      return NextResponse.json({ received: true, ignored: e.eventName });
    }
    if (e instanceof RaiWebhookError) {
      console.warn("[ra alerts] rejected alert:", e.message);
      return NextResponse.json({ error: "invalid alert" }, { status: 401 });
    }
    throw e;
  }

  try {
    const outcome = await recordProviderDocumentAlert(event);
    return NextResponse.json({ received: true, outcome });
  } catch (e) {
    console.error("[ra alerts] processing failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
