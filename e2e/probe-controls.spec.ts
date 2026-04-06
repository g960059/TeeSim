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

const LCTSC_ME_4C_POSE = {
  ante: '-5',
  lateral: '0',
  omniplane: '0',
  roll: '0',
  s: '97',
} as const;

test.describe('Probe sliders are visible', () => {
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
  test('moving s slider updates the probe position display', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();

    const valueBefore = await app.getSliderValue('s');

    // Use keyboard to reliably change the slider value via React's controlled input
    await app.sliderS.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    const valueAfter = await app.getSliderValue('s');
    expect(valueAfter).not.toEqual(valueBefore);
  });
});

test.describe('Keyboard shortcuts', () => {
  test('arrow up increases s position', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();
    await app.focusShell();

    const valueBefore = await app.getSliderValue('s');

    await page.keyboard.press('ArrowUp');

    const valueAfter = await app.getSliderValue('s');
    expect(parseFloat(valueAfter)).toBeGreaterThan(parseFloat(valueBefore));
  });

  test('arrow down decreases s position', async ({ page }) => {
    const app = new TeeSimPage(page);
    await app.gotoWithCaseLoaded();
    await app.focusShell();

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
    await expect(app.caseSelector).toContainText('LCTSC S1-006');

    /* Click the ME 4C preset. */
    await app.clickPreset('me-4c');

    await expect.poll(() => app.getSliderValue('s')).toBe(LCTSC_ME_4C_POSE.s);
    await expect.poll(() => app.getSliderValue('roll')).toBe(LCTSC_ME_4C_POSE.roll);
    await expect.poll(() => app.getSliderValue('ante')).toBe(LCTSC_ME_4C_POSE.ante);
    await expect.poll(() => app.getSliderValue('lateral')).toBe(LCTSC_ME_4C_POSE.lateral);
    await expect.poll(() => app.getSliderValue('omniplane')).toBe(LCTSC_ME_4C_POSE.omniplane);
  });
});
