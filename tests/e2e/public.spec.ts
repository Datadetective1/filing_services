import { expect, test } from "@playwright/test";

const DISCLAIMER = "Not affiliated with or endorsed by any government agency";

test.describe("public pages", () => {
  test("homepage communicates the value and the disclaimer", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Never miss a business filing");
    await expect(page.getByRole("link", { name: "Find my business" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse filing requirements" }).first()).toBeVisible();
    await expect(page.getByText(DISCLAIMER).first()).toBeVisible();
    // No horizontal overflow on any viewport.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
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
  });

  test("admin console is hidden from signed-out visitors", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
