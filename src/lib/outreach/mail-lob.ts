import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLobPostcard, lobFromAddress, lobMode, mailBlockers, MailBlockedError } from "./lob";
import { loadCohort } from "./mail-cohort";
import { postcardForRow } from "./mail-service";
import { postcardBackHtml, postcardFrontHtml } from "./postcard";

/** Current Lob readiness for the admin page (no network call). */
export function lobStatus(campaignApproved: boolean) {
  const mode = lobMode(process.env.LOB_API_KEY);
  return {
    mode,
    from: lobFromAddress(),
    blockers: mailBlockers({ mode, vendor: process.env.MAIL_VENDOR, sendsEnabled: process.env.MAIL_SENDS_ENABLED, campaignApproved, hasFromAddress: Boolean(lobFromAddress()) }),
    liveBlockers: mailBlockers({ mode: "live", vendor: process.env.MAIL_VENDOR, sendsEnabled: process.env.MAIL_SENDS_ENABLED, campaignApproved, hasFromAddress: Boolean(lobFromAddress()) }),
  };
}

/**
 * Create the cohort's postcards in Lob TEST mode (rendered proofs, never printed or mailed).
 * Refuses outright unless the configured key is a test key; live creation is not exposed.
 */
export async function createTestPostcards(campaignId: string, campaign: { status: string }): Promise<{ created: number; skipped: number }> {
  const key = process.env.LOB_API_KEY ?? "";
  if (lobMode(key) !== "test") throw new MailBlockedError(["Only a Lob test key (test_...) may be used from Filewell today"]);
  const from = lobFromAddress();
  if (!from) throw new MailBlockedError(["No return address configured (MAIL_FROM_*)"]);
  const rows = (await loadCohort(campaignId)).filter((r) => r.selected && r.landingUrl && r.address?.line1);
  const db = createAdminClient();
  let created = 0;
  let skipped = 0;
  for (const r of rows) {
    if (r.vendorId && r.vendorTest) {
      skipped++;
      continue;
    }
    const copy = postcardForRow(r);
    const a = r.address!;
    const piece = await createLobPostcard(
      key,
      {
        idempotencyKey: `test-${r.sendId}`,
        description: `Filewell PA Dec 31 pilot ${campaignId.slice(0, 8)} (test)`,
        to: {
          company: r.businessName,
          address_line1: a.line1 ?? "",
          address_line2: a.line2 || undefined,
          address_city: a.city ?? "",
          address_state: (a.region ?? "").toUpperCase(),
          address_zip: (a.postal_code ?? "").replace(/[^\d-]/g, "").replace(/-0*$/, ""),
          address_country: "US",
        },
        from,
        front: postcardFrontHtml(copy),
        back: postcardBackHtml(copy, `${r.landingUrl}/qr.png`),
        metadata: { campaign: campaignId.slice(0, 8), send: r.sendId.slice(0, 36) },
      },
      { campaignApproved: campaign.status === "approved" },
    );
    await db.from("marketing_sends").update({ provider: "lob", provider_message_id: piece.id, vendor_status: "test_created", vendor_test: true }).eq("id", r.sendId);
    created++;
  }
  return { created, skipped };
}
