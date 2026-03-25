import { expect, test, type Page } from "@playwright/test";

async function mockUiStateAndKeys(page: Page): Promise<void> {
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
          sidebarOpen: true,
          apiKeysOpen: false,
          showAdvanced: false,
          profile: "free",
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

async function openSidebarIfMobile(page: Page): Promise<void> {
  const openMenuButton = page.getByRole("button", { name: "Open menu" });
  if (await openMenuButton.isVisible()) {
    await openMenuButton.click();
  }
}

test.describe("Provider gating", () => {
  test("paid providers are disabled without API keys", async ({ page }) => {
    await mockUiStateAndKeys(page);
    await page.goto("/");

    const tavilyButton = page.getByRole("button", { name: /Tavily/i });
    await expect(tavilyButton).toBeDisabled();
    await expect(tavilyButton).toContainText("needs key");
  });

  test("provider enables after entering local API key", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Enabled-state interaction is desktop-only");
    await mockUiStateAndKeys(page);
    await page.goto("/");
    await openSidebarIfMobile(page);

    const apiKeysToggle = page.getByTestId("api-keys-toggle");
    await apiKeysToggle.scrollIntoViewIfNeeded();
    await apiKeysToggle.click({ force: true });
    await page
      .locator("label", { hasText: "Tavily" })
      .locator("..")
      .locator("input[type='password']")
      .fill("tvly-test-key");

    const tavilyButton = page.getByRole("button", { name: /Tavily/i });
    await expect(tavilyButton).toBeEnabled();
  });

  test("manual provider toggle switches profile to custom", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Profile toggle interaction is desktop-only");
    await mockUiStateAndKeys(page);
    await page.goto("/");
    await openSidebarIfMobile(page);

    const duckduckgoButton = page.getByRole("button", { name: /^DuckDuckGo$/ });
    await duckduckgoButton.scrollIntoViewIfNeeded();
    await duckduckgoButton.click({ force: true });
    await expect(page.locator("select")).toHaveValue("custom");
  });

  test("duckduckgo is disabled when mistral key is present", async ({ page }) => {
    await mockUiStateAndKeys(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        "web-resolver-api-keys",
        JSON.stringify({ mistral_api_key: "test-key" })
      );
    });
    await page.goto("/");

    const duckduckgoButton = page.getByRole("button", { name: /^DuckDuckGo$/ });
    await expect(duckduckgoButton).toBeDisabled();
  });
});
