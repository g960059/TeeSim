import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for TeeSim E2E tests.
 *
 * MVP scope: Chromium only. Webkit and Firefox are deferred until
 * the rendering pipeline stabilises (see ADR-0001 cut list).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:5173',

    /* Capture screenshot on every test failure. */
    screenshot: 'only-on-failure',

    /* Capture trace on first retry (useful for CI debugging). */
    trace: 'on-first-retry',

    /*
     * WebGL rendering can take time, especially for VTK.js volume
     * reslicing. Give pages 30 seconds to load and settle.
     */
    navigationTimeout: 30_000,
    actionTimeout: 15_000,
  },

  /* Global timeout per test — generous for WebGL cold-start. */
  timeout: 60_000,

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Deferred to post-MVP:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  /* Start the Vite dev server automatically before running tests. */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
