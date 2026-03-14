import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for OpSuite QA loop.
 *
 * Reads APP_URL from environment (defaults to local Expo web dev server).
 * Tests run serially (fullyParallel: false) because they simulate a
 * sequential operational week where later days depend on earlier state.
 *
 * Failure artifacts (screenshots, traces, console logs) are saved to
 * test-results/ for CI upload.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,            // sequential week simulation
  forbidOnly: !!process.env.CI,    // fail CI if .only left in
  retries: process.env.CI ? 1 : 0, // retry once on CI
  workers: 1,                       // single worker for sequential flow
  timeout: 60_000,                  // 60s per test
  expect: { timeout: 10_000 },     // 10s for assertions

  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['json', { outputFile: 'test-results/results.json' }], ['list']]
    : [['list']],

  use: {
    baseURL: process.env.APP_URL || 'http://localhost:8082',
    trace: 'on-first-retry',       // capture trace on failure retry
    screenshot: 'only-on-failure', // auto-screenshot on failure
    video: 'retain-on-failure',    // record video, keep only on failure
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Output directory for failure artifacts
  outputDir: 'test-results/',
});
