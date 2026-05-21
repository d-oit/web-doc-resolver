import { test, expect } from "@playwright/test";

async function mockAppState(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/api/key-status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ exa: false, serper: false, tavily: false, firecrawl: false, mistral: false }),
    });
  });

  await page.route("**/api/ui-state", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sidebarCollapsed: false,
          showApiKeys: false,
          showAdvanced: false,
          activeProfile: "free",
          selectedProviders: [],
          maxChars: 8000,
          skipCache: false,
          deepResearch: false,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
}

async function waitForApp(page: import("@playwright/test").Page): Promise<void> {
  await mockAppState(page);
  await page.goto("/");
  await expect(page.getByTestId("app-loaded")).toBeVisible({ timeout: 10000 });
}

test.describe("Metadata Display", () => {
  test("hides 'By N/A' and 'N/A' when metadata is missing or placeholder", async ({ page }) => {
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: `
Title: Result with N/A metadata
URL: https://example.com/na
Author: N/A
Published: N/A

Highlights:
This result should have hidden metadata line.
---
Title: Result with empty metadata
URL: https://example.com/empty
Author:
Published:

Highlights:
This result should also have hidden metadata line.
---
Title: Result with valid metadata
URL: https://example.com/valid
Author: Jane Doe
Published: 2023-01-01

Highlights:
This result should show metadata.
`,
        }),
      })
    );

    await waitForApp(page);
    const input = page.locator("input[type='text']");
    await input.fill("test query");
    await page.getByRole("button", { name: "Fetch" }).click();

    // Check first result (N/A)
    const result1 = page.locator('article').filter({ hasText: 'Result with N/A metadata' });
    await expect(result1).toBeVisible();
    // The metadata div should be empty (or not have the spans)
    const meta1 = result1.locator('header > div.flex.gap-3');
    await expect(meta1.locator('span')).toHaveCount(0);

    // Check second result (empty)
    const result2 = page.locator('article').filter({ hasText: 'Result with empty metadata' });
    await expect(result2).toBeVisible();
    const meta2 = result2.locator('header > div.flex.gap-3');
    await expect(meta2.locator('span')).toHaveCount(0);

    // Check third result (valid)
    const result3 = page.locator('article').filter({ hasText: 'Result with valid metadata' });
    await expect(result3).toBeVisible();
    const meta3 = result3.locator('header > div.flex.gap-3');
    await expect(meta3.locator('span')).toHaveCount(2);
    await expect(meta3.locator('text=By Jane Doe')).toBeVisible();
    await expect(meta3.locator('text=2023-01-01')).toBeVisible();

    await page.screenshot({ path: 'metadata-fix-verification.png' });
  });
});
