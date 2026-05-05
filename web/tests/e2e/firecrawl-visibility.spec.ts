import { test, expect } from "@playwright/test";

test.describe("Firecrawl Visibility", () => {
  test("Firecrawl button is visible in Sidebar and Settings", async ({ page }) => {
    // 1. Check Sidebar
    await page.goto("/");
    // Wait for app to load (checking for data-testid="app-loaded" set in page.tsx)
    await expect(page.getByTestId("app-loaded")).toBeVisible({ timeout: 15000 });

    // The PROVIDERS list in constants.ts should now include Firecrawl.
    // We check for the button label.
    await expect(page.getByRole("button", { name: /Firecrawl/ })).toBeVisible();

    // 2. Check Settings
    await page.goto("/settings");
    await expect(page.getByText("Firecrawl")).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(5); // Serper, Tavily, Exa, Firecrawl, Mistral
  });
});
