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
  test("suppresses placeholder metadata independently", async ({ page }) => {
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: `
Title: Result with placeholder author
URL: https://example.com/1
Author: unknown
Published: 2023-05-01

Highlights:
Author should be suppressed, but date should show.
---
Title: Result with placeholder date
URL: https://example.com/2
Author: Jane Doe
Published: -

Highlights:
Date should be suppressed, but author should show.
---
Title: Result with all placeholders
URL: https://example.com/3
Author: NA
Published: –

Highlights:
Both should be suppressed.
`,
        }),
      })
    );

    await waitForApp(page);
    const input = page.locator("input[type='text']");
    await input.fill("test query");
    await page.getByRole("button", { name: "Fetch" }).click();

    // 4. ResultCard component suppresses author section when the value is a placeholder
    const result1 = page.locator('article').filter({ hasText: 'Result with placeholder author' });
    await expect(result1).toBeVisible();
    await expect(result1.locator('text=By')).toBeHidden();
    await expect(result1.locator('text=2023-05-01')).toBeVisible();

    // 5. ResultCard component suppresses publication date when the value is a placeholder
    const result2 = page.locator('article').filter({ hasText: 'Result with placeholder date' });
    await expect(result2).toBeVisible();
    await expect(result2.locator('text=By Jane Doe')).toBeVisible();
    await expect(result2.locator('text=-')).toBeHidden();

    const result3 = page.locator('article').filter({ hasText: 'Result with all placeholders' });
    await expect(result3).toBeVisible();
    await expect(result3.locator('text=By')).toBeHidden();
    await expect(result3.locator('text=–')).toBeHidden();

    // Check that the metadata container itself has no visible spans
    await expect(result3.locator('header > div.flex.gap-3 span')).toHaveCount(0);
  });
});
