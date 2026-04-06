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
  test.skip(true, 'Pseudo-TEE pane not yet implemented — lights up when src/renderer/pseudo-tee ships');

  test('pseudo-TEE pane renders a sector-shaped image (canvas is not blank)', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

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

    /*
     * Capture a pixel snapshot before moving the probe.
     * We sample a few pixels from the center of the canvas.
     */
    const pixelsBefore = await app.pseudoTeeCanvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d') || el.getContext('webgl2') || el.getContext('webgl');
      if (!ctx) return null;

      if (ctx instanceof WebGLRenderingContext || ctx instanceof WebGL2RenderingContext) {
        const cx = Math.floor(el.width / 2);
        const cy = Math.floor(el.height / 2);
        const pixels = new Uint8Array(4);
        ctx.readPixels(cx, cy, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
        return Array.from(pixels);
      }

      const cx = Math.floor(el.width / 2);
      const cy = Math.floor(el.height / 2);
      const imageData = (ctx as CanvasRenderingContext2D).getImageData(cx, cy, 1, 1);
      return Array.from(imageData.data);
    });

    /* Move the probe position substantially. */
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowUp');
    }

    /* Allow a frame or two for VTK.js to re-render. */
    await page.waitForTimeout(500);

    const pixelsAfter = await app.pseudoTeeCanvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d') || el.getContext('webgl2') || el.getContext('webgl');
      if (!ctx) return null;

      if (ctx instanceof WebGLRenderingContext || ctx instanceof WebGL2RenderingContext) {
        const cx = Math.floor(el.width / 2);
        const cy = Math.floor(el.height / 2);
        const pixels = new Uint8Array(4);
        ctx.readPixels(cx, cy, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
        return Array.from(pixels);
      }

      const cx = Math.floor(el.width / 2);
      const cy = Math.floor(el.height / 2);
      const imageData = (ctx as CanvasRenderingContext2D).getImageData(cx, cy, 1, 1);
      return Array.from(imageData.data);
    });

    /*
     * The pixel values should differ after moving the probe.
     * This is a coarse check — a more robust approach would
     * compare a hash of the full canvas, but this suffices for MVP.
     */
    expect(pixelsAfter).not.toEqual(pixelsBefore);
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
