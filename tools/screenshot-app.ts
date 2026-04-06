/**
 * Standalone Playwright script to capture screenshots of the TeeSim app
 * at various states for visual inspection and documentation.
 *
 * Usage:
 *   npx playwright test --config=playwright.config.ts   (for e2e suite)
 *   npx tsx tools/screenshot-app.ts                     (for this script)
 *
 * Requires the dev server to be running on http://localhost:5173.
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve(import.meta.dirname, '..', 'screenshots');

interface ConsoleEntry {
  type: string;
  text: string;
}

async function main() {
  // Ensure screenshot directory exists
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const consoleMessages: ConsoleEntry[] = [];
  const pageErrors: string[] = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Collect console messages and page errors
  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  try {
    // --- Screenshot 1: Initial load ---
    console.log('Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30_000 });
    // Give renderers a moment to settle
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-initial-load.png'),
      fullPage: true,
    });
    console.log('Saved: 01-initial-load.png');

    // --- DOM inspection ---
    const domSnapshot = await page.evaluate(() => {
      const root = document.getElementById('root');
      const testIdEls = document.querySelectorAll('[data-testid]');
      return {
        rootChildCount: root?.childElementCount ?? 0,
        rootInnerHTMLLength: root?.innerHTML.length ?? 0,
        testIds: Array.from(testIdEls).map((el) => ({
          testId: el.getAttribute('data-testid'),
          tagName: el.tagName,
          visible: el.getBoundingClientRect().height > 0,
        })),
        hasViteOverlay: !!document.querySelector('vite-error-overlay'),
      };
    });
    console.log('DOM snapshot:', JSON.stringify(domSnapshot, null, 2));

    // --- Screenshot 2: Three-pane layout ---
    const paneLeft = page.getByTestId('pane-left');
    const paneCenter = page.getByTestId('pane-center');
    const paneRight = page.getByTestId('pane-right');
    const leftVisible = await paneLeft.isVisible().catch(() => false);
    const centerVisible = await paneCenter.isVisible().catch(() => false);
    const rightVisible = await paneRight.isVisible().catch(() => false);

    if (leftVisible && centerVisible && rightVisible) {
      // Capture the pane-grid parent
      const paneGrid = page.locator('.pane-grid');
      await paneGrid.screenshot({
        path: path.join(SCREENSHOT_DIR, '02-three-pane-layout.png'),
      });
      console.log('Saved: 02-three-pane-layout.png (pane-grid element screenshot)');
    } else {
      console.log(
        `Three panes not visible (left=${leftVisible}, center=${centerVisible}, right=${rightVisible}); taking full page for 02`,
      );
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '02-three-pane-layout.png'),
        fullPage: true,
      });
      console.log('Saved: 02-three-pane-layout.png (full page fallback)');
    }

    // --- Screenshot 3: Probe control dock ---
    const probeControlDock = page.getByTestId('probe-control-dock');
    const dockVisible = await probeControlDock.isVisible().catch(() => false);
    if (dockVisible) {
      await probeControlDock.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-probe-controls.png'),
      });
      console.log('Saved: 03-probe-controls.png (element screenshot)');
    } else {
      console.log('Probe control dock not visible; taking full page for 03');
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-probe-controls.png'),
        fullPage: true,
      });
      console.log('Saved: 03-probe-controls.png (full page fallback)');
    }

    // --- Screenshot 4: After slider move ---
    const sliderS = page.getByTestId('slider-s');
    const sliderVisible = await sliderS.isVisible().catch(() => false);
    if (sliderVisible) {
      const box = await sliderS.boundingBox();
      if (box) {
        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(startX + 80, startY, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
        console.log('Dragged slider-s by 80px');
      }
    } else {
      console.log('Slider not found; trying keyboard ArrowUp');
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('ArrowUp');
      }
      await page.waitForTimeout(500);
    }
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-after-slider-move.png'),
      fullPage: true,
    });
    console.log('Saved: 04-after-slider-move.png');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
    try {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'error-state.png'),
        fullPage: true,
      });
      console.log('Saved: error-state.png');
    } catch {
      console.error('Could not capture error-state screenshot');
    }
  }

  // --- Report collected console messages ---
  console.log('\n=== Console Messages ===');
  for (const msg of consoleMessages) {
    console.log(`  [${msg.type}] ${msg.text}`);
  }

  console.log('\n=== Page Errors ===');
  if (pageErrors.length === 0) {
    console.log('  (none)');
  } else {
    for (const err of pageErrors) {
      console.log(`  ${err}`);
    }
  }

  // Write console log to file for report
  const logPath = path.join(SCREENSHOT_DIR, 'console-log.txt');
  const logContent = [
    '=== Console Messages ===',
    ...consoleMessages.map((m) => `[${m.type}] ${m.text}`),
    '',
    '=== Page Errors ===',
    ...(pageErrors.length > 0 ? pageErrors : ['(none)']),
    '',
    '=== DOM Snapshot ===',
    JSON.stringify(
      await page.evaluate(() => {
        const root = document.getElementById('root');
        return {
          rootChildCount: root?.childElementCount ?? 0,
          rootHTML: root?.innerHTML.substring(0, 500) ?? '',
        };
      }).catch(() => ({ error: 'page already closed' })),
      null,
      2,
    ),
  ].join('\n');
  fs.writeFileSync(logPath, logContent, 'utf-8');
  console.log(`\nConsole log written to: ${logPath}`);

  await browser.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
