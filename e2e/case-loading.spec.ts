import { test, expect } from '@playwright/test';
import { TeeSimPage } from './fixtures/teesim-page';

/**
 * Case loading tests.
 *
 * Verifies the case selector, loading state, and that the 3D pane
 * renders non-blank content after a case is loaded.
 *
 * ADR-0001 section 9: 4 TotalSegmentator CT cases.
 * ADR-0001 section 6: single heart_roi.vti per case.
 */

test.describe('Case loading', () => {
  test('case selector is visible', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.goto();

    await expect(app.caseSelector).toBeVisible();
  });

  test('selecting a case shows loading indicator', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    await page.route('**/cases/0.1.0/ts-001/case_manifest.json', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });

    await app.selectCase('TS-001 Stub Normal Adult');

    await expect(app.loadingIndicator).toBeVisible();
    await expect(app.caseSelector).toContainText('TS-001 Stub Normal Adult', { timeout: 30_000 });
  });

  test('after loading, 3D pane shows rendered content (canvas has non-zero pixels)', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    await expect(app.threeDCanvas).toBeVisible();

    /*
     * Verify the WebGL canvas is not blank.
     * VTK.js renders to a WebGL2 context; we read back pixels.
     */
    const hasContent = await app.canvasHasContent(app.threeDCanvas);
    expect(hasContent).toBe(true);
  });
});
