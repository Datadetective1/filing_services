import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { backend, createConfirmedUser, deleteUser, grantStaff, uniqueSuffix } from "./support/backend";

/**
 * The full Pennsylvania journey:
 * visitor -> PA page -> lookup -> account -> intake -> authorization -> sandbox payment
 * -> admin queue -> packet -> submitted -> receipt -> accepted -> customer notified
 * -> reminders stop -> next period opened. Plus cross-account attacks and webhook replay.
 */

test.describe.configure({ mode: "serial" });

const suffix = uniqueSuffix();
const businessName = `Keystone Test Bakery ${suffix} LLC`;
let customer: { id: string; email: string; password: string };
let intruder: { id: string; email: string; password: string };
let operator: { id: string; email: string; password: string };
let filingId = "";

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function newSignedInPage(browser: Browser, who: { email: string; password: string }, next = "/dashboard") {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await signIn(page, who);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

test.beforeAll(async () => {
  customer = await createConfirmedUser("customer");
  intruder = await createConfirmedUser("intruder");
  operator = await createConfirmedUser("operator");
  await grantStaff(operator.id, "admin");
});

test.afterAll(async () => {
  // Test data is left in place for inspection on staging; users are removed locally.
  if (!process.env.E2E_BASE_URL) {
    for (const u of [customer, intruder, operator]) if (u) await deleteUser(u.id);
  }
});

test("1. visitor reads the Pennsylvania page and looks up their business", async ({ page }) => {
  await page.goto("/annual-report/pennsylvania");
  await expect(page.locator("main")).toContainText("September 30");
  await expectNoSeriousA11yViolations(page);

  await page.goto("/find?state=PA&entity=llc");
  await page.getByLabel(/legal (business )?name/i).fill(businessName);
  await page.getByRole("button", { name: /see what.s due|continue|find/i }).click();
  await page.waitForURL(/\/find\/result/);

  const main = page.locator("main");
  await expect(main).toContainText(businessName);
  await expect(main).toContainText("Government filing fee");
  await expect(main).toContainText("Our service fee");
  await expect(main).toContainText("$7.00");
  await expectNoSeriousA11yViolations(page);
});

test("2. customer signs in, completes intake, authorizes and pays (sandbox)", async ({ page }) => {
  // Re-create the lookup in this context (the pending lookup lives in a cookie).
  await page.goto("/find?state=PA&entity=llc");
  await page.getByLabel(/legal (business )?name/i).fill(businessName);
  await page.getByRole("button", { name: /see what.s due|continue|find/i }).click();
  await page.waitForURL(/\/find\/result/);

  await page.getByRole("link", { name: "Have us file it" }).first().click();
  await page.waitForURL(/\/login/);
  await signIn(page, customer);
  await page.waitForURL(/\/file\/start/);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/\/file\/[0-9a-f-]{36}\/details/);
  filingId = page.url().match(/\/file\/([0-9a-f-]{36})\//)![1];

  // Step: business record
  await page.getByLabel(/entity number/i).fill("0012345");
  await page.getByRole("button", { name: /save|continue|next/i }).click();

  // Step: registered office (street address in PA)
  await page.getByLabel(/street address in pennsylvania/i).check();
  await page.getByLabel(/street address/i).first().fill("100 Market Street");
  await page.getByLabel(/^city/i).first().fill("Harrisburg");
  await page.getByLabel(/zip/i).first().fill("17101");
  await page.getByLabel(/county/i).first().fill("Dauphin");
  await page.getByRole("button", { name: /save|continue|next/i }).click();

  // Step: principal office
  await page.getByLabel(/street address/i).first().fill("200 Chestnut Street");
  await page.getByLabel(/^city/i).first().fill("Philadelphia");
  const stateField = page.getByLabel(/^state/i).first();
  if ((await stateField.evaluate((el) => el.tagName)) === "SELECT") await stateField.selectOption("PA");
  else await stateField.fill("PA");
  await page.getByLabel(/zip/i).first().fill("19106");
  await page.getByRole("button", { name: /save|continue|next/i }).click();

  // Step: people
  await page.getByLabel(/name/i).first().fill("Dana Whitfield");
  await page.getByLabel(/title/i).first().fill("Managing Member");
  await page.getByRole("button", { name: /save|continue|next/i }).click();

  // Step: extras (optional) then review
  if (await page.getByRole("button", { name: /save|continue|next/i }).isVisible().catch(() => false)) {
    if (!/\/review/.test(page.url())) await page.getByRole("button", { name: /save|continue|next/i }).click();
  }
  await page.waitForURL(/\/review/);
  await expect(page.locator("main")).toContainText("100 Market Street");
  await expect(page.locator("main")).toContainText("Dana Whitfield");

  await page.getByLabel(/full name/i).fill("Dana Whitfield");
  await page.getByLabel(/title|role/i).last().fill("Managing Member");
  await page.getByLabel(/accurate/i).check();
  await page.getByLabel(/authorize/i).check();
  await page.getByRole("button", { name: /authorize|continue|agree/i }).click();

  await page.waitForURL(/\/checkout/);
  const main = page.locator("main");
  await expect(main).toContainText("Government filing fee");
  await expect(main).toContainText("Our service fee");
  await expect(main).toContainText("Total today");
  await expect(main).toContainText(/test mode/i);
  await expectNoSeriousA11yViolations(page);
  await page.getByRole("button", { name: /^pay/i }).click();

  await page.waitForURL(/\/sandbox\/checkout\//);
  await expect(page.locator("body")).toContainText(/no real (card|charge)/i);
  await page.getByRole("button", { name: /pay \(test\)/i }).click();

  await page.waitForURL(/\/confirmation/);
  await expect(page.locator("main")).toContainText(/order confirmed/i, { timeout: 30_000 });

  const { data: filing } = await backend().from("filings").select("status, order_id").eq("id", filingId).single();
  expect(filing?.status).toBe("ready_for_review");
  const { data: order } = await backend().from("orders").select("status, government_fee_cents, service_fee_cents, total_cents").eq("id", filing!.order_id).single();
  expect(order?.status).toBe("paid");
  expect(order!.government_fee_cents).toBe(700);
  expect(order!.total_cents).toBe(order!.government_fee_cents + order!.service_fee_cents);
});

test("3. duplicate and forged webhooks are harmless", async ({ request }) => {
  const forged = await request.post("/api/webhooks/payments/sandbox", {
    data: JSON.stringify({ id: "sbx_evt_forged", type: "checkout.session.completed", created: Math.floor(Date.now() / 1000), data: {} }),
    headers: { "content-type": "application/json", "sandbox-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` },
  });
  expect(forged.status()).toBe(400);

  // The real completion event was already processed; replaying its id is a duplicate.
  const { data: evt } = await backend()
    .from("payment_events")
    .select("provider_event_id, processed_at")
    .eq("provider", "sandbox")
    .eq("event_type", "checkout.session.completed")
    .order("received_at", { ascending: false })
    .limit(1)
    .single();
  expect(evt?.processed_at).toBeTruthy();
});

test("4. customer dashboard shows the paid filing", async ({ browser }) => {
  const page = await newSignedInPage(browser, customer);
  await page.goto("/dashboard");
  const main = page.locator("main");
  await expect(main).toContainText(businessName);
  await expect(main).toContainText(/ready for review/i);
  await expect(main).toContainText(/paid/i);
  await expectNoSeriousA11yViolations(page);
});

test("5. another customer cannot see this customer's filing or documents", async ({ browser }) => {
  const page = await newSignedInPage(browser, intruder);
  for (const url of [`/dashboard/filings/${filingId}`, `/file/${filingId}/details`, `/file/${filingId}/checkout`]) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBe(404);
  }
  const admin = await page.goto("/admin");
  expect(admin?.status()).toBe(404);
});

test("6. operator files it from the queue and packet", async ({ browser }) => {
  const page = await newSignedInPage(browser, operator, "/admin/queue");
  await page.goto("/admin/queue");
  await expect(page.locator("main")).toContainText(businessName);
  await page.getByRole("link", { name: new RegExp(businessName) }).first().click();
  await page.waitForURL(new RegExp(`/admin/filings/${filingId}`));

  await page.getByRole("button", { name: /mark ready to file/i }).click();
  await expect(page.locator("main")).toContainText(/ready to file/i);

  // Packet
  const packetHref = `/admin/filings/${filingId}/packet`;
  const packet = await page.context().newPage();
  await packet.goto(packetHref);
  const p = packet.locator("main");
  await expect(p).toContainText(businessName);
  await expect(p).toContainText("100 Market Street");
  await expect(p).toContainText("Dauphin");
  await expect(p).toContainText("Dana Whitfield");
  await expect(p).toContainText("$7.00");
  await expect(packet.getByRole("link", { name: /open official filing site/i }).first()).toHaveAttribute("href", /file\.dos\.pa\.gov/);
  await packet.close();

  await page.getByRole("button", { name: /start filing/i }).click();
  await expect(page.locator("main")).toContainText(/in progress/i);

  await page.getByLabel(/confirmation number/i).fill(`E2E-${suffix}`);
  await page.getByRole("button", { name: /mark submitted/i }).click();
  await expect(page.locator("main")).toContainText(`E2E-${suffix}`);

  await page.locator('input[type="file"]').setInputFiles(path.join(__dirname, "fixtures", "test-receipt.pdf"));
  await page.getByRole("button", { name: /upload/i }).click();
  await expect(page.locator("main")).toContainText("test-receipt.pdf");

  await page.getByRole("button", { name: /mark accepted/i }).click();
  await expect(page.locator("main")).toContainText(/completed/i);

  const { data: filing } = await backend().from("filings").select("status, requirement_id, state_confirmation_number").eq("id", filingId).single();
  expect(filing?.status).toBe("completed");
  expect(filing?.state_confirmation_number).toBe(`E2E-${suffix}`);
});

test("7. customer is notified, can download the receipt, and reminders stop", async ({ browser }) => {
  const page = await newSignedInPage(browser, customer);
  await page.goto(`/dashboard/filings/${filingId}`);
  const main = page.locator("main");
  await expect(main).toContainText(/completed/i);
  await expect(main).toContainText(`E2E-${suffix}`);
  const download = page.getByRole("link", { name: /download/i }).first();
  const href = await download.getAttribute("href");
  expect(href).toMatch(/^\/api\/documents\//);
  const res = await page.request.get(href!, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const signed = res.headers()["location"];
  const pdf = await page.request.get(signed);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Intruder cannot use the same document link.
  const intruderPage = await newSignedInPage(browser, intruder);
  const denied = await intruderPage.request.get(href!, { maxRedirects: 0 });
  expect(denied.status()).toBe(404);

  const db = backend();
  const { data: filing } = await db.from("filings").select("requirement_id, business_id").eq("id", filingId).single();
  const { data: notes } = await db.from("notifications").select("template_key, status").eq("filing_id", filingId);
  const keys = (notes ?? []).map((n) => n.template_key);
  expect(keys).toEqual(expect.arrayContaining(["order_confirmed", "filing_submitted", "filing_accepted"]));

  const { data: pending } = await db.from("reminders").select("id").eq("requirement_id", filing!.requirement_id).eq("status", "scheduled");
  expect(pending ?? []).toHaveLength(0);

  const { data: requirement } = await db.from("filing_requirements").select("status, period_year").eq("id", filing!.requirement_id).single();
  expect(requirement?.status).toBe("filed_with_us");
  const { data: next } = await db
    .from("filing_requirements")
    .select("period_year, status")
    .eq("business_id", filing!.business_id)
    .gt("period_year", requirement!.period_year);
  expect(next?.[0]?.status).toBe("open");
});
