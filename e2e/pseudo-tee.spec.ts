import { test, expect } from '@playwright/test';
import { TeeSimPage } from './fixtures/teesim-page';

/**
 * Pseudo-TEE pane tests.
 *
 * ADR-0001 section 7: "Sectorized Anatomical Slice", not ultrasound.
 * The pseudo-TEE pane produces a sector-shaped CT-derived cross-section.
 *
 * Minimum viable rendering:
 *   1. Oblique reslice from heart_roi.vti via VTK.js
 *   2. Sector wedge mask (fan shape)
 *   3. Depth-dependent grayscale attenuation
 *   4. Thick-slab reslice (~3-5 mm)
 */

test.describe('Pseudo-TEE rendering', () => {
  test('pseudo-TEE pane renders a sector-shaped image (canvas is not blank)', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();
    await app.waitForCanvasReady(app.pseudoTeeCanvas);

    await expect(app.pseudoTeeCanvas).toBeVisible();

    /*
     * The pseudo-TEE canvas should have rendered content.
     * After a case is loaded and the probe is positioned, VTK.js
     * performs an oblique reslice and applies a sector mask.
     */
    const hasContent = await app.canvasHasContent(app.pseudoTeeCanvas);
    expect(hasContent).toBe(true);
  });

  test('changing probe position updates the pseudo-TEE image', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();
    await app.waitForCanvasReady(app.pseudoTeeCanvas);
    await app.focusShell();

    const imageBefore = await app.pseudoTeeCanvas.screenshot();

    /* Move the probe position substantially. */
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowUp');
    }

    /* Allow a frame or two for VTK.js to re-render. */
    await page.waitForTimeout(500);
    await app.waitForCanvasReady(app.pseudoTeeCanvas);

    const imageAfter = await app.pseudoTeeCanvas.screenshot();
    expect(imageAfter.equals(imageBefore)).toBe(false);
  });

  test('"CT-derived anatomical slice" label is visible (not "ultrasound")', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    /*
     * ADR-0001 section 7 [REV]: The UI must label the pseudo-TEE
     * pane as "CT-derived anatomical slice" or similar — never
     * "ultrasound". This sets correct trainee expectations.
     */
    await expect(app.pseudoTeeLabel).toBeVisible();

    const labelText = await app.pseudoTeeLabel.textContent();
    expect(labelText?.toLowerCase()).toContain('ct-derived');
    expect(labelText?.toLowerCase()).not.toContain('ultrasound');
  });
});
