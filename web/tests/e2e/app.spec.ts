import { test, expect } from "@playwright/test";

test.describe("Page Load & Structure", () => {
  test("loads and displays the heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Web Doc Resolver");
  });

  test("displays the subtitle", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("p").first()).toContainText(
      "Resolve queries and URLs into compact, LLM-ready markdown"
    );
  });

  test("has correct page title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Web Doc Resolver/);
  });

  test("shows hint text with examples", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("code")).toHaveCount(2);
    await expect(page.getByText("https://docs.python.org")).toBeVisible();
    await expect(page.getByText("python async best practices")).toBeVisible();
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
    expect(fontFamily).toContain("Inter");
  });

  test("button has styled appearance", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const button = page.locator("button");
    const bgColor = await button.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(bgColor).not.toBe("rgb(0, 0, 0)");
  });

  test("input has styled border", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const input = page.locator("input");
    const borderStyle = await input.evaluate(
      (el) => getComputedStyle(el).borderStyle
    );
    expect(borderStyle).not.toBe("none");
  });

  test("main container has correct padding", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const main = page.locator("main");
    const padding = await main.evaluate(
      (el) => getComputedStyle(el).padding
    );
    expect(padding).not.toBe("0px");
  });
});

test.describe("Form Interaction", () => {
  test("input accepts text", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input");
    await input.fill("test query");
    await expect(input).toHaveValue("test query");
  });

  test("button is disabled when input is empty", async ({ page }) => {
    await page.goto("/");
    const button = page.locator("button");
    await expect(button).toBeDisabled();
  });

  test("button is enabled when input has text", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input");
    await input.fill("some query");
    const button = page.locator("button");
    await expect(button).toBeEnabled();
  });

  test("button shows Resolve text by default", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("button")).toHaveText("Resolve");
  });

  test("button shows loading state on submit", async ({ page }) => {
    await page.route("**/resolve", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ markdown: "done" }),
      });
    });

    await page.goto("/");
    const input = page.locator("input");
    await input.fill("https://example.com");
    const button = page.locator("button");
    await button.click();
    await expect(button).toContainText("Resolving...");
  });

  test("button is disabled while loading", async ({ page }) => {
    await page.route("**/resolve", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ markdown: "done" }),
      });
    });

    await page.goto("/");
    const input = page.locator("input");
    await input.fill("https://example.com");
    const button = page.locator("button");
    await button.click();
    await expect(button).toBeDisabled();
  });

  test("form submits on Enter key", async ({ page }) => {
    await page.route("**/resolve", async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ markdown: "done" }),
      });
    });

    await page.goto("/");
    const input = page.locator("input");
    await input.fill("test query");
    await input.press("Enter");
    await expect(page.locator("button")).toContainText("Resolving...");
  });

  test("whitespace-only input does not submit", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input");
    await input.fill("   ");
    const button = page.locator("button");
    await expect(button).toBeDisabled();
  });
});

test.describe("Error Handling", () => {
  test("shows error message on failed fetch", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input");
    await input.fill("https://example.com");
    await page.locator("button").click();
    await expect(page.locator("text=Failed to fetch")).toBeVisible({
      timeout: 10000,
    });
  });

  test("error message has styled appearance", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input");
    await input.fill("https://example.com");
    await page.locator("button").click();
    await page.waitForSelector("text=Failed to fetch");

    const errorDiv = page.locator("div.text-red-800, div.dark\\:text-red-200").first();
    const bg = await errorDiv.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("clears error when new result arrives", async ({ page }) => {
    let firstCall = true;
    await page.route("**/resolve", async (route) => {
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
    const input = page.locator("input");
    const button = page.locator("button");

    await input.fill("https://example.com");
    await button.click();
    await expect(page.locator("text=Failed to fetch")).toBeVisible({
      timeout: 10000,
    });

    await input.fill("another query");
    await button.click();
    await expect(page.locator("pre")).toContainText("success", {
      timeout: 10000,
    });
  });
});

test.describe("Dark Mode", () => {
  test.use({ colorScheme: "dark" });

  test("body has dark background", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    const bgColor = await body.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(bgColor).not.toBe("rgb(255, 255, 255)");
  });

  test("text has light color", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const body = page.locator("body");
    const color = await body.evaluate(
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

    const input = page.locator("input");
    const button = page.locator("button");

    await expect(input).toBeVisible();
    await expect(button).toBeVisible();

    await input.fill("mobile query");
    await expect(button).toBeEnabled();
  });
});

test.describe("Keyboard Navigation", () => {
  test("input is focusable via Tab", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const input = page.locator("input");
    await expect(input).toBeFocused();
  });

  test("button is focusable when enabled", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input");
    await input.fill("some query");
    await input.focus();
    await page.keyboard.press("Tab");
    const button = page.locator("button");
    await expect(button).toBeFocused();
  });

  test("input has visible focus ring", async ({ page }) => {
    await page.goto("/");
    const input = page.locator("input");
    await input.focus();
    const boxShadow = await input.evaluate(
      (el) => getComputedStyle(el).boxShadow
    );
    const outlineWidth = await input.evaluate(
      (el) => getComputedStyle(el).outlineWidth
    );
    expect(
      boxShadow !== "none" || outlineWidth !== "0px"
    ).toBeTruthy();
  });
});

test.describe("Network Interception", () => {
  test("displays resolver result on successful response", async ({
    page,
  }) => {
    await page.route("**/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: "# Result\n\nThis is the resolved content.",
        }),
      })
    );

    await page.goto("/");
    const input = page.locator("input");
    await input.fill("test query");
    await page.locator("button").click();

    await expect(page.locator("pre")).toContainText(
      "This is the resolved content."
    );
  });

  test("displays error on server error", async ({ page }) => {
    await page.route("**/resolve", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error" }),
      })
    );

    await page.goto("/");
    const input = page.locator("input");
    await input.fill("test query");
    await page.locator("button").click();

    await expect(page.locator("text=Resolver returned 500")).toBeVisible({
      timeout: 10000,
    });
  });

  test("clears previous result on new submission", async ({ page }) => {
    let callCount = 0;
    await page.route("**/resolve", (route) => {
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
    const input = page.locator("input");
    const button = page.locator("button");

    await input.fill("query 1");
    await button.click();
    await expect(page.locator("pre")).toContainText("Result #1");

    await input.fill("query 2");
    await button.click();
    await expect(page.locator("pre")).toContainText("Result #2");
  });

  test("uses result field when markdown is absent", async ({ page }) => {
    await page.route("**/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          result: "Alternative result field",
        }),
      })
    );

    await page.goto("/");
    const input = page.locator("input");
    await input.fill("test query");
    await page.locator("button").click();

    await expect(page.locator("pre")).toContainText(
      "Alternative result field"
    );
  });

  test("falls back to JSON stringify for unknown response shape", async ({
    page,
  }) => {
    await page.route("**/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: { nested: true },
          count: 42,
        }),
      })
    );

    await page.goto("/");
    const input = page.locator("input");
    await input.fill("test query");
    await page.locator("button").click();

    await expect(page.locator("pre")).toContainText('"nested"');
  });
});

test.describe("Security Headers", () => {
  test("response has X-Content-Type-Options", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers();
    expect(headers?.["x-content-type-options"]).toBe("nosniff");
  });

  test("response has X-Frame-Options", async ({ page }) => {
    const response = await page.goto("/");
    const headers = response?.headers();
    expect(headers?.["x-frame-options"]).toBe("DENY");
  });
});

test.describe("Navigation", () => {
  test("home page has nav bar with app name", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    await expect(nav.locator("a").first()).toContainText("Web Doc Resolver");
  });

  test("nav has link to help page", async ({ page }) => {
    await page.goto("/");
    const helpLink = page.locator('nav a[href="/help"]');
    await expect(helpLink).toBeVisible();
    await expect(helpLink).toContainText("Help");
  });

  test("clicking help link navigates to /help", async ({ page }) => {
    await page.goto("/");
    await page.click('nav a[href="/help"]');
    await expect(page).toHaveURL(/\/help/);
    await expect(page.locator("h1")).toContainText("Help & FAQ");
  });
});

test.describe("Help Page", () => {
  test("loads and displays heading", async ({ page }) => {
    await page.goto("/help");
    await expect(page.locator("h1")).toContainText("Help & FAQ");
  });

  test("shows how to use section", async ({ page }) => {
    await page.goto("/help");
    await expect(page.locator("text=How to use")).toBeVisible();
  });

  test("shows supported inputs section", async ({ page }) => {
    await page.goto("/help");
    await expect(page.locator("text=Supported inputs")).toBeVisible();
  });

  test("shows cascade explanation", async ({ page }) => {
    await page.goto("/help");
    await expect(
      page.getByRole("heading", { name: "How the cascade works" })
    ).toBeVisible();
    await expect(page.locator("h3", { hasText: "For URLs" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "For queries" })).toBeVisible();
  });

  test("shows troubleshooting section", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "Troubleshooting" })).toBeVisible();
    await expect(page.locator("text=Failed to fetch")).toBeVisible();
  });

  test("shows FAQ section", async ({ page }) => {
    await page.goto("/help");
    await expect(
      page.getByRole("heading", { name: "FAQ", exact: true })
    ).toBeVisible();
    await expect(
      page.locator("text=What is Web Doc Resolver?")
    ).toBeVisible();
    await expect(page.locator("text=Do I need an API key?")).toBeVisible();
  });

  test("has back link to home", async ({ page }) => {
    await page.goto("/help");
    const backLink = page.locator('a[href="/"]').first();
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL("/");
  });

  test("help page CSS loads correctly", async ({ page }) => {
    await page.goto("/help");
    await page.waitForLoadState("networkidle");
    const body = page.locator("body");
    const fontFamily = await body.evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toContain("Inter");
  });
});
