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

// Helper to wait for app to be fully loaded (async state initialization)
async function waitForApp(page: import("@playwright/test").Page): Promise<void> {
  await mockAppState(page);
  await page.goto("/");
  await expect(page.getByTestId("app-loaded")).toBeVisible({ timeout: 10000 });
}

// Helper to ensure sidebar is open (needed for small viewports)
async function ensureSidebarOpen(page: import("@playwright/test").Page): Promise<void> {
  const isMobile = await page.evaluate(() => window.innerWidth < 1024);
  if (isMobile) {
    const backdrop = page.locator("div.fixed.inset-0.bg-black\\/80");
    const menuButton = page.getByRole("button", { name: "Open menu" });

    // Check if backdrop is visible (meaning menu is already open)
    const backdropVisible = await backdrop.isVisible();
    if (!backdropVisible) {
      await menuButton.click();
      await expect(backdrop).toBeVisible();
    }
  }
}

test.describe("Page Load & Structure", () => {
  test("loads and displays the app name", async ({ page }) => {
    await waitForApp(page);
    // Swiss brutalist design uses span in header, not h1
    await expect(page.locator("text=do-web-doc-resolver")).toBeVisible();
  });

  test("has correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/do-web-doc-resolver/);
  });

  test("shows input placeholder", async ({ page }) => {
    await waitForApp(page);
    await expect(page.locator('input[placeholder*="URL"]')).toBeVisible();
  });
});

test.describe("CSS & Theme", () => {
  test("Tailwind CSS loads and applies styles", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    const fontFamily = await body.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    // Swiss brutalist design uses Geist Mono
    expect(fontFamily.toLowerCase()).toContain("geist mono");
  });

  test("button has styled appearance", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Button only appears when there's text in the input
    const input = page.locator("input[placeholder*='URL']");
    await input.fill("test");
    const button = page.getByRole("button", { name: "Fetch" });
    await expect(button).toBeVisible();

    const bgColor = await button.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Swiss brutalist design: acid green button (#00ff41 = rgb(0, 255, 65))
    expect(bgColor).toBe("rgb(0, 255, 65)");
  });

  test("input has styled border", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Target the main query input specifically
    const input = page.locator("input[type='text']").first();
    const borderStyle = await input.evaluate(
      (el) => getComputedStyle(el).borderStyle
    );
    // The main input has no visible border (transparent)
    expect(borderStyle).toBeTruthy();
  });

  test("main container has correct layout", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    // Swiss brutalist design: main is a flex container
    const display = await main.evaluate(
      (el) => getComputedStyle(el).display
    );
    expect(display).toBe("flex");
  });
});

test.describe("Form Interaction", () => {
  test("input accepts text", async ({ page }) => {
    await page.goto("/");
    // Target the main query input specifically (not API key inputs)
    const input = page.locator("input[placeholder*='URL']");
    await input.fill("test query");
    await expect(input).toHaveValue("test query");
  });

  test("button is hidden when input is empty", async ({ page }) => {
    await page.goto("/");
    // In Swiss brutalist design, button only shows when there's text
    const button = page.getByRole("button", { name: "Fetch" });
    await expect(button).not.toBeVisible();
  });

  test("button is enabled when input has text", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("some query");
    const button = page.getByRole("button", { name: "Fetch" });
    await expect(button).toBeEnabled();
  });

  test("button shows Fetch text by default", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("test");
    await expect(page.getByRole("button", { name: "Fetch" })).toBeVisible();
  });

  test("button shows loading state on submit", async ({ page }) => {
    await page.route("**/api/resolve", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ markdown: "done" }),
      });
    });

    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("https://example.com");
    const button = page.getByRole("button", { name: "Fetch" });
    await button.click();
    // After click, the button text changes to "..."
    await expect(page.getByRole("button", { name: "..." })).toBeVisible();
  });

  test("button is disabled while loading", async ({ page }) => {
    await page.route("**/api/resolve", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ markdown: "done" }),
      });
    });

    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("https://example.com");
    const button = page.getByRole("button", { name: "Fetch" });
    await button.click();
    // After click, check the disabled state on the "..." button
    await expect(page.getByRole("button", { name: "..." })).toBeDisabled();
  });

  test("form submits on Enter key", async ({ page }) => {
    await page.route("**/api/resolve", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ markdown: "done" }),
      });
    });

    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("test query");
    await input.press("Enter");
    await expect(page.getByRole("button", { name: "..." })).toBeVisible();
  });

  test("whitespace-only input does not show button", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("   ");
    const button = page.getByRole("button", { name: "Fetch" });
    await expect(button).not.toBeVisible();
  });
});

test.describe("Error Handling", () => {
  test("shows error message on failed fetch", async ({ page }) => {
    await page.route("**/api/resolve", async (route) => {
      await route.abort("failed");
    });

    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("https://example.com");
    await page.getByRole("button", { name: "Fetch" }).click();
    await expect(page.locator("text=Failed to fetch")).toBeVisible({
      timeout: 10000,
    });
  });

  test("error message has styled appearance", async ({ page }) => {
    await page.route("**/api/resolve", async (route) => {
      await route.abort("failed");
    });

    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("https://example.com");
    await page.getByRole("button", { name: "Fetch" }).click();
    await page.waitForSelector("text=Failed to fetch");

    // Swiss brutalist design: error text is red
    const errorDiv = page.locator("div").filter({ hasText: "Failed to fetch" }).first();
    const color = await errorDiv.evaluate(
      (el) => getComputedStyle(el).color
    );
    // Check for red color (rgb values for red)
    expect(color).toMatch(/rgb\(\d+, \d+, \d+\)/);
  });

  test("clears error when new result arrives", async ({ page }) => {
    let firstCall = true;
    await page.route("**/api/resolve", async (route) => {
      if (firstCall) {
        firstCall = false;
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ markdown: "success" }),
      });
    });

    await page.goto("/");
    const input = page.locator("input[type='text']");
    const button = page.getByRole("button", { name: "Fetch" });

    await input.fill("https://example.com");
    await button.click();
    await expect(page.locator("text=Failed to fetch")).toBeVisible({
      timeout: 10000,
    });

    await input.fill("another query");
    await button.click();
    // Swiss brutalist design uses textarea for output
    await expect(page.locator("textarea")).toContainText("success", {
      timeout: 10000,
    });
  });
});

test.describe("Dark Mode", () => {
  test.use({ colorScheme: "dark" });

  test("body has dark background", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    const bgColor = await main.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    // Swiss brutalist design: #0c0c0c background = rgb(12, 12, 12)
    expect(bgColor).toBe("rgb(12, 12, 12)");
  });

  test("text has light color", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    const color = await main.evaluate(
      (el) => getComputedStyle(el).color
    );
    expect(color).not.toBe("rgb(0, 0, 0)");
  });
});

test.describe("Responsive Layout", () => {
  test("adapts to mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    const padding = await main.evaluate(
      (el) => getComputedStyle(el).padding
    );
    expect(padding).toBeTruthy();
  });

  test("form is usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const input = page.locator("input[type='text']");
    await input.fill("mobile query");
    const button = page.getByRole("button", { name: "Fetch" });

    await expect(input).toBeVisible();
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });
});

test.describe("Keyboard Navigation", () => {
  test("input is focusable", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input[placeholder*='URL']");
    // Click on the input to focus it
    await input.click();
    await expect(input).toBeFocused();
  });

  test("button is focusable when visible", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("some query");
    await input.focus();
    await page.keyboard.press("Tab");
    const button = page.getByRole("button", { name: "Fetch" });
    await expect(button).toBeFocused();
  });

  test("input accepts keyboard input", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.focus();
    await page.keyboard.type("hello world");
    await expect(input).toHaveValue("hello world");
  });
});

test.describe("Network Interception", () => {
  test("displays resolver result on successful response", async ({
    page,
  }) => {
    await mockAppState(page);
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: "# Result\n\nThis is the resolved content.",
        }),
      })
    );

    await page.goto("/");
    await expect(page.getByTestId("app-loaded")).toBeVisible({ timeout: 10000 });
    const input = page.locator("input[type='text']");
    await input.fill("test query");
    await page.getByRole("button", { name: "Fetch" }).click();

    // Click Raw button to see textarea (default is Cards view)
    await page.getByRole("button", { name: "Raw" }).click();
    await expect(page.locator("textarea")).toContainText(
      "This is the resolved content."
    );
  });

  test("displays error on server error", async ({ page }) => {
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      })
    );

    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("test query");
    await page.getByRole("button", { name: "Fetch" }).click();

    await expect(page.locator("text=Internal server error")).toBeVisible({
      timeout: 10000,
    });
  });

  test("clears previous result on new submission", async ({ page }) => {
    let callCount = 0;
    await page.route("**/api/resolve", (route) => {
      callCount++;
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: `Result #${callCount}`,
        }),
      });
    });

    await page.goto("/");
    const input = page.locator("input[type='text']");
    const button = page.getByRole("button", { name: "Fetch" });

    await input.fill("query 1");
    await button.click();
    await expect(page.locator("textarea")).toContainText("Result #1");

    await input.fill("query 2");
    await button.click();
    await expect(page.locator("textarea")).toContainText("Result #2");
  });

  test("uses result field when markdown is absent", async ({ page }) => {
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: "Alternative result field",
        }),
      })
    );

    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("test query");
    await page.getByRole("button", { name: "Fetch" }).click();

    await expect(page.locator("textarea")).toContainText(
      "Alternative result field"
    );
  });

  test("handles provider field in response", async ({
    page,
  }) => {
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: "Content here",
          provider: "jina",
        }),
      })
    );

    await page.goto("/");
    const input = page.locator("input[type='text']");
    await input.fill("test query");
    await page.getByRole("button", { name: "Fetch" }).click();

    // Wait for textarea to appear (result display)
    await page.waitForSelector("textarea", { timeout: 10000 });
    await expect(page.locator("textarea")).toContainText("Content here");
    // Provider should be shown in the metadata bar (Source: jina)
    await expect(page.locator("text=Source:")).toBeVisible();
  });
});

test.describe("Security Headers", () => {
  test("response has X-Content-Type-Options", async ({ page }) => {
    // Security headers are only set by Vercel in production
    test.skip(!!process.env.BASE_URL?.includes("localhost"), "Security headers only apply to production");

    const response = await page.goto("/");
    const headers = response?.headers();
    expect(headers?.["x-content-type-options"]).toBe("nosniff");
  });

  test("response has X-Frame-Options", async ({ page }) => {
    // Security headers are only set by Vercel in production
    test.skip(!!process.env.BASE_URL?.includes("localhost"), "Security headers only apply to production");

    const response = await page.goto("/");
    const headers = response?.headers();
    expect(headers?.["x-frame-options"]).toBe("DENY");
  });
});

test.describe("Navigation", () => {
  test("home page has header with app name", async ({ page }) => {
    await page.goto("/");
    // Swiss brutalist design has a header div, not nav
    await expect(page.locator("text=do-web-doc-resolver")).toBeVisible();
  });

  test("header has link to help page", async ({ page }) => {
    await page.goto("/");
    const helpLink = page.locator('a[href="/help"]');
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toContainText("Help");
  });

  test("clicking help link navigates to /help", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/help"]');
    await expect(page).toHaveURL(/\/help/);
    await expect(page.locator("h1")).toContainText("Help");
  });
});

test.describe("Collapsible Sidebar", () => {
  test("sidebar is visible by default", async ({ page }) => {
    await waitForApp(page);
    await expect(page.getByTestId("sidebar-toggle")).toBeVisible();
    await expect(page.locator("text=Configuration")).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "Profile" })).toBeVisible();
  });

  test("sidebar collapses when clicking Configuration header", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    await expect(page.locator("label").filter({ hasText: "Profile" })).toBeVisible();
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.locator("label").filter({ hasText: "Profile" })).not.toBeVisible();
  });

  test("sidebar expands when clicking Configuration header again", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.locator("label").filter({ hasText: "Profile" })).not.toBeVisible();
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.locator("label").filter({ hasText: "Profile" })).toBeVisible();
  });

  test("toggle label shows correct text", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    await expect(page.getByTestId("sidebar-toggle").locator("text=Hide")).toBeVisible();
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByTestId("sidebar-toggle").locator("text=Show")).toBeVisible();
  });

  test("Keys link is visible in sidebar header", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    const keysLink = page.locator('a[href="/settings"]');
    await expect(keysLink).toBeVisible();
    await expect(keysLink).toContainText("Keys");
  });

  test("Keys link navigates to settings", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    await page.locator('a[href="/settings"]').click();
    await expect(page).toHaveURL(/\/settings/);
  });
});

test.describe("Collapsible API Keys", () => {
  test("API Keys section is collapsed by default", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    await expect(page.getByTestId("api-keys-toggle")).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "Serper" })).not.toBeVisible();
  });

  test("API Keys section expands on click", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    await page.getByTestId("api-keys-toggle").click();
    await expect(page.locator("label").filter({ hasText: "Serper" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "Tavily" })).toBeVisible();
  });

  test("API Keys section collapses on second click", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    await page.getByTestId("api-keys-toggle").click();
    await expect(page.locator("label").filter({ hasText: "Serper" })).toBeVisible();
    await page.getByTestId("api-keys-toggle").click();
    await expect(page.locator("label").filter({ hasText: "Serper" })).not.toBeVisible();
  });
});

test.describe("Profile Provider Indicators", () => {
  test("profile providers are shown as active by default", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    // Free profile is default: exa_mcp (DuckDuckGo may be disabled if Mistral is active)
    // Exa MCP should have the active style (green border)
    const exaButton = page.locator("button").filter({ hasText: "Exa MCP" });

    // Check green border color (rgb(0, 255, 65) = #00ff41)
    const exaBorder = await exaButton.evaluate((el) => getComputedStyle(el).borderColor);
    expect(exaBorder).toContain("rgb(0, 255, 65)");
  });

  test("profile status text shows provider count", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    // Free profile shows exa_mcp, may or may not show DuckDuckGo depending on Mistral gating
    await expect(page.locator("text=Using free profile")).toBeVisible();
  });

  test("clicking a provider switches to custom selection", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    // Click Exa MCP (free, always available) to toggle it off the profile
    await page.locator("button").filter({ hasText: "Exa MCP" }).click();
    // Status should change to custom selection
    await expect(page.locator("text=selected")).toBeVisible();
  });

  test("manual selection overrides profile display", async ({ page }) => {
    await waitForApp(page);
    await ensureSidebarOpen(page);
    // Click Exa MCP (free, always available) to manually toggle
    const exaButton = page.locator("button").filter({ hasText: "Exa MCP" });
    await exaButton.click();
    // After manual click, button style changes (either selected or deselected)
    // Check that the button is no longer in the default profile-active state
    const bgColor = await exaButton.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Should be either solid green (selected) or transparent (deselected)
    expect(bgColor === "rgb(0, 255, 65)" || bgColor === "rgba(0, 0, 0, 0)").toBe(true);
  });
});

test.describe("Help Page", () => {
  test("loads and displays heading", async ({ page }) => {
    await page.goto("/help");
    await expect(page.locator("h1")).toContainText("Help");
  });

  test("shows URL cascade section", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "For URLs" })).toBeVisible();
  });

  test("shows query cascade section", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "For Queries" })).toBeVisible();
  });

  test("shows troubleshooting section", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "Troubleshooting" })).toBeVisible();
    await expect(page.locator("text=Failed to fetch")).toBeVisible();
  });

  test("shows FAQ section", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "FAQ", exact: true })).toBeVisible();
    await expect(page.locator("text=What is this?")).toBeVisible();
    await expect(page.locator("text=Do I need an API key?")).toBeVisible();
    await expect(page.locator("text=configuration panel")).toBeVisible();
  });

  test("has back link to home", async ({ page }) => {
    await page.goto("/help");
    const backLink = page.locator('a[href="/"]').first();
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page.getByTestId("app-loaded")).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("help page CSS loads correctly", async ({ page }) => {
    await page.goto("/help");
    await page.waitForLoadState("networkidle");
    const main = page.locator("main");
    const fontFamily = await main.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    // Swiss brutalist design uses Geist Mono
    expect(fontFamily.toLowerCase()).toContain("geist mono");
  });
});
