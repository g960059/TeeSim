import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page-object model for the TeeSim application.
 *
 * Centralises selectors so that individual spec files stay
 * resilient to markup changes. Selectors use data-testid where
 * possible; fall back to accessible roles / labels.
 */
export class TeeSimPage {
  readonly page: Page;

  /* ---- Layout panes ---- */
  readonly leftPane: Locator;
  readonly centerPane: Locator;
  readonly rightPane: Locator;
  readonly probeControlDock: Locator;

  /* ---- Probe sliders ---- */
  readonly sliderS: Locator;
  readonly sliderRoll: Locator;
  readonly sliderAnte: Locator;
  readonly sliderLateral: Locator;
  readonly sliderOmniplane: Locator;

  /* ---- Probe position display ---- */
  readonly probePositionDisplay: Locator;

  /* ---- Case selector ---- */
  readonly caseSelector: Locator;
  readonly loadingIndicator: Locator;

  /* ---- View matching indicator ---- */
  readonly viewMatchIndicator: Locator;

  /* ---- Pseudo-TEE pane ---- */
  readonly pseudoTeeCanvas: Locator;
  readonly pseudoTeeLabel: Locator;

  /* ---- 3D pane canvas ---- */
  readonly threeDCanvas: Locator;

  /* ---- Preset buttons (anchor views) ---- */
  readonly presetME4C: Locator;
  readonly presetME2C: Locator;
  readonly presetMELAX: Locator;
  readonly presetTGSAX: Locator;
  readonly presetMEAVSAX: Locator;
  readonly presetMEAVLAX: Locator;
  readonly presetMERVIO: Locator;
  readonly presetMEBicaval: Locator;

  constructor(page: Page) {
    this.page = page;

    /* Layout panes */
    this.leftPane = page.getByTestId('pane-left');
    this.centerPane = page.getByTestId('pane-center');
    this.rightPane = page.getByTestId('pane-right');
    this.probeControlDock = page.getByTestId('probe-control-dock');

    /* Probe sliders — identified by data-testid */
    this.sliderS = page.getByTestId('slider-s');
    this.sliderRoll = page.getByTestId('slider-roll');
    this.sliderAnte = page.getByTestId('slider-ante');
    this.sliderLateral = page.getByTestId('slider-lateral');
    this.sliderOmniplane = page.getByTestId('slider-omniplane');

    /* Probe position readout */
    this.probePositionDisplay = page.getByTestId('probe-position-display');

    /* Case selector */
    this.caseSelector = page.getByTestId('case-selector');
    this.loadingIndicator = page.getByTestId('loading-indicator');

    /* View matching */
    this.viewMatchIndicator = page.getByTestId('view-match-indicator');

    /* Pseudo-TEE */
    this.pseudoTeeCanvas = page.getByTestId('pseudo-tee-canvas');
    this.pseudoTeeLabel = page.getByTestId('pseudo-tee-label');

    /* 3D anatomy canvas */
    this.threeDCanvas = page.getByTestId('three-d-canvas');

    /* Preset buttons */
    this.presetME4C = page.getByTestId('preset-me-4c');
    this.presetME2C = page.getByTestId('preset-me-2c');
    this.presetMELAX = page.getByTestId('preset-me-lax');
    this.presetTGSAX = page.getByTestId('preset-tg-sax');
    this.presetMEAVSAX = page.getByTestId('preset-me-av-sax');
    this.presetMEAVLAX = page.getByTestId('preset-me-av-lax');
    this.presetMERVIO = page.getByTestId('preset-me-rv-io');
    this.presetMEBicaval = page.getByTestId('preset-me-bicaval');
  }

  /* ---- Navigation ---- */

  /** Navigate to the app root and wait for the shell to appear. */
  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.centerPane.waitFor({ state: 'visible', timeout: 30_000 });
    await this.caseSelector.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(this.caseSelector).toBeEnabled({ timeout: 30_000 });
  }

  /** Navigate and also wait for a case to finish loading. */
  async gotoWithCaseLoaded() {
    await this.goto();
    await this.waitForLoadingToSettle();
    await this.waitForCanvasReady(this.threeDCanvas);
  }

  async waitForLoadingToSettle(timeout = 45_000) {
    await this.page.waitForFunction(
      () => document.querySelector('[data-testid="loading-indicator"]') === null,
      undefined,
      { timeout },
    );
  }

  async waitForCanvasReady(canvas: Locator, timeout = 45_000) {
    await canvas.waitFor({ state: 'visible', timeout });
    await expect(canvas).toHaveAttribute('data-render-state', 'ready', { timeout });
  }

  async focusShell() {
    await this.centerPane.click({ position: { x: 16, y: 16 } });
  }

  async selectCase(title: string) {
    await this.caseSelector.click();
    await this.page.getByTestId('case-option').filter({ hasText: title }).click();
  }

  /* ---- Slider helpers ---- */

  /**
   * Read the current numeric value shown in the probe position display
   * for a given DOF (e.g. "s", "roll").
   */
  async getSliderValue(dof: 's' | 'roll' | 'ante' | 'lateral' | 'omniplane'): Promise<string> {
    const display = this.page.getByTestId(`slider-value-${dof}`);
    return (await display.textContent()) ?? '';
  }

  /**
   * Drag a slider by a relative pixel offset.
   * This is a coarse helper — for precise values, use keyboard input.
   */
  async dragSlider(
    slider: Locator,
    deltaX: number,
  ) {
    await slider.evaluate((element, direction) => {
      if (!(element instanceof HTMLInputElement)) {
        throw new Error('Slider is not an input element.');
      }

      const step = Number(element.step || 1);
      const min = Number(element.min || 0);
      const max = Number(element.max || 100);
      const current = Number(element.value);
      const increments = Math.max(1, Math.round(Math.abs(direction) / 10));
      const nextValue = Math.min(
        max,
        Math.max(min, current + Math.sign(direction || 1) * step * increments),
      );

      element.value = String(nextValue);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, deltaX);
  }

  /* ---- Canvas inspection ---- */

  /**
   * Returns true if a canvas element has any non-zero pixel data,
   * indicating that something has been rendered.
   */
  async canvasHasContent(canvas: Locator): Promise<boolean> {
    return canvas.evaluate((el: HTMLCanvasElement) => {
      if (el.getAttribute('data-render-state') === 'ready') {
        return true;
      }

      if (el.width === 0 || el.height === 0) {
        return false;
      }

      try {
        const blankCanvas = document.createElement('canvas');
        blankCanvas.width = el.width;
        blankCanvas.height = el.height;
        if (el.toDataURL() !== blankCanvas.toDataURL()) {
          return true;
        }
      } catch {
        // Fall back to raw pixel inspection.
      }

      const ctx = el.getContext('2d') || el.getContext('webgl2') || el.getContext('webgl');
      if (!ctx) return false;

      /* For WebGL contexts, read pixels from the framebuffer. */
      if (ctx instanceof WebGLRenderingContext || ctx instanceof WebGL2RenderingContext) {
        const pixels = new Uint8Array(4 * el.width * el.height);
        ctx.readPixels(0, 0, el.width, el.height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
        return pixels.some((v) => v !== 0);
      }

      /* For 2D contexts, check the image data. */
      const imageData = (ctx as CanvasRenderingContext2D).getImageData(0, 0, el.width, el.height);
      return imageData.data.some((v) => v !== 0);
    });
  }

  /* ---- Preset helpers ---- */

  /** Click a named anchor-view preset button. */
  async clickPreset(
    name:
      | 'me-4c'
      | 'me-2c'
      | 'me-lax'
      | 'tg-sax'
      | 'me-av-sax'
      | 'me-av-lax'
      | 'me-rv-io'
      | 'me-bicaval',
  ) {
    await this.page.getByTestId(`preset-${name}`).click();
  }

  /* ---- View match helpers ---- */

  /** Returns the current view-match status text (e.g. "Match", "Close", ""). */
  async getViewMatchStatus(): Promise<string> {
    return (await this.viewMatchIndicator.textContent()) ?? '';
  }

  /** Returns the dominant colour class on the view-match indicator. */
  async getViewMatchColor(): Promise<string | null> {
    return this.viewMatchIndicator.evaluate((el) => {
      /* Check for data-match-level or common CSS class patterns. */
      return el.getAttribute('data-match-level');
    });
  }
}
