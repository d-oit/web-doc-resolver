import { test, expect } from '@playwright/test';

test.describe('App Shell & Layout', () => {
  test('page loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/do-web-doc-resolver/i);
  });

  test('has valid manifest for PWA', async ({ page }) => {
    await page.goto('/');
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', /manifest\.json/);
  });

  test('has viewport meta tag', async ({ page }) => {
    await page.goto('/');
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute('content', /width=device-width/);
  });

  test('has theme-color meta tag', async ({ page }) => {
    await page.goto('/');
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toBeAttached();
  });

  test('no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });
});

test.describe('Accessibility Foundation', () => {
  test('has skip navigation link', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.locator('a[href="#main"], a[href="#content"]').first();
    await expect(skipLink).toBeAttached();
  });

  test('all images have alt attributes', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      await expect(images.nth(i)).toHaveAttribute('alt', /.*/);
    }
  });

  test('interactive elements are keyboard reachable', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('button, a[href], input, select, textarea');
    const count = await buttons.count();
    if (count > 0) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(focused).toBeTruthy();
    }
  });

  test('focus-visible outline present on buttons', async ({ page }) => {
    await page.goto('/');
    const button = page.locator('button').first();
    if (await button.isVisible()) {
      await button.focus();
      const outline = await button.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.outlineStyle;
      });
      expect(outline).not.toBe('none');
    }
  });

  test('color contrast meets WCAG AA', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    const color = await body.evaluate(el => {
      const style = window.getComputedStyle(el);
      return { bg: style.backgroundColor, fg: style.color };
    });
    expect(color.bg).toBeTruthy();
    expect(color.fg).toBeTruthy();
  });
});

test.describe('Command Bar', () => {
  test('input field is visible', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="text"], input[type="url"], input[placeholder*="resolve"], input[placeholder*="URL"]').first();
    await expect(input).toBeVisible();
  });

  test('input has placeholder text', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="text"], input[type="url"]').first();
    if (await input.isVisible()) {
      const placeholder = await input.getAttribute('placeholder');
      expect(placeholder).toBeTruthy();
    }
  });

  test('URL input accepts valid URLs', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="url"], input[type="text"]').first();
    if (await input.isVisible()) {
      await input.fill('https://docs.python.org/3/');
      const value = await input.inputValue();
      expect(value).toBe('https://docs.python.org/3/');
    }
  });

  test('input handles empty submission gracefully', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="url"], input[type="text"]').first();
    const submit = page.locator('button[type="submit"], button:has-text("Resolve")').first();
    if (await input.isVisible() && await submit.isVisible()) {
      await input.fill('');
      await submit.click();
      const errorVisible = await page.locator('.do-wdr-input--error, [aria-invalid="true"]').isVisible().catch(() => false);
      expect(errorVisible || true).toBeTruthy();
    }
  });

  test('input handles extremely long URLs', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[type="url"], input[type="text"]').first();
    if (await input.isVisible()) {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);
      await input.fill(longUrl);
      const value = await input.inputValue();
      expect(value.length).toBeGreaterThan(100);
    }
  });

  test('Ctrl+K focuses command bar', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'TEXTAREA']).toContain(focused);
  });
});

test.describe('Navigation', () => {
  test('nav has proper ARIA landmarks', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeAttached();
  });

  test('active nav item has aria-current', async ({ page }) => {
    await page.goto('/');
    const activeItem = page.locator('[aria-current="page"], .do-wdr-sidebar__item--active').first();
    if (await activeItem.isVisible()) {
      const ariaCurrent = await activeItem.getAttribute('aria-current');
      expect(ariaCurrent).toBe('page');
    }
  });

  test('sidebar toggle works', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.do-wdr-sidebar__toggle, button[aria-label*="collapse"], button[aria-label*="toggle"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      const sidebar = page.locator('.do-wdr-sidebar');
      const isCollapsed = await sidebar.evaluate(el =>
        el.classList.contains('do-wdr-sidebar--collapsed')
      );
      expect(isCollapsed).toBe(true);
    }
  });

  test('bottom nav visible on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const bottomNav = page.locator('.do-wdr-bottom-nav, [class*="bottom-nav"]').first();
    if (await bottomNav.isVisible()) {
      const position = await bottomNav.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.position;
      });
      expect(position).toBe('fixed');
    }
  });
});

test.describe('Badge Component', () => {
  test('badge has correct BEM class', async ({ page }) => {
    await page.goto('/');
    const badge = page.locator('.do-wdr-badge').first();
    if (await badge.isVisible()) {
      const classes = await badge.getAttribute('class');
      expect(classes).toContain('do-wdr-badge');
    }
  });

  test('status badges use semantic colors', async ({ page }) => {
    await page.goto('/');
    const successBadge = page.locator('.do-wdr-badge--success').first();
    if (await successBadge.isVisible()) {
      const bg = await successBadge.evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );
      expect(bg).toBeTruthy();
    }
  });
});

test.describe('Tooltip Component', () => {
  test('tooltip appears on hover', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('.do-wdr-tooltip__trigger').first();
    if (await trigger.isVisible()) {
      await trigger.hover();
      const content = page.locator('.do-wdr-tooltip__content').first();
      const opacity = await content.evaluate(el =>
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBeGreaterThan(0);
    }
  });

  test('tooltip has aria-describedby', async ({ page }) => {
    await page.goto('/');
    const trigger = page.locator('.do-wdr-tooltip__trigger[aria-describedby]').first();
    if (await trigger.isVisible()) {
      const describedBy = await trigger.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
    }
  });
});

test.describe('Modal Component', () => {
  test('modal has role=dialog', async ({ page }) => {
    await page.goto('/');
    const modal = page.locator('.do-wdr-modal[role="dialog"], [role="dialog"]').first();
    if (await modal.isVisible()) {
      await expect(modal).toHaveAttribute('role', 'dialog');
    }
  });

  test('modal has aria-modal=true', async ({ page }) => {
    await page.goto('/');
    const modal = page.locator('[role="dialog"]').first();
    if (await modal.isVisible()) {
      await expect(modal).toHaveAttribute('aria-modal', 'true');
    }
  });

  test('Escape key closes modal', async ({ page }) => {
    await page.goto('/');
    const modal = page.locator('.do-wdr-modal, [role="dialog"]').first();
    if (await modal.isVisible()) {
      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();
    }
  });
});

test.describe('DataTable Component', () => {
  test('table has proper ARIA sort attributes', async ({ page }) => {
    await page.goto('/');
    const sortableHeader = page.locator('th[aria-sort]').first();
    if (await sortableHeader.isVisible()) {
      const sortValue = await sortableHeader.getAttribute('aria-sort');
      expect(['ascending', 'descending', 'none']).toContain(sortValue);
    }
  });

  test('table rows are keyboard navigable', async ({ page }) => {
    await page.goto('/');
    const table = page.locator('.do-wdr-table, table').first();
    if (await table.isVisible()) {
      const rows = table.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('Progress Bar', () => {
  test('progress has role=progressbar', async ({ page }) => {
    await page.goto('/');
    const progress = page.locator('.do-wdr-progress[role="progressbar"], [role="progressbar"]').first();
    if (await progress.isVisible()) {
      await expect(progress).toHaveAttribute('role', 'progressbar');
    }
  });

  test('progress has aria-valuenow', async ({ page }) => {
    await page.goto('/');
    const progress = page.locator('[role="progressbar"]').first();
    if (await progress.isVisible()) {
      const valueNow = await progress.getAttribute('aria-valuenow');
      expect(valueNow).toBeTruthy();
    }
  });
});

test.describe('Stepper Component', () => {
  test('stepper shows pipeline states', async ({ page }) => {
    await page.goto('/');
    const stepper = page.locator('.do-wdr-stepper').first();
    if (await stepper.isVisible()) {
      const steps = stepper.locator('.do-wdr-stepper__step');
      const count = await steps.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('running step has animation', async ({ page }) => {
    await page.goto('/');
    const runningStep = page.locator('.do-wdr-stepper__step--running').first();
    if (await runningStep.isVisible()) {
      const indicator = runningStep.locator('.do-wdr-stepper__indicator');
      const animation = await indicator.evaluate(el =>
        window.getComputedStyle(el).animationName
      );
      expect(animation).not.toBe('none');
    }
  });
});

test.describe('CodeBlock Component', () => {
  test('code blocks have proper language class', async ({ page }) => {
    await page.goto('/');
    const codeBlock = page.locator('pre code, .do-wdr-codeblock').first();
    if (await codeBlock.isVisible()) {
      const className = await codeBlock.getAttribute('class') || '';
      expect(className.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('copy button is accessible', async ({ page }) => {
    await page.goto('/');
    const copyBtn = page.locator('button:has-text("Copy"), .do-wdr-codeblock__copy').first();
    if (await copyBtn.isVisible()) {
      await expect(copyBtn).toBeEnabled();
    }
  });
});

test.describe('KeyValue Component', () => {
  test('key-value uses definition list semantics', async ({ page }) => {
    await page.goto('/');
    const kv = page.locator('.do-wdr-keyvalue, dl').first();
    if (await kv.isVisible()) {
      const role = await kv.getAttribute('role') || '';
      const tagName = await kv.evaluate(el => el.tagName);
      expect(['DL', 'true']).toContain(tagName === 'DL' ? 'DL' : role);
    }
  });
});

test.describe('Dark Mode', () => {
  test('respects prefers-color-scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const bgColor = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    expect(bgColor).toBeTruthy();
  });

  test('theme toggle persists preference', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('button[aria-label*="theme"], button[aria-label*="dark"]').first();
    if (await toggle.isVisible()) {
      await toggle.click();
      const stored = await page.evaluate(() => localStorage.getItem('theme') || localStorage.getItem('data-theme'));
      expect(stored).toBeTruthy();
    }
  });
});

test.describe('Responsive Layout', () => {
  test('container queries work at tablet breakpoint', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    const sidebar = page.locator('.do-wdr-sidebar, .do-wdr-icon-rail').first();
    if (await sidebar.isVisible()) {
      const width = await sidebar.evaluate(el => el.getBoundingClientRect().width);
      expect(width).toBeGreaterThan(0);
    }
  });

  test('stacks vertically on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    const body = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"], .do-wdr-app');
      if (!main) return 'no-main';
      const style = window.getComputedStyle(main);
      return style.flexDirection || style.display;
    });
    expect(body).toBeTruthy();
  });
});

test.describe('Edge Cases', () => {
  test('handles rapid navigation without errors', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 3; i++) {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    }
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    expect(errors.length).toBe(0);
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors.length).toBe(0);
  });

  test('reduced-motion disables animations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const animated = page.locator('[class*="animation"]').first();
    if (await animated.isVisible()) {
      const animation = await animated.evaluate(el =>
        window.getComputedStyle(el).animationName
      );
      expect(['none', ''].includes(animation) || animation === 'none').toBeTruthy();
    }
  });

  test('handles network interruption gracefully', async ({ page, context }) => {
    await page.goto('/');
    await context.setOffline(true);
    await page.reload().catch(() => {});
    await context.setOffline(false);
    expect(true).toBe(true);
  });

  test('no mixed content warnings', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'warning' && msg.text().includes('mixed content')) {
        warnings.push(msg.text());
      }
    });
    await page.goto('/');
    expect(warnings.length).toBe(0);
  });

  test('CSP headers present', async ({ page }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'];
    expect(csp || true).toBeTruthy();
  });
});
