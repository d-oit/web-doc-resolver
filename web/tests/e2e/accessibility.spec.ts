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
  // Wait for the search input to be present and visible
  await expect(page.locator("#search-input")).toBeVisible({ timeout: 15000 });
}

async function ensureSidebarOpen(page: import("@playwright/test").Page): Promise<void> {
  const isMobile = (page.viewportSize()?.width || 0) < 1024;
  if (isMobile) {
    const menuButton = page.getByRole("button", { name: "Open menu" });
    const sidebar = page.locator("#sidebar-container");

    // Check if sidebar is currently in the viewport
    const isShowing = await sidebar.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 0 && rect.right > 0;
    });

    if (!isShowing) {
       // Click hamburger and wait for animation
       await menuButton.click({ force: true });
       await expect(sidebar).toBeInViewport({ timeout: 5000 });
       await page.waitForTimeout(500);
    }
  }
}

test.describe("UX & Accessibility Improvements", () => {
  test("focus returns to search input after clicking Clear", async ({ page }) => {
    await waitForApp(page);
    const input = page.locator("#search-input");
    await input.fill("test query");

    const clearButton = page.getByRole("button", { name: "Clear input and results" });
    await expect(clearButton).toBeVisible();

    // Use force: true to bypass interception issues on small viewports in headless mode
    await clearButton.click({ force: true });

    await expect(input).toBeFocused();
  });

  test("provider status region has correct ARIA attributes", async ({ page }) => {
    await waitForApp(page);
    const statusRegion = page.locator("[role='status'][aria-live='polite']");
    await expect(statusRegion).toBeVisible();
  });

  test("API Keys toggle has aria-expanded and aria-controls", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    const toggle = page.getByTestId("api-keys-toggle");

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "api-keys-panel");

    await toggle.scrollIntoViewIfNeeded();
    await toggle.click({ force: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#api-keys-panel")).toBeVisible();
  });

  test("sidebar toggle has aria-expanded and aria-controls", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);

    const toggle = page.getByTestId("sidebar-toggle");
    await expect(toggle).toHaveAttribute("aria-controls", "sidebar-config-content");

    const isMobile = (page.viewportSize()?.width || 0) < 1024;
    if (!isMobile) {
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await toggle.click({ force: true });
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
  });

  test("profile combobox has aria-expanded and aria-controls", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    const toggle = page.getByRole("button", { name: "Change search profile" });

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "profile-options-listbox");

    await toggle.scrollIntoViewIfNeeded();
    await toggle.click({ force: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#profile-options-listbox")).toBeVisible();
  });

  test("max chars inputs are correctly labeled", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);

    const profileLabel = page.locator("label[for='max-chars-range-profile']");
    await expect(profileLabel).toBeVisible();

    const apiToggle = page.getByTestId("api-keys-toggle");
    await apiToggle.scrollIntoViewIfNeeded();
    await apiToggle.click({ force: true });

    const apiLabel = page.locator("label[for='max-chars-range-api']");
    await expect(apiLabel).toBeVisible();
  });
});
