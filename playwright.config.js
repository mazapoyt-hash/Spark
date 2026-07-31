// @ts-check
const { defineConfig } = require('@playwright/test');

/* Smoke tests run against the static app served locally. They block the
   supabase-js CDN so the app runs its offline/demo path deterministically —
   i.e. we test that the UI works and degrades gracefully without a backend. */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8642',
    headless: true,
    viewport: { width: 390, height: 844 },
    actionTimeout: 10000,
    // Block the service worker: once it's active it fetches the Supabase CDN in
    // its own context, bypassing page.route's abort — which would boot the app
    // in real mode instead of the deterministic demo path the tests rely on.
    serviceWorkers: 'block',
    // local runs can point at a pre-installed browser via PW_EXECUTABLE;
    // CI installs its own with `npx playwright install`, so it stays unset there.
    ...(process.env.PW_EXECUTABLE ? { launchOptions: { executablePath: process.env.PW_EXECUTABLE } } : {}),
  },
  webServer: {
    command: 'python3 -m http.server 8642',
    port: 8642,
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
