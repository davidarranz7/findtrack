import { defineConfig, devices } from '@playwright/test';

const securityAudit = process.env['FINORA_SECURITY_AUDIT'] === '1';
const stressSuite = process.env['FINORA_STRESS'] === '1';
const visualSuite = process.env['FINORA_VISUAL'] === '1';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: securityAudit
    ? '**/*.audit.ts'
    : stressSuite
      ? '**/*.stress.ts'
      : visualSuite
        ? '**/*.visual.ts'
        : '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 50_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:4201',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      name: 'API E2E — restablece únicamente mock-api/db.e2e.json',
      command:
        'node tests/e2e/scripts/reset-db.mjs && npx json-server mock-api/db.e2e.json --port 3001 --host 127.0.0.1',
      url: 'http://127.0.0.1:3001/users',
      reuseExistingServer: false,
      timeout: 45_000,
    },
    {
      name: 'Angular E2E — API aislada 3001',
      command:
        'npx ng serve fintrack --configuration development --host 127.0.0.1 --port 4201 --proxy-config src/proxy.e2e.conf.json',
      url: 'http://127.0.0.1:4201/login',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
