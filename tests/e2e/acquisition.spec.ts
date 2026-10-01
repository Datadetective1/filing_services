import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, uniqueSuffix } from "./support/backend";

/**
 * Organic funnel on staging: anonymous homepage search -> record -> free reminder opt-in
 * (explicit consent, double opt-in) -> confirm -> one-click unsubscribe -> suppression ->
 * explicit re-subscribe. Emails go to a reserved .test address and the staging outbox.
 */
const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Writes reminder subscriptions: staging only.");

/** Mirrors src/lib/security/tokens.ts (the deployment and this runner share APP_SIGNING_SECRET). */
function token(purpose: string, payload: Record<string, unknown>): string {
  const secret = process.env.APP_SIGNING_SECRET;
  if (!secret) throw new Error("APP_SIGNING_SECRET is required for this spec");
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(`${purpose}.${body}`).digest("base64url")}`;
}

test("anonymous lookup -> free reminders with consent -> confirm -> unsubscribe -> re-subscribe", async ({ browser }) => {
  test.setTimeout(180_000);
  const email = `optin.${uniqueSuffix()}@e2e.filewell.test`;
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  const main = page.locator("main");
  try {
    // Arrive from a Reddit post, search from the homepage hero (no account).
    await page.goto("/?utm_source=reddit&utm_medium=social&utm_campaign=e2e_optin");
    const cookie = (await ctx.cookies()).find((c) => c.name === "fw_attr");
    expect(cookie?.httpOnly).toBe(true);
    expect(decodeURIComponent(cookie!.value)).toContain('"s":"reddit"');
    await page.getByRole("textbox", { name: "Business name or Pennsylvania entity number" }).first().fill("7380992");
    await page.getByRole("button", { name: "Search", exact: true }).first().click();
    await page.getByRole("button", { name: /Daff Trucking LLC/ }).click({ timeout: 15_000 });
    await page.waitForURL(/\/find\/result/);
    await expect(main).toContainText("Pennsylvania record found");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("may be due");
    await expect(main).not.toContainText(/needs to file its/);

    // Consent is required and unticked by default.
    const consent = page.getByRole("checkbox", { name: /email me reminders/i });
    await expect(consent).not.toBeChecked();
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("button", { name: "Email me reminders" }).click();
    await expect(main).toContainText("Tick the box to confirm you want these reminders");
    let { data: none } = await backend().from("reminder_subscribers").select("id").eq("email", email);
    expect(none).toEqual([]);

    await consent.check();
    await page.getByRole("button", { name: "Email me reminders" }).click();
    await expect(main).toContainText("Check your inbox to confirm");
    await page.screenshot({ path: "test-results/reminder-optin-desktop.png", fullPage: true });

    const { data: sub } = await backend().from("reminder_subscribers").select("*").eq("email", email).single();
    expect(sub).toMatchObject({ status: "pending", state_code: "PA", entity_type: "llc", entity_number: "0007380992", legal_name: "Daff Trucking LLC" });
    expect(sub!.consent_text).toMatch(/up to three reminders a year/);
    expect(sub!.attribution).toMatchObject({ ft: { s: "reddit", c: "e2e_optin" } });

    // Opening the confirmation link changes nothing; the button confirms.
    const confirmUrl = `/reminders/confirm?t=${encodeURIComponent(token("rem-confirm", { s: sub!.id, c: new Date(sub!.consent_at).getTime() }))}`;
    const res = await page.goto(confirmUrl);
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
    expect((await backend().from("reminder_subscribers").select("status").eq("id", sub!.id).single()).data?.status).toBe("pending");
    await page.getByRole("button", { name: "Yes, send me reminders" }).click();
    await expect(main).toContainText("Reminders confirmed");
    expect((await backend().from("reminder_subscribers").select("status").eq("id", sub!.id).single()).data?.status).toBe("confirmed");
    const { data: planned } = await backend().from("subscriber_reminders").select("offset_days, due_date, status").eq("subscriber_id", sub!.id);
    expect(planned?.length).toBe(3);
    expect(planned!.every((r) => r.status === "scheduled")).toBe(true);

    // A forged confirmation link does nothing.
    await page.goto("/reminders/confirm?t=bogus.token");
    await page.getByRole("button", { name: "Yes, send me reminders" }).click();
    await expect(main).toContainText("This link isn't valid");

    // One-click unsubscribe: page needs a click; the RFC 8058 endpoint works by POST.
    const unsub = token("rem-unsub", { e: email });
    await page.goto(`/reminders/unsubscribe?t=${encodeURIComponent(unsub)}`);
    await page.getByRole("button", { name: "Unsubscribe" }).click();
    await expect(main).toContainText("You're unsubscribed");
    expect((await backend().from("reminder_subscribers").select("status").eq("id", sub!.id).single()).data?.status).toBe("unsubscribed");
    expect((await backend().from("reminder_suppressions").select("reason").eq("email", email).single()).data?.reason).toBe("unsubscribe");
    const { data: after } = await backend().from("subscriber_reminders").select("status, skip_reason").eq("subscriber_id", sub!.id);
    expect(after!.every((r) => r.status === "skipped" && r.skip_reason === "unsubscribed")).toBe(true);
    expect((await page.request.post(`/api/reminders/unsubscribe?t=${encodeURIComponent(unsub)}`)).status()).toBe(200);
    expect((await page.request.post("/api/reminders/unsubscribe?t=bogus")).status()).toBe(400);

    // An explicit re-subscribe: new consent, confirmed again, lifts the suppression.
    await backend().from("reminder_subscribers").update({ confirmation_sent_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", sub!.id);
    await page.goto("/find/result");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByRole("checkbox", { name: /email me reminders/i }).check();
    await page.getByRole("button", { name: "Email me reminders" }).click();
    await expect(main).toContainText("Check your inbox to confirm");
    const { data: again } = await backend().from("reminder_subscribers").select("status, consent_at").eq("id", sub!.id).single();
    expect(again?.status).toBe("pending");
    expect((await backend().from("reminder_suppressions").select("email").eq("email", email)).data?.length).toBe(1);
    // The old confirmation link no longer works (it was bound to the earlier consent).
    await page.goto(confirmUrl);
    await page.getByRole("button", { name: "Yes, send me reminders" }).click();
    await expect(main).toContainText("This link isn't valid");
    await page.goto(`/reminders/confirm?t=${encodeURIComponent(token("rem-confirm", { s: sub!.id, c: new Date(again!.consent_at).getTime() }))}`);
    await page.getByRole("button", { name: "Yes, send me reminders" }).click();
    await expect(main).toContainText("Reminders confirmed");
    expect((await backend().from("reminder_suppressions").select("email").eq("email", email)).data?.length).toBe(0);

    // Funnel events carry the source.
    const { data: events } = await backend()
      .from("analytics_events")
      .select("event_name, properties")
      .in("event_name", ["reminder_opt_in", "reminder_confirmed", "reminder_unsubscribed"])
      .eq("properties->>ft_campaign", "e2e_optin");
    const names = new Set((events ?? []).map((e) => e.event_name));
    expect([...names].sort()).toEqual(["reminder_confirmed", "reminder_opt_in", "reminder_unsubscribed"]);
    ({ data: none } = await backend().from("reminder_subscribers").select("id").eq("email", email).neq("id", sub!.id));
    expect(none).toEqual([]);
  } finally {
    await ctx.close();
  }
});

test("reminder links restore the business and count as a reminder visit", async ({ browser }) => {
  const email = `link.${uniqueSuffix()}@e2e.filewell.test`;
  const { data: sub } = await backend()
    .from("reminder_subscribers")
    .insert({ email, state_code: "PA", entity_type: "llc", legal_name: "Daff Trucking LLC", entity_number: "0007380992", status: "confirmed", consent_text: "E2E fixture consent text." })
    .select("id")
    .single();
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  try {
    await page.goto(`/rs/${encodeURIComponent(token("rem-link", { s: sub!.id }))}`);
    await page.waitForURL(/\/find\/result\?utm_source=reminder/);
    await expect(page.locator("main")).toContainText("Pennsylvania record found");
    const cookie = (await ctx.cookies()).find((c) => c.name === "fw_attr");
    expect(decodeURIComponent(cookie!.value)).toContain('"s":"reminder"');
    // A forged link falls back to the normal lookup.
    await page.goto("/rs/forged.token");
    await page.waitForURL(/\/find\?utm_source=reminder/);
  } finally {
    await ctx.close();
  }
});
