import { expect, test } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, createConfirmedUser, grantStaff, uniqueSuffix } from "./support/backend";

/**
 * 100-card PA December 31 pilot on staging: import, save the cohort, review the dashboard
 * and the 4x6 artwork, follow one card's URL into the prefilled flow, and see the funnel
 * count it. Nothing is purchased or mailed (no Lob key on staging; live mailing is off).
 */
const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Grants admin and writes outreach data: staging only.");

test("pilot: cohort, dashboard, artwork, card URL -> record found -> prefilled draft -> funnel", async ({ browser }) => {
  test.setTimeout(180_000);
  const admin = await createConfirmedUser("mail-admin");
  await grantStaff(admin.id, "admin");
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  try {
    await page.goto("/login?next=/admin/outreach");
    await page.getByLabel("Email").fill(admin.email);
    await page.getByLabel("Password", { exact: true }).fill(admin.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin\/outreach/);
    const main = page.locator("main");

    await page.locator("#i-grp").selectOption("other");
    await page.getByLabel("County (optional)").fill("Allegheny");
    await page.getByLabel("How many (max 500)").fill("200");
    await page.getByRole("button", { name: "Import" }).click();
    await expect(main).toContainText(/Imported \d+ businesses/, { timeout: 45_000 });

    const name = `E2E 100-card pilot ${uniqueSuffix()}`;
    await page.locator("#m-name").fill(name);
    await page.getByRole("button", { name: "Create postcard pilot" }).click();
    await expect(main).toContainText("Postcard pilot created");
    await page.reload();
    await page.getByRole("link", { name }).click();
    await page.waitForURL(/\/admin\/outreach\/[0-9a-f-]{36}$/);
    const campaignUrl = page.url();

    await page.getByRole("button", { name: "Save a 100-business cohort" }).click();
    await expect(main).toContainText(/Cohort saved: \d+ selected/, { timeout: 30_000 });
    await page.reload();

    await expect(main).toContainText("Mailing is switched off");
    await expect(main).toContainText("MAIL_SENDS_ENABLED is not true");
    for (const label of ["Visits", "Record viewed", "Filing started", "Checkout started", "Paid orders", "Acquisition cost", "Service-fee revenue", "Estimated mailing cost", "Contribution after Stripe and mail", "Break-even paid orders"]) {
      await expect(main.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(main).not.toContainText(/\b(Active|compliant|outstanding|Not filed|unfiled|delinquent)\b/);
    await expect(page.frameLocator('iframe[title="Card front"]').locator("body")).toContainText("THIS IS A SOLICITATION. NOT A BILL. NOT A GOVERNMENT DOCUMENT.");
    await expect(page.frameLocator('iframe[title="Card back"]').locator("body")).toContainText("instead of using Filewell");
    await expect(page.frameLocator('iframe[title="Card back"]').locator("img")).toHaveJSProperty("complete", true);
    await page.screenshot({ path: "test-results/pilot-dashboard-desktop.png", fullPage: true });

    // Artwork for the first selected card, and its QR image.
    const front = await page.request.get(`${campaignUrl}/card?side=front`);
    expect(front.status()).toBe(200);
    const frontHtml = await front.text();
    expect(frontHtml).toContain("THIS IS A SOLICITATION. NOT A BILL. NOT A GOVERNMENT DOCUMENT.");
    expect(frontHtml).toContain("instead of using Filewell");
    const backHtml = await (await page.request.get(`${campaignUrl}/card?side=back`)).text();
    const qr = /src="(https:\/\/[^"]+\/qr\.png)"/.exec(backHtml)![1];
    const qrRes = await page.request.get(new URL(new URL(qr).pathname, campaignUrl).toString());
    expect(qrRes.status()).toBe(200);
    expect(qrRes.headers()["content-type"]).toBe("image/png");

    // Follow that card's URL like a recipient would (same browser, signed in as the test user).
    const landingPath = new URL(qr).pathname.replace(/\/qr\.png$/, "");
    await page.goto(landingPath);
    await page.waitForURL(/\/find\/result/);
    await expect(main).toContainText("Pennsylvania record found");
    await page.goto("/file/start");
    await page.getByRole("button", { name: /continue/i }).click();
    await page.waitForURL(/\/file\/[0-9a-f-]{36}\/details/);
    await expect(page.getByRole("heading", { name: "Pennsylvania record found" })).toBeVisible();
    await expect(main).toContainText("Has anything changed?");
    await expect(main).toContainText("From Pennsylvania's business register");

    // The funnel counted the visit, the record view and the filing start.
    await page.goto(campaignUrl);
    const stat = (label: string) => main.locator("div", { has: page.getByText(label, { exact: true }) }).first();
    await expect(stat("Visits")).toContainText("1");
    await expect(stat("Filing started")).toContainText("1");
    await page.screenshot({ path: "test-results/pilot-dashboard-after-visit.png", fullPage: true });

    const csv = await page.request.get(`${campaignUrl}/export`);
    const lines = (await csv.text()).trim().split("\r\n");
    expect(lines[0]).toContain("selected,exclusion_reason,business_name,entity_number");
    expect(lines.filter((l) => l.startsWith('"yes"')).length).toBeGreaterThan(0);

    // A forged code falls back to the normal lookup and gets no QR.
    await page.goto("/m/00000000-123-AAAAAAAAAA");
    await page.waitForURL(/\/find\?state=PA/);
    expect((await page.request.get(new URL("/m/00000000-123-AAAAAAAAAA/qr.png", campaignUrl).toString())).status()).toBe(404);
  } finally {
    await backend().from("staff_members").update({ active: false }).eq("user_id", admin.id);
    await ctx.close();
  }
});
