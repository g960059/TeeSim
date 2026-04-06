import { test, expect } from '@playwright/test';
import { TeeSimPage } from './fixtures/teesim-page';

/**
 * View matching indicator tests.
 *
 * ADR-0001 section 12: weighted 5-DOF distance scoring.
 *   green  -> score >= 0.85 ("Match")
 *   amber  -> score 0.60-0.84 ("Close")
 *   gray   -> score < 0.60 (no match)
 *
 * MVP scoring is a "nearest preset indicator" — simple 5-DOF
 * distance only. Structure-visibility checks are Phase 1.5.
 */

test.describe('View match indicator', () => {
  test.skip(true, 'View matching not yet implemented — lights up when src/education/view-scoring ships');

  test('view match indicator is visible', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    await expect(app.viewMatchIndicator).toBeVisible();
  });

  test('after clicking ME 4C preset, indicator shows green Match state', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    /* Navigate directly to the ME 4C preset. */
    await app.clickPreset('me-4c');

    /*
     * The indicator should show "Match" with a green level.
     * When the probe is exactly at a preset position, the 5-DOF
     * distance is zero, so score should be >= 0.85.
     */
    const matchLevel = await app.getViewMatchColor();
    expect(matchLevel).toBe('green');

    const statusText = await app.getViewMatchStatus();
    expect(statusText).toContain('Match');
  });

  test('after manual probe manipulation away from preset, indicator changes to amber or gray', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    /* Start at the ME 4C preset (green). */
    await app.clickPreset('me-4c');
    const initialLevel = await app.getViewMatchColor();
    expect(initialLevel).toBe('green');

    /*
     * Move the probe substantially away from the preset.
     * Pressing ArrowUp many times should shift s far enough
     * to break the match.
     */
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowUp');
    }

    /* Also rotate the omniplane substantially. */
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('ArrowRight');
    }

    const afterLevel = await app.getViewMatchColor();
    expect(afterLevel).not.toBe('green');
    expect(['amber', 'gray']).toContain(afterLevel);
  });
});
