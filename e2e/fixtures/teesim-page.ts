import { type Page, type Locator } from '@playwright/test';

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
    await this.page.goto('/');
    /* Wait for the app shell to mount — look for any pane. */
    await this.centerPane.waitFor({ state: 'visible', timeout: 30_000 });
  }

  /** Navigate and also wait for a case to finish loading. */
  async gotoWithCaseLoaded() {
    await this.goto();
    /* Wait for the 3D canvas to be present (case loaded). */
    await this.threeDCanvas.waitFor({ state: 'visible', timeout: 30_000 });
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
    const box = await slider.boundingBox();
    if (!box) throw new Error('Slider not visible');
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + deltaX, startY, { steps: 10 });
    await this.page.mouse.up();
  }

  /* ---- Canvas inspection ---- */

  /**
   * Returns true if a canvas element has any non-zero pixel data,
   * indicating that something has been rendered.
   */
  async canvasHasContent(canvas: Locator): Promise<boolean> {
    return canvas.evaluate((el: HTMLCanvasElement) => {
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
