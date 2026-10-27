const { defineConfig, devices } = require('@playwright/test');
const { validateTarget } = require('./tests/security/target');
const target = validateTarget(process.env.SECURITY_BASE_URL);

module.exports = defineConfig({
  testDir: './tests/security',
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  forbidOnly: Boolean(process.env.CI),
  globalSetup: require.resolve('./tests/security/setup'),
  globalTeardown: require.resolve('./tests/security/teardown'),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'test-results/security.json' }]],
  use: {
    baseURL: target.baseURL,
    storageState: '.tmp/security-auth.json',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    // Remote traces may contain deployment-protection cookies; keep them out of artifacts.
    trace: target.local ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  webServer: target.local ? {
    command: 'node scripts/dev-server.js',
    url: `${target.baseURL}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 20000,
    env: { HOST: new URL(target.baseURL).hostname.replace(/^\[|\]$/g, ''), PORT: new URL(target.baseURL).port || '80' },
  } : undefined,
  projects: [
    { name: 'http', testMatch: /(?:api|cdn)\.spec\.js$/ },
    { name: 'chromium', testMatch: /browser\.spec\.js$/, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testMatch: /browser\.spec\.js$/, use: { ...devices['Desktop Firefox'] } },
  ],
});
