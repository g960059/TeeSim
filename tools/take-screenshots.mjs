import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(__dirname, '..');
const SCREENSHOTS = join(PROJECT, 'screenshots');
mkdirSync(SCREENSHOTS, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--use-gl=swiftshader'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
const page = await context.newPage();

// Collect console messages and errors
const consoleLogs = [];
const consoleErrors = [];
page.on('console', (msg) => {
  const text = `[${msg.type()}] ${msg.text()}`;
  consoleLogs.push(text);
  if (msg.type() === 'error') consoleErrors.push(text);
});
page.on('pageerror', (err) => {
  consoleErrors.push(`[pageerror] ${err.message}`);
});

console.log('Navigating to http://localhost:5174 ...');
await page.goto('http://localhost:5174', { waitUntil: 'networkidle' });

// Wait for VTK.js to initialize and assets to load
console.log('Waiting 10 seconds for VTK.js init and asset loading...');
await page.waitForTimeout(10000);

// DOM diagnostics
const rootHtml = await page.evaluate(() => {
  const root = document.getElementById('root');
  return root ? root.innerHTML.substring(0, 3000) : 'NO #root ELEMENT';
});
console.log('\n=== DOM ROOT (first 3000 chars) ===');
console.log(rootHtml);

const textContent = await page.evaluate(() => {
  const root = document.getElementById('root');
  return root ? root.textContent?.substring(0, 1500) : 'NO TEXT';
});
console.log('\n=== TEXT CONTENT ===');
console.log(textContent);

// 1) Full page screenshot
console.log('\nTaking full-page screenshot...');
await page.screenshot({ path: join(SCREENSHOTS, 'fix-01-app-loaded.png'), fullPage: true });

// 2) Check if 3-pane layout is visible
const leftPane = page.locator('[data-testid="pane-left"]');
const centerPane = page.locator('[data-testid="pane-center"]');
const rightPane = page.locator('[data-testid="pane-right"]');
const dock = page.locator('[data-testid="probe-control-dock"]');

const leftVisible = await leftPane.isVisible().catch(() => false);
const centerVisible = await centerPane.isVisible().catch(() => false);
const rightVisible = await rightPane.isVisible().catch(() => false);
const dockVisible = await dock.isVisible().catch(() => false);
const leftCount = await leftPane.count();
const centerCount = await centerPane.count();
const rightCount = await rightPane.count();
const dockCount = await dock.count();

console.log(`Pane visibility: left=${leftVisible}(${leftCount}) center=${centerVisible}(${centerCount}) right=${rightVisible}(${rightCount}) dock=${dockVisible}(${dockCount})`);

// Take pane screenshots (even if "not visible" due to zero height, try bounding box)
for (const [name, locator, filename] of [
  ['left', leftPane, 'fix-02-left-pane.png'],
  ['center', centerPane, 'fix-03-center-pane.png'],
  ['right', rightPane, 'fix-04-right-pane.png'],
  ['dock', dock, 'fix-05-probe-controls.png'],
]) {
  try {
    const box = await locator.boundingBox();
    if (box && box.width > 0 && box.height > 0) {
      console.log(`Taking ${name} screenshot (${box.width}x${box.height} at ${box.x},${box.y})...`);
      await locator.screenshot({ path: join(SCREENSHOTS, filename) });
    } else {
      console.log(`${name}: no bounding box or zero size (${JSON.stringify(box)})`);
    }
  } catch (e) {
    console.log(`${name}: screenshot failed: ${e.message}`);
  }
}

// 3) Try clicking a view preset button
const presetButtons = await page.locator('.preset-button').all();
console.log(`Found ${presetButtons.length} preset buttons`);
if (presetButtons.length > 0) {
  const btnText = await presetButtons[0].textContent();
  console.log(`Clicking first preset button: "${btnText}"...`);
  try {
    await presetButtons[0].click({ timeout: 5000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log(`Click failed: ${e.message}`);
  }
  await page.screenshot({ path: join(SCREENSHOTS, 'fix-06-after-preset-click.png'), fullPage: true });
} else {
  // Try ME 4Ch or any dock button
  const allButtons = await page.locator('button').all();
  console.log(`Found ${allButtons.length} total buttons`);
  const buttonTexts = [];
  for (const btn of allButtons.slice(0, 10)) {
    buttonTexts.push(await btn.textContent());
  }
  console.log(`First buttons: ${JSON.stringify(buttonTexts)}`);
  await page.screenshot({ path: join(SCREENSHOTS, 'fix-06-after-preset-click.png'), fullPage: true });
}

// Report console output
console.log('\n=== CONSOLE ERRORS ===');
if (consoleErrors.length === 0) {
  console.log('(none)');
} else {
  consoleErrors.forEach(e => console.log(e));
}

console.log('\n=== ALL CONSOLE LOG MESSAGES (non-error) ===');
consoleLogs.filter(l => !l.startsWith('[error]') && !l.startsWith('[pageerror]')).forEach(l => console.log(l));

await browser.close();
console.log('\nDone. Screenshots saved to ' + SCREENSHOTS);
