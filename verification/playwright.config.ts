import { defineConfig } from '@playwright/test';
import { PORTS } from './shared/vite.base';

/**
 * One dev server per app.
 *
 * Playwright starts all four and waits for each. They are separate servers
 * rather than one multi-page build because the frameworks need incompatible
 * Vite plugins — and because a failure to even boot is then attributable to one
 * framework instead of to "the verification app".
 */
const apps = ['plain', 'vue', 'svelte', 'angular'] as const;

export default defineConfig({
  testDir: './tests',
  // A media element that never fires `play` should fail fast, not hang.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],

  use: {
    trace: 'retain-on-failure',
    video: 'off',
  },

  // All three engines, because the element's job is to hide their differences.
  // Custom-element upgrade timing, `display: contents`, and how a media element
  // reports its state are exactly the places where Chromium agreeing with
  // itself proves the least.
  //
  // No autoplay flags: the specs dispatch synthetic media events rather than
  // starting real playback, so autoplay policy never enters into it — and a
  // Chromium-only launch argument would have made this matrix uneven anyway.
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],

  webServer: apps.map((app) => ({
    command: `npx vite --config apps/${app}/vite.config.ts`,
    port: PORTS[app],
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  })),
});
