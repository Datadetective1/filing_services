import { expect, test } from "@playwright/test";

const DISCLAIMER = "Not affiliated with or endorsed by any government agency";

const GUIDES = [
  ["annual-report-deadline", "Pennsylvania annual report deadline"],
  ["annual-report-fee", "Pennsylvania annual report fee"],
  ["how-to-file-annual-report", "How to file a Pennsylvania annual report"],
  ["annual-report-after-deadline", "Filing a Pennsylvania annual report after the deadline"],
  ["business-search", "Pennsylvania business search"],
] as const;

test.describe("public pages", () => {
  // Keep test traffic out of the first-party visitor counts (server-side lookups still count).
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/analytics", (r) => r.fulfill({ status: 204 }));
  });

  test("homepage communicates the value and the disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Never miss a business filing");
    await expect(page.getByRole("link", { name: "Find my business" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse filing requirements" }).first()).toBeVisible();
    // The register search is right in the hero: no extra click, no account.
    await expect(page.getByRole("textbox", { name: "Business name or Pennsylvania entity number" }).first()).toBeVisible();
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
    // No horizontal overflow on any viewport.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("Pennsylvania register search finds a business and labels the source", async ({ page }) => {
    await page.goto("/find");
    await page.getByRole("textbox", { name: "Business name or Pennsylvania entity number" }).fill("7380992");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const result = page.getByRole("button", { name: /Daff Trucking LLC/ });
    await expect(result).toBeVisible({ timeout: 15_000 });
    await expect(result).toContainText("Entity #0007380992");
    await expect(page.locator("main")).toContainText("not affiliated with the Department of State");
    await result.click();
    await page.waitForURL(/\/find\/result/);
    await expect(page.locator("main")).toContainText("Pennsylvania record found");
    await expect(page.locator("main")).toContainText("$7.00");
    // Never states filing status as fact.
    await expect(page.getByRole("heading", { level: 1 })).toContainText("may be due");
    // Free reminders: consent box unticked; submitting without it is refused before anything is saved.
    const consent = page.getByRole("checkbox", { name: /email me reminders/i });
    await expect(consent).not.toBeChecked();
    await page.getByLabel("Email", { exact: true }).fill("someone@example.com");
    await page.getByRole("button", { name: "Email me reminders" }).click();
    await expect(page.locator("main")).toContainText("Tick the box to confirm you want these reminders");
  });

  for (const [slug, h1] of GUIDES) {
    test(`guide: ${slug}`, async ({ page }) => {
      const res = await page.goto(`/pennsylvania/${slug}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
      const main = page.locator("main");
      await expect(main).toContainText("Checked against official Pennsylvania sources on");
      await expect(main).toContainText("private filing service");
      await expect(main).toContainText("You don't need a filing service");
      await expect(main).toContainText("Our service fee");
      await expect(page.locator('main a[href^="https://www.pa.gov/"]').first()).toBeAttached();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/pennsylvania/${slug}$`));
      await expect(page.getByRole("textbox", { name: "Business name or Pennsylvania entity number" }).first()).toBeVisible();
      const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
      expect(jsonLd).toContain('"Article"');
      expect(jsonLd).toContain("FAQPage");
      expect(jsonLd).not.toContain("GovernmentService");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  for (const [path, h1, agency] of [
    ["/annual-report/washington", "Washington", "Washington Secretary of State"],
    ["/annual-report/nevada", "Nevada", "Nevada"],
    ["/annual-report/utah", "Utah", "Utah"],
    ["/washington/annual-report-fee", "Washington annual report fee", "sos.wa.gov"],
    ["/nevada/annual-list-fee", "Nevada annual list and business license fees", "leg.state.nv.us"],
    ["/utah/annual-renewal-fee", "Utah annual renewal fee", "commerce.utah.gov"],
  ] as const) {
    test(`expansion state page: ${path}`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(h1);
      const main = page.locator("main");
      await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
      // Official sources: the agency named in the text (hubs) or linked (guides).
      if (agency.includes(".")) await expect(page.locator(`main a[href*="${agency}"]`).first()).toBeAttached();
      else await expect(main).toContainText(agency);
      // Production doesn't sell filing in these states: never offered as if it did.
      if (process.env.E2E_TARGET_IS_PRODUCTION === "true") await expect(main).not.toContainText("Have us file it");
      await expect(main).not.toContainText("January 1");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("attribution: first touch kept, last touch follows the latest source", async ({ page, context }) => {
    await context.clearCookies({ name: "fw_attr" });
    await page.goto("/pricing?utm_source=e2e_check&utm_campaign=public_smoke");
    const read = async () => JSON.parse(decodeURIComponent((await context.cookies()).find((c) => c.name === "fw_attr")!.value));
    const first = await read();
    expect(first.ft).toMatchObject({ s: "other", c: "public_smoke", lp: "/pricing" });
    await page.goto("/help", { referer: "https://www.google.com/" });
    const second = await read();
    expect(second.ft.c).toBe("public_smoke");
    expect(second.lt).toMatchObject({ s: "google", m: "organic" });
    await page.getByRole("link", { name: "Pricing" }).first().click();
    expect((await read()).lt.s).toBe("google");
  });

  test("private and signed URLs are never indexable", async ({ request }) => {
    for (const path of ["/find/result", "/reminders/confirm?t=x", "/reminders/unsubscribe?t=x", "/outreach/unsubscribe?t=x"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.headers()["x-robots-tag"] ?? "", path).toContain("noindex");
    }
    const m = await request.get("/m/00000000-123-AAAAAAAAAA", { maxRedirects: 0 });
    expect(m.headers()["x-robots-tag"] ?? "").toContain("noindex");
    const robots = await (await request.get("/robots.txt")).text();
    if (!/^Disallow: \/$/m.test(robots)) {
      for (const p of ["/admin", "/dashboard", "/file", "/api/", "/m/", "/rs/", "/r/", "/reminders/", "/find/result"]) {
        expect(robots, p).toContain(`Disallow: ${p}`);
      }
    }
  });

  test("help page offers a human support path", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Talk to a person");
    await expect(page.locator('main a[href^="mailto:"]').first()).toBeVisible();
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
  });

  test("Pennsylvania annual report page shows sourced facts", async ({ page }) => {
    await page.goto("/annual-report/pennsylvania");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pennsylvania");
    const body = page.locator("main");
    await expect(body).toContainText("September 30");
    await expect(body).toContainText("June 30");
    await expect(body).toContainText("December 31");
    await expect(body).toContainText("$7");
    await expect(page.locator('a[href*="pa.gov"]').first()).toBeVisible();
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
    // Structured data present and never claims to be a government service.
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.join("\n")).toContain("FAQPage");
    expect(jsonLd.join("\n")).not.toContain("GovernmentService");
  });

  test("entity page for Pennsylvania LLCs", async ({ page }) => {
    await page.goto("/annual-report/pennsylvania/llc");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/LLC/);
    await expect(page.locator("main")).toContainText("September 30");
  });

  test("unverified state pages make no claims and are noindex", async ({ page }) => {
    await page.goto("/annual-report/texas");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator("main")).toContainText(/haven.t verified/i);
  });

  test("robots and sitemap", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBeTruthy();
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBeTruthy();
    const xml = await sitemap.text();
    expect(xml).toContain("/annual-report/pennsylvania");
    expect(xml).not.toContain("/annual-report/texas");
    expect(xml).not.toContain("/admin");
    for (const [slug] of GUIDES) expect(xml).toContain(`/pennsylvania/${slug}`);
    for (const bad of ["/find/result", "/dashboard", "/file/", "/m/", "/rs/", "/reminders/", "/login"]) expect(xml).not.toContain(bad);
  });

  test("admin console is hidden from signed-out visitors", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
