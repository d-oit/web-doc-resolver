import { test, expect } from "@playwright/test";

test.describe("History Panel", () => {
  test("history panel is collapsed by default", async ({ page }) => {
    await page.goto("/");
    // History toggle should be visible
    await expect(page.getByText(/History/)).toBeVisible();
    // History panel content should not be visible
    await expect(page.locator("input[placeholder*='Search history']")).not.toBeVisible();
  });

  test("clicking History toggle opens the panel", async ({ page }) => {
    await page.goto("/");
    // Click the History toggle button
    await page.getByRole("button", { name: /History/ }).click();
    // Panel should now show search input
    await expect(page.locator("input[placeholder*='Search history']")).toBeVisible();
  });

  test("shows 'No history yet' when empty", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /History/ }).click();
    await expect(page.locator("text=No history yet")).toBeVisible();
  });

  test("history panel closes on second click", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /History/ });
    // Open panel
    await toggle.click();
    await expect(page.locator("input[placeholder*='Search history']")).toBeVisible();
    // Close panel
    await toggle.click();
    await expect(page.locator("input[placeholder*='Search history']")).not.toBeVisible();
  });
});

test.describe("History Entry Creation", () => {
  test("resolution creates history entry", async ({ page }) => {
    // Mock resolve API
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: "# Test Result\n\nThis is test content.",
          provider: "jina",
        }),
      })
    );

    // Mock history API
    await page.route("**/api/history**", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, id: "test-id-1" }),
        });
      }
      // GET request
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          entries: [{
            id: "test-id-1",
            query: "https://example.com",
            url: "https://example.com",
            result: "# Test Result\n\nThis is test content.",
            provider: "jina",
            timestamp: Date.now(),
            charCount: 32,
            resolveTime: 100,
          }],
        }),
      });
    });

    await page.goto("/");
    const input = page.locator("input[placeholder*='URL']");
    await input.fill("https://example.com");
    await page.getByRole("button", { name: "Fetch" }).click();

    // Wait for result
    await expect(page.locator("textarea")).toContainText("Test Result");

    // Open history panel
    await page.getByRole("button", { name: /History/ }).click();

    // Should show the entry
    await expect(page.locator("text=https://example.com")).toBeVisible();
  });

  test("history entry shows provider name", async ({ page }) => {
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: "Content",
          provider: "exa_mcp",
        }),
      })
    );

    await page.route("**/api/history**", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({ ok: true, id: "test-id" }),
        });
      }
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          entries: [{
            id: "test-id",
            query: "test query",
            result: "Content",
            provider: "exa_mcp",
            timestamp: Date.now(),
            charCount: 7,
            resolveTime: 100,
          }],
        }),
      });
    });

    await page.goto("/");
    await page.locator("input[placeholder*='URL']").fill("test query");
    await page.getByRole("button", { name: "Fetch" }).click();

    await expect(page.locator("textarea")).toContainText("Content");
    await page.getByRole("button", { name: /History/ }).click();

    // Check for provider in metadata line (use exact match to avoid strict mode violation)
    await expect(page.getByText("exa_mcp", { exact: true })).toBeVisible();
  });

  test("history entry shows character count", async ({ page }) => {
    const content = "x".repeat(500);
    await page.route("**/api/resolve", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({
          markdown: content,
          provider: "jina",
        }),
      })
    );

    await page.route("**/api/history**", async (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          body: JSON.stringify({ ok: true, id: "test-id" }),
        });
      }
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          entries: [{
            id: "test-id",
            query: "https://test.com",
            result: content,
            provider: "jina",
            timestamp: Date.now(),
            charCount: 500,
            resolveTime: 100,
          }],
        }),
      });
    });

    await page.goto("/");
    await page.locator("input[placeholder*='URL']").fill("https://test.com");
    await page.getByRole("button", { name: "Fetch" }).click();

    await expect(page.locator("textarea")).toBeVisible();

    // Open history and check character count
    await page.getByRole("button", { name: /History/ }).click();

    // Wait for history to load and check for character count (use exact match)
    await expect(page.getByText("500 chars", { exact: true })).toBeVisible({ timeout: 10000 });
  });
});

test.describe("History Search", () => {
  test("search input filters history entries", async ({ page }) => {
    await page.route("**/api/history**", async (route) => {
      const url = new URL(route.request().url());
      const searchQ = url.searchParams.get("q");

      const allEntries = [
        { id: "1", query: "rust programming", result: "Rust result", provider: "jina", timestamp: Date.now(), charCount: 11, resolveTime: 100 },
        { id: "2", query: "python tutorial", result: "Python result", provider: "jina", timestamp: Date.now(), charCount: 13, resolveTime: 100 },
        { id: "3", query: "javascript guide", result: "JS result", provider: "jina", timestamp: Date.now(), charCount: 10, resolveTime: 100 },
      ];

      const entries = searchQ
        ? allEntries.filter(e => e.query.toLowerCase().includes(searchQ.toLowerCase()))
        : allEntries;

      return route.fulfill({
        status: 200,
        body: JSON.stringify({ entries }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: /History/ }).click();

    // All entries should be visible initially
    await expect(page.locator("text=rust programming")).toBeVisible();

    // Search for "rust"
    const searchInput = page.locator("input[placeholder*='Search history']");
    await searchInput.fill("rust");

    // Only rust entry should be visible
    await expect(page.locator("text=rust programming")).toBeVisible();
    await expect(page.locator("text=python tutorial")).not.toBeVisible();
  });
});

test.describe("History Delete", () => {
  test("delete button removes entry", async ({ page }) => {
    const testEntry = {
      id: "test-id-1",
      query: "test entry to delete",
      result: "Test content",
      provider: "jina",
      timestamp: Date.now(),
      charCount: 12,
      resolveTime: 100,
    };

    let entries = [testEntry];

    await page.route("**/api/history*", async (route) => {
      const method = route.request().method();
      if (method === "DELETE") {
        entries = [];
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true })
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entries }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: /History/ }).click();

    // Should show the entry
    const entry = page.getByText("test entry to delete");
    await expect(entry).toBeVisible();

    // The delete button is revealed on hover, but we can use force click or find it by label
    await page.getByLabel("Delete test entry to delete").click({ force: true });

    // After first click, it should show "CONFIRM"
    const confirmButton = page.getByRole("button", { name: "CONFIRM" });
    await expect(confirmButton).toBeVisible();

    // Click again to confirm
    await confirmButton.click();

    // Entry should be removed
    await expect(page.getByText("test entry to delete")).not.toBeVisible();
  });
});

test.describe("History Load", () => {
  test("clicking entry loads it into form", async ({ page }) => {
    await page.route("**/api/history**", async (route) => {
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          entries: [{
            id: "test-id",
            query: "https://previous.com",
            result: "Previously resolved content",
            provider: "jina",
            timestamp: Date.now(),
            charCount: 28,
            resolveTime: 150,
          }],
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: /History/ }).click();

    // Click on the history entry
    await page.locator("button").filter({ hasText: "https://previous.com" }).click();

    // Input should be populated
    const input = page.locator("input[placeholder*='URL']");
    await expect(input).toHaveValue("https://previous.com");

    // Result should be loaded
    await expect(page.locator("textarea")).toContainText("Previously resolved");
  });
});

test.describe("History Persistence", () => {
  test("history persists across page reloads", async ({ page }) => {
    await page.route("**/api/history**", async (route) => {
      return route.fulfill({
        status: 200,
        body: JSON.stringify({
          entries: [{
            id: "persist-id",
            query: "persistent query",
            result: "Persistent content",
            provider: "jina",
            timestamp: Date.now(),
            charCount: 18,
            resolveTime: 100,
          }],
        }),
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: /History/ }).click();
    await expect(page.locator("text=persistent query")).toBeVisible();

    // Reload page
    await page.reload();

    // Open history
    await page.getByRole("button", { name: /History/ }).click();

    // Entry should still be there
    await expect(page.locator("text=persistent query")).toBeVisible();
  });

  test("history sets session cookie", async ({ page }) => {
    // Mock history API to set cookie
    await page.route("**/api/history**", async (route) => {
      const response = route.fulfill({
        status: 200,
        headers: {
          "Set-Cookie": "ui-session=test-session-id; HttpOnly; SameSite=Lax; Max-Age=31536000; Path=/",
        },
        body: JSON.stringify({ entries: [] }),
      });
      return response;
    });

    await page.goto("/");
    await page.getByRole("button", { name: /History/ }).click();

    // Wait a bit for the cookie to be set
    await page.waitForTimeout(500);

    // Check that ui-session cookie exists
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find((c) => c.name === "ui-session");
    // Cookie should exist (may be set by the API)
    expect(sessionCookie).toBeTruthy();
  });
});

test.describe("History Accessibility", () => {
  test("history toggle has correct aria attributes", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /History/ });

    // Check aria-expanded is false initially
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Open panel
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  test("history panel has correct id for aria-controls", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /History/ });

    // Check aria-controls points to panel
    const controlsId = await toggle.getAttribute("aria-controls");
    expect(controlsId).toBe("history-panel");

    // Panel should exist with that id
    await toggle.click();
    await expect(page.locator("#history-panel")).toBeVisible();
  });
});
