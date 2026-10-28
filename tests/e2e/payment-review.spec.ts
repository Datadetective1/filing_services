import { expect, test, type Browser } from "@playwright/test";
import { isProductionHost, isProductionSupabaseUrl } from "../../src/config/environments";
import { STORAGE_STATE } from "./global-setup";
import { backend, createConfirmedUser, deleteUser, grantStaff, uniqueSuffix } from "./support/backend";

/**
 * "Mark reviewed" on /admin/payments: an operator gets no control; an admin clears a
 * flagged (sandbox) payment with a note, and it leaves "Payments requiring review".
 * The flagged payment is created directly with the service role. Never production.
 */

const productionTarget = isProductionHost(process.env.E2E_BASE_URL) || isProductionSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
test.skip(productionTarget, "Creates users, grants admin and writes payment rows: staging or local only.");

test.describe.configure({ mode: "serial", timeout: 180_000 });

const suffix = uniqueSuffix();
const reason = `e2e ${suffix}: duplicate payment for an order that was already paid - refund it`;
let customer: { id: string; email: string; password: string };
let admin: { id: string; email: string; password: string };
let operator: { id: string; email: string; password: string };
let paymentId = "";

/**
 * Sign-in is throttled to 10 attempts per IP per minute, and the specs before this one sign
 * in several times. If the throttle answers, wait out its one-minute window once and retry.
 */
async function signedIn(browser: Browser, who: { email: string; password: string }) {
  const ctx = await browser.newContext({ storageState: STORAGE_STATE });
  const page = await ctx.newPage();
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/login?next=/admin/payments");
    await page.getByLabel("Email").fill(who.email);
    await page.getByLabel("Password", { exact: true }).fill(who.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    const throttled = page.getByText("Too many attempts. Please wait a minute and try again.");
    await Promise.race([page.waitForURL((u) => u.pathname === "/admin/payments"), throttled.waitFor()]);
    if (new URL(page.url()).pathname === "/admin/payments") return page;
    await page.waitForTimeout(61_000);
  }
  throw new Error("Sign-in was still throttled after waiting a minute.");
}

test.beforeAll(async () => {
  if (productionTarget) return;
  customer = await createConfirmedUser("customer-review");
  admin = await createConfirmedUser("admin-review");
  operator = await createConfirmedUser("operator-review");
  await grantStaff(admin.id, "admin");
  await grantStaff(operator.id, "operator");
  const db = backend();
  const { data: business, error: bErr } = await db
    .from("businesses")
    .insert({ owner_user_id: customer.id, legal_name: `Review Test ${suffix} LLC`, state_code: "PA", entity_type: "llc" })
    .select("id")
    .single();
  if (bErr) throw new Error(bErr.message);
  const { data: order, error: oErr } = await db
    .from("orders")
    .insert({ user_id: customer.id, business_id: business!.id, government_fee_cents: 700, service_fee_cents: 4900, total_cents: 5600, pricing_snapshot: {}, payment_mode: "sandbox" })
    .select("id")
    .single();
  if (oErr) throw new Error(oErr.message);
  const { data: payment, error: pErr } = await db
    .from("payments")
    .insert({ order_id: order!.id, user_id: customer.id, provider: "sandbox", mode: "sandbox", amount_cents: 5600, status: "succeeded", requires_review: true, review_reason: reason })
    .select("id")
    .single();
  if (pErr) throw new Error(pErr.message);
  paymentId = payment!.id as string;
});

test.afterAll(async () => {
  if (productionTarget) return;
  for (const u of [admin, operator]) {
    if (u) await backend().from("staff_members").update({ active: false }).eq("user_id", u.id);
  }
  // The payment row keeps the customer referenced, so users stay on staging; locally they go.
  if (!process.env.E2E_BASE_URL) for (const u of [admin, operator]) if (u) await deleteUser(u.id);
});

const reviewRow = (page: import("@playwright/test").Page) => page.locator("#review tr", { hasText: reason });

test("an operator sees the flagged payment but no Mark reviewed control", async ({ browser }) => {
  const page = await signedIn(browser, operator);
  await expect(reviewRow(page)).toBeVisible();
  await expect(page.locator("#review summary", { hasText: "Mark reviewed" })).toHaveCount(0);
  await page.context().close();
});

test("an admin marks it reviewed with a note; it leaves the list and the audit log has the note", async ({ browser }) => {
  const page = await signedIn(browser, admin);
  const row = reviewRow(page);
  await expect(row).toBeVisible();
  await row.locator("summary", { hasText: "Mark reviewed" }).click();
  // The confirmation box is required before anything is sent.
  await row.getByRole("textbox", { name: "What you checked" }).fill(`E2E ${suffix}: checked in the sandbox, nothing to refund.`);
  await row.getByRole("checkbox", { name: /I checked this payment in Stripe/ }).check();
  await row.getByRole("button", { name: "Mark reviewed" }).click();

  await expect(reviewRow(page)).toHaveCount(0, { timeout: 15_000 });
  const { data: p } = await backend().from("payments").select("requires_review, review_reason, status, amount_cents").eq("id", paymentId).single();
  expect(p).toEqual({ requires_review: false, review_reason: reason, status: "succeeded", amount_cents: 5600 });
  const { data: audit } = await backend().from("audit_logs").select("actor_user_id, metadata").eq("action", "payment.review_cleared").eq("entity_id", paymentId);
  expect(audit).toHaveLength(1);
  expect(audit![0].actor_user_id).toBe(admin.id);
  expect((audit![0].metadata as { note: string }).note).toBe(`E2E ${suffix}: checked in the sandbox, nothing to refund.`);
  await page.context().close();
});
