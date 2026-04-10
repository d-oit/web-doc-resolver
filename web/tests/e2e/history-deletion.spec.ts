import { test, expect } from '@playwright/test';

test.describe('History deletion confirmation', () => {
  test.beforeEach(async ({ page }) => {
    // Add some history
    await page.goto('/');
    await page.fill('input[placeholder="URL or search query..."]', 'test query');

    // Mock the API response to avoid needing actual API keys/backend
    await page.route('/api/resolve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          markdown: 'test result',
          provider: 'test-provider',
          quality: { score: 100 }
        })
      });
    });

    await page.click('button:has-text("Fetch")');
    await expect(page.locator('textarea')).toHaveValue('test result');
  });

  test('requires two clicks to delete history entry', async ({ page, viewport }) => {
    // Open sidebar on mobile if needed
    if (viewport && viewport.width < 1024) {
      await page.click('button[aria-label="Open menu"]');
    }

    // Open history
    await page.click('button:has-text("History")');

    const historyItem = page.locator('div.group').first();
    await expect(historyItem).toBeVisible();

    const deleteButton = historyItem.locator('button:has-text("×")');

    // First click should change to "CONFIRM"
    await deleteButton.click();
    await expect(historyItem.locator('button:has-text("CONFIRM")')).toBeVisible();

    // Second click should delete it (mocking the delete API)
    await page.route('/api/history*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 200 });
      } else {
        await route.continue();
      }
    });

    await historyItem.locator('button:has-text("CONFIRM")').click();
    await expect(historyItem).not.toBeVisible();
  });

  test('resets to × after timeout', async ({ page, viewport }) => {
    // Open sidebar on mobile if needed
    if (viewport && viewport.width < 1024) {
      await page.click('button[aria-label="Open menu"]');
    }

    // Open history
    await page.click('button:has-text("History")');

    const historyItem = page.locator('div.group').first();
    const deleteButton = historyItem.locator('button:has-text("×")');

    // First click
    await deleteButton.click();
    await expect(historyItem.locator('button:has-text("CONFIRM")')).toBeVisible();

    // Wait for timeout (3 seconds + buffer)
    await page.waitForTimeout(3500);

    await expect(historyItem.locator('button:has-text("×")')).toBeVisible();
    await expect(historyItem.locator('button:has-text("CONFIRM")')).not.toBeVisible();
  });
});
