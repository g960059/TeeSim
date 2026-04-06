import { test, expect } from '@playwright/test';
import { TeeSimPage } from './fixtures/teesim-page';

/**
 * Smoke tests: verify the application shell loads and the 3-pane
 * layout (ADR-0001 section 11) is present in the DOM.
 *
 * These tests are the first to light up — they require only the
 * Vite dev server and a minimal React mount.
 */

test.describe('App shell loads', () => {
  test.skip(true, 'App shell not yet implemented — lights up when src/ui/ ships the layout');

  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('3-pane layout is visible (left, center, right)', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.goto();

    await expect(app.leftPane).toBeVisible();
    await expect(app.centerPane).toBeVisible();
    await expect(app.rightPane).toBeVisible();
  });

  test('probe control dock is visible at bottom', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.goto();

    await expect(app.probeControlDock).toBeVisible();
  });
});
