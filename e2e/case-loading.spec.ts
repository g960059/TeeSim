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
  test.skip(true, 'Case loading not yet implemented — lights up when src/assets/ loader and case selector ship');

  test('case selector is visible', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.goto();

    await expect(app.caseSelector).toBeVisible();
  });

  test('selecting a case shows loading indicator', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.goto();

    /* Open the case selector and pick the first available case. */
    await app.caseSelector.click();
    const firstCase = page.getByTestId('case-option').first();
    await firstCase.click();

    /* A loading indicator should appear while the VTI is fetched. */
    const loadingIndicator = page.getByTestId('loading-indicator');
    await expect(loadingIndicator).toBeVisible();
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
