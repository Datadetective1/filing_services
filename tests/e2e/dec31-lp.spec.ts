import { expect, test, type Browser, type Page } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, createConfirmedUser, deleteUser, grantStaff, uniqueSuffix } from "./support/backend";

/**
 * A Pennsylvania limited partnership (annual report due December 31), modeled on
 * journey.spec.ts: lookup -> account -> intake -> authorization -> sandbox payment ->
 * the operator queue. Sandbox payments only; never production.
 */

const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Never run the journey against production (www.getfilewell.com, getfilewell.com, filewell.vercel.app).");

test.describe.configure({ mode: "serial" });

const suffix = uniqueSuffix();
const businessName = `Keystone Test Partners ${suffix} LP`;
let customer: { id: string; email: string; password: string };
let operator: { id: string; email: string; password: string };
let filingId = "";

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function newSignedInPage(browser: Browser, who: { email: string; password: string }, next = "/dashboard") {
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await signIn(page, who);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  return page;
}

test.beforeAll(async () => {
  if (productionTarget) return;
  customer = await createConfirmedUser("customer-lp");
  operator = await createConfirmedUser("operator-lp");
  await grantStaff(operator.id, "admin");
});

test.afterAll(async () => {
  if (productionTarget) return;
  // The test operator never keeps admin rights after the run, locally or on staging.
  if (operator) {
    await backend().from("staff_members").update({ active: false }).eq("user_id", operator.id);
    await backend()
      .from("audit_logs")
      .insert({ actor_type: "system", action: "staff.revoked", entity_type: "staff_member", entity_id: operator.id, metadata: { reason: "e2e LP journey finished" } });
  }
  if (!process.env.E2E_BASE_URL) {
    for (const u of [customer, operator]) if (u) await deleteUser(u.id);
  }
});

async function lookUp(page: Page) {
  await page.goto("/find?state=PA&entity=lp");
  await page.getByLabel("Legal business name").fill(businessName);
  await page.getByRole("button", { name: /see what.s due/i }).click();
  await page.waitForURL(/\/find\/result/);
}

const tb = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });
const saveStep = (page: Page) => page.getByRole("button", { name: "Save and continue" }).click();

test("1. a limited partnership sees its December 31 deadline and the fees", async ({ page }) => {
  await lookUp(page);
  const main = page.locator("main");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(businessName);
  await expect(main).toContainText("December 31");
  await expect(main).toContainText("Government filing fee");
  await expect(main).toContainText("Our service fee");
  await expect(main).toContainText("$7.00");
  await expect(page.getByRole("link", { name: "Have us file it" })).toBeVisible();
});

test("2. the customer completes intake, authorizes and pays (sandbox)", async ({ page }) => {
  await lookUp(page);
  await page.goto("/login?next=/file/start");
  await signIn(page, customer);
  await page.waitForURL((u) => u.pathname === "/file/start");
  await expect(page.locator("main")).toContainText(businessName);
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForURL(/\/file\/[0-9a-f-]{36}\/details/);
  filingId = page.url().match(/\/file\/([0-9a-f-]{36})\//)![1];

  await expect(tb(page, "Legal name")).toHaveValue(businessName);
  await page.getByLabel(/entity number/i).fill("0054321");
  await saveStep(page);
  await page.waitForURL(/step=registered_office/);

  await tb(page, "Street address").fill("300 Front Street");
  await tb(page, "City").fill("Harrisburg");
  await tb(page, "ZIP code").fill("17101");
  await tb(page, "County").fill("Dauphin");
  await saveStep(page);
  await page.waitForURL(/step=principal_office/);

  await tb(page, "Street address").fill("400 Walnut Street");
  await tb(page, "City").fill("Philadelphia");
  await page.getByRole("combobox", { name: "State" }).selectOption("PA");
  await tb(page, "ZIP code").fill("19106");
  await saveStep(page);
  await page.waitForURL(/step=people/);

  // A limited partnership lists its general partners.
  await expect(page.locator("main")).toContainText("General partners");
  await page.getByRole("textbox", { name: /Full name.*person 1/ }).first().fill("Riley Morgan");
  await page.getByRole("combobox", { name: /Title.*person 1/ }).first().fill("General Partner");
  await saveStep(page);
  await page.waitForURL(/step=extras/);
  await page.getByRole("button", { name: "Save and review" }).click();

  await page.waitForURL(/\/review/);
  await expect(page.locator("main")).toContainText("300 Front Street");
  await expect(page.locator("main")).toContainText("Riley Morgan");
  await page.getByRole("textbox", { name: "Your full name" }).fill("Riley Morgan");
  await page.getByRole("combobox", { name: "Your title or role" }).fill("General Partner");
  await page.getByRole("checkbox", { name: /accurate and complete/i }).check();
  await page.getByRole("checkbox", { name: /authorize/i }).check();
  await page.getByRole("button", { name: "Sign and continue" }).click();

  await page.waitForURL(/\/checkout/);
  const main = page.locator("main");
  await expect(main).toContainText("Government filing fee");
  await expect(main).toContainText("Our service fee");
  await expect(main).toContainText("$56.00");
  await expect(main).toContainText(/test mode|no real/i);
  await page.getByRole("button", { name: /^pay \$/i }).click();

  await page.waitForURL(/\/sandbox\/checkout\//);
  await expect(page.locator("body")).toContainText(/no real (card|charge)/i);
  await page.getByRole("button", { name: /pay \(test\)/i }).click();

  await page.waitForURL(/\/confirmation/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/order confirmed/i, { timeout: 30_000 });

  const { data: filing } = await backend().from("filings").select("status, order_id, due_date, business_id, rule_version_id").eq("id", filingId).single();
  expect(filing?.status).toBe("ready_for_review");
  expect(filing?.due_date).toMatch(/-12-31$/);
  const { data: business } = await backend().from("businesses").select("entity_type").eq("id", filing!.business_id).single();
  expect(business?.entity_type).toBe("lp");
  const { data: version } = await backend().from("state_rule_versions").select("rule_id").eq("id", filing!.rule_version_id).single();
  const { data: ruleRow } = await backend().from("compliance_rules").select("rule_key").eq("id", version!.rule_id).single();
  expect(ruleRow?.rule_key).toBe("PA:annual_report:lp");
  const { data: order } = await backend().from("orders").select("status, government_fee_cents, service_fee_cents, total_cents, payment_mode").eq("id", filing!.order_id).single();
  expect(order).toMatchObject({ status: "paid", government_fee_cents: 700, service_fee_cents: 4900, total_cents: 5600, payment_mode: "sandbox" });
});

test("3. the paid LP filing reaches the operator queue", async ({ browser }) => {
  const page = await newSignedInPage(browser, operator, "/admin/queue");
  await page.goto("/admin/queue");
  await expect(page.locator("main")).toContainText(businessName);
  await page.goto(`/admin/filings/${filingId}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(businessName);
  await expect(page.locator('section[aria-labelledby="actions-title"]')).toContainText("Review the details, then click Mark ready to file");
  await expect(page.locator("main")).toContainText(/TEST: no money collected/);
});
