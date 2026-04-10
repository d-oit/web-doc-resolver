import { expect, test, type Page } from "@playwright/test";

const baseUrl = process.env.BASE_URL || "";
const isLocalBaseUrl = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

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

async function openSidebarIfMobile(page: Page): Promise<void> {
  const openMenuButton = page.getByRole("button", { name: "Open menu" });
  if (await openMenuButton.isVisible()) {
    await openMenuButton.click();
  }
}

test.describe("Provider gating", () => {
  test.skip(!isLocalBaseUrl, "This suite validates local UI behavior only");

  test("paid providers show needs key when API keys absent", async ({ page }) => {
    await mockUiStateAndKeys(page);
    await page.goto("/");
    await openSidebarIfMobile(page);

    const tavilyButton = page.getByRole("button", { name: /Tavily/i });
    // Button is NOT disabled - clicking shows helpful feedback
    await expect(tavilyButton).toBeEnabled();
    await expect(tavilyButton).toContainText("needs key");
    // Button has muted styling (aria-describedby indicates unavailable state)
    await expect(tavilyButton).toHaveAttribute("aria-describedby");
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

    // Use Exa MCP instead of DuckDuckGo (DuckDuckGo may be disabled due to Mistral gating)
    const exaMcpButton = page.getByRole("button", { name: /Exa MCP/ });
    await exaMcpButton.scrollIntoViewIfNeeded();
    await exaMcpButton.click({ force: true });
    // ProfileCombobox shows "Custom" after manual provider toggle
    const profileButton = page.locator("button[aria-label='Change search profile']");
    await expect(profileButton).toContainText("Custom");
  });

  test("custom provider selection persists across reload via server state", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Persistence interaction is desktop-only");

    let serverState: Record<string, unknown> = {
      sidebarCollapsed: false,
      showApiKeys: false,
      showAdvanced: false,
      activeProfile: "free",
      selectedProviders: [],
      maxChars: 8000,
      skipCache: false,
      deepResearch: false,
      updatedAt: 0,
    };

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
          body: JSON.stringify(serverState),
        });
        return;
      }

      const payload = route.request().postDataJSON() as Record<string, unknown>;
      serverState = { ...serverState, ...payload };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/");
    await openSidebarIfMobile(page);

    // Use Exa MCP instead of DuckDuckGo (DuckDuckGo may be disabled due to Mistral gating)
    const exaMcpButton = page.getByRole("button", { name: /Exa MCP/ });
    await exaMcpButton.scrollIntoViewIfNeeded();
    await exaMcpButton.click({ force: true });
    // ProfileCombobox shows "Custom" after manual provider toggle
    const profileButton = page.locator("button[aria-label='Change search profile']");
    await expect(profileButton).toContainText("Custom");

    await page.waitForTimeout(2200);
    await page.reload();
    await openSidebarIfMobile(page);

    // Profile should still be custom after reload
    await expect(profileButton).toContainText("Custom");
    await expect(page.locator("text=1 selected")).toBeVisible();
  });

  test("duckduckgo is styled as unavailable when mistral key is present", async ({ page }) => {
    await mockUiStateAndKeys(page);
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
            apiKeys: { mistral_api_key: "test-key" },
            updatedAt: Date.now(),
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
    await page.goto("/");
    await openSidebarIfMobile(page);

    // Use a more flexible selector that matches the aria-label
    const duckduckgoButton = page.getByRole("button", { name: /DuckDuckGo/ });
    // Button is NOT disabled - it has aria-describedby indicating unavailable state
    await expect(duckduckgoButton).toBeEnabled();
    await expect(duckduckgoButton).toHaveAttribute("aria-describedby", "provider-hint-duckduckgo");
  });
});
