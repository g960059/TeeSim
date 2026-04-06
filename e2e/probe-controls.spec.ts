import { test, expect } from '@playwright/test';
import { TeeSimPage } from './fixtures/teesim-page';

/**
 * Probe control tests.
 *
 * Validates the 5-DOF probe sliders, keyboard shortcuts, and
 * anchor-view preset buttons (ADR-0001 sections 3, 5, 12).
 *
 * ProbePose DOFs: sMm, rollDeg, anteDeg, lateralDeg, omniplaneDeg.
 */

test.describe('Probe sliders are visible', () => {
  test.skip(true, 'Probe controls not yet implemented — lights up when src/ui/probe-controls ships');

  test('all 5 DOF sliders are rendered', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    await expect(app.sliderS).toBeVisible();
    await expect(app.sliderRoll).toBeVisible();
    await expect(app.sliderAnte).toBeVisible();
    await expect(app.sliderLateral).toBeVisible();
    await expect(app.sliderOmniplane).toBeVisible();
  });
});

test.describe('Probe slider interaction', () => {
  test.skip(true, 'Probe controls not yet implemented — lights up when probe state + slider wiring ships');

  test('moving s slider updates the probe position display', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    const valueBefore = await app.getSliderValue('s');

    /* Drag the s slider to the right by 50 pixels. */
    await app.dragSlider(app.sliderS, 50);

    const valueAfter = await app.getSliderValue('s');
    expect(valueAfter).not.toEqual(valueBefore);
  });
});

test.describe('Keyboard shortcuts', () => {
  test.skip(true, 'Keyboard shortcuts not yet implemented — lights up when src/ui/keyboard-handler ships');

  test('arrow up increases s position', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    const valueBefore = await app.getSliderValue('s');

    await page.keyboard.press('ArrowUp');

    const valueAfter = await app.getSliderValue('s');
    expect(parseFloat(valueAfter)).toBeGreaterThan(parseFloat(valueBefore));
  });

  test('arrow down decreases s position', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    /* Move to a mid-range position first so there is room to go down. */
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowUp');
    }

    const valueBefore = await app.getSliderValue('s');

    await page.keyboard.press('ArrowDown');

    const valueAfter = await app.getSliderValue('s');
    expect(parseFloat(valueAfter)).toBeLessThan(parseFloat(valueBefore));
  });
});

test.describe('Preset buttons', () => {
  test.skip(true, 'Preset buttons not yet implemented — lights up when view presets ship');

  const requiredPresets = [
    { id: 'me-4c', label: 'ME 4C' },
    { id: 'me-2c', label: 'ME 2C' },
    { id: 'me-lax', label: 'ME LAX' },
    { id: 'tg-sax', label: 'TG SAX' },
    { id: 'me-av-sax', label: 'ME AV SAX' },
    { id: 'me-av-lax', label: 'ME AV LAX' },
    { id: 'me-rv-io', label: 'ME RV I-O' },
    { id: 'me-bicaval', label: 'ME Bicaval' },
  ] as const;

  for (const preset of requiredPresets) {
    test(`preset button exists: ${preset.label}`, async ({ page }) => {
      const app = new TeeSimPage(page);
      await app.gotoWithCaseLoaded();

      const btn = page.getByTestId(`preset-${preset.id}`);
      await expect(btn).toBeVisible();
    });
  }

  test('clicking ME 4C preset updates probe position sliders', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    /* Record initial slider values. */
    const sBefore = await app.getSliderValue('s');
    const omniplaneBefore = await app.getSliderValue('omniplane');

    /* Click the ME 4C preset. */
    await app.clickPreset('me-4c');

    /*
     * At least one DOF should have changed.
     * ME 4C is at a specific sMm + slight retroflexion; the
     * omniplane angle should be near 0 degrees.
     */
    const sAfter = await app.getSliderValue('s');
    const omniplaneAfter = await app.getSliderValue('omniplane');

    const somethingChanged = sAfter !== sBefore || omniplaneAfter !== omniplaneBefore;
    expect(somethingChanged).toBe(true);
  });
});
