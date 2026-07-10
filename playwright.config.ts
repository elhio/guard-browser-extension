import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

/**
 * E2E tests load the built extension (.output/chrome-mv3) into a headed, persistent
 * Chromium context (see tests/fixtures.ts). No web server is needed: the only external
 * site (the login handoff) is stubbed via request routing inside the login spec.
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'blob' : 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
