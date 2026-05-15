import { test, expect } from "@playwright/test";

// Helper to mock UI state and key-status APIs for consistent test state
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

test.describe("UX & Accessibility Improvements", () => {
  test("focus returns to search input after clicking Clear", async ({ page }) => {
    await waitForApp(page);
    const input = page.locator("#search-input");
    await input.fill("test query");

    const clearButton = page.getByRole("button", { name: "Clear input and results" });
    await clearButton.click();

    await expect(input).toBeFocused();
  });

  test("provider status region has correct ARIA attributes", async ({ page }) => {
    await waitForApp(page);
    const statusRegion = page.locator("[role='status'][aria-live='polite']");
    await expect(statusRegion).toBeVisible();
    const content = await statusRegion.textContent();
    expect(content?.trim()).toBe("");
  });

  test("API Keys toggle has aria-expanded and aria-controls", async ({ page }) => {
    await waitForApp(page);
    const toggle = page.getByTestId("api-keys-toggle");

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "api-keys-panel");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#api-keys-panel")).toBeVisible();
  });

  test("sidebar toggle has aria-expanded and aria-controls", async ({ page }) => {
    await waitForApp(page);
    const toggle = page.getByTestId("sidebar-toggle");

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-controls", "sidebar-config-content");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("profile combobox has aria-expanded and aria-controls", async ({ page }) => {
    await waitForApp(page);
    const toggle = page.getByRole("button", { name: "Change search profile" });

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "profile-options-listbox");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#profile-options-listbox")).toBeVisible();
  });

  test("max chars inputs are correctly labeled", async ({ page }) => {
    await waitForApp(page);

    const profileLabel = page.locator("label[for='max-chars-range-profile']");
    await expect(profileLabel).toBeVisible();
    const profileInput = page.locator("#max-chars-range-profile");
    await expect(profileInput).toBeVisible();

    const apiToggle = page.getByTestId("api-keys-toggle");
    await apiToggle.click();

    const apiLabel = page.locator("label[for='max-chars-range-api']");
    await expect(apiLabel).toBeVisible();
    const apiInput = page.locator("#max-chars-range-api");
    await expect(apiInput).toBeVisible();
  });
});
