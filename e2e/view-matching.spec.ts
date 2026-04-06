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

const presetSequence = [
  'me-4c',
  'me-2c',
  'me-lax',
  'tg-sax',
  'me-av-sax',
  'me-av-lax',
  'me-rv-io',
  'me-bicaval',
] as const;

test.describe('View match indicator', () => {
  test('view match indicator is visible', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    await expect(app.viewMatchIndicator).toBeVisible();
  });

  test('each preset click shows a green Match state', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();
    await expect(app.caseSelector).toContainText('LCTSC S1-006');

    for (const preset of presetSequence) {
      await app.clickPreset(preset);
      await expect(app.viewMatchIndicator).toHaveAttribute('data-match-level', 'green');
      await expect(app.viewMatchIndicator).toContainText('Match');

      if (preset === 'me-4c') {
        await page.screenshot({ fullPage: true, path: 'screenshots/e2e-me4c-preset.png' });
      }
    }
  });

  test('after manual probe manipulation away from preset, indicator changes to amber or gray', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();
    await app.focusShell();

    /* Start at the ME 4C preset (green). */
    await app.clickPreset('me-4c');
    await expect(app.viewMatchIndicator).toHaveAttribute('data-match-level', 'green');

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
