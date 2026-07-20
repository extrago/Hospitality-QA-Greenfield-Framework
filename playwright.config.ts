import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment-specific configuration from .env files.
// Falls back gracefully if the file does not exist in CI environments.
dotenv.config({ path: path.resolve(__dirname, '.env') });

const BASE_URL = process.env.BASE_URL ?? 'https://staging.hospitality-platform.com';
const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.staging.hospitality-platform.com';

export default defineConfig({
  // Root directory for test discovery.
  testDir: './tests',

  // Maximum time (ms) a single test may run before it is aborted.
  timeout: 60_000,

  // Maximum time (ms) for all tests combined (0 = no limit).
  globalTimeout: 0,

  // Time to wait for `expect` assertions to pass before failing.
  expect: {
    timeout: 10_000,
  },

  // Run all tests in parallel across workers. Each spec file runs in its
  // own isolated worker context. Within a file, tests run sequentially.
  fullyParallel: true,

  // Fail the entire suite immediately if any test in a .spec.ts file
  // produces a configuration or setup error (not a test assertion failure).
  forbidOnly: !!process.env.CI,

  // Number of times to retry a failing test. On CI we allow 2 retries to
  // absorb transient flakiness; locally no retries for fast feedback.
  retries: process.env.CI ? 2 : 0,

  // Number of parallel worker processes. On CI, use all available CPUs.
  workers: process.env.CI ? '100%' : undefined,

  // Global test metadata available to all spec files via `use` configuration.
  use: {
    // Base URL used by `page.goto('/')`.
    baseURL: BASE_URL,

    // Record a trace for every test retry to enable post-mortem debugging.
    trace: 'on-first-retry',

    // Capture a screenshot automatically on test failure.
    screenshot: 'only-on-failure',

    // Record a video for every test retry. Videos are retained only when a
    // test fails, keeping artifact sizes manageable.
    video: 'on-first-retry',

    // Maximum time (ms) for Playwright actions such as click or fill.
    actionTimeout: 15_000,

    // Maximum time (ms) for page navigation.
    navigationTimeout: 30_000,

    // Locale and timezone matching expected staging content.
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Inject the API base URL so API tests can reference it without hardcoding.
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'X-QA-Framework-Version': '1.0.0',
    },
  },

  // Reporters used to surface test results.
  reporter: [
    // Human-readable summary in the terminal.
    ['list'],

    // Self-contained HTML report written to `playwright-report/`.
    ['html', { open: 'never', outputFolder: 'playwright-report' }],

    // JUnit XML report for CI artifact ingestion (e.g., GitHub Actions, Jenkins).
    ['junit', { outputFile: 'test-results/junit-results.xml' }],

    // GitHub Actions native annotations (only emits output inside CI runners).
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  // Output directory for test artifacts (screenshots, videos, traces).
  outputDir: 'test-results/',

  // Project matrix — each project targets a specific browser / device profile.
  projects: [
    // ─── Desktop Browsers ────────────────────────────────────────────────────
    {
      name: 'chromium',
      testMatch: '**/e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Override with an explicit viewport matching the platform design breakpoint.
        viewport: { width: 1440, height: 900 },
        channel: 'chromium',
      },
    },
    {
      name: 'firefox',
      testMatch: '**/e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'webkit',
      testMatch: '**/e2e/**/*.spec.ts',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1440, height: 900 },
      },
    },

    // ─── Mobile Browsers ─────────────────────────────────────────────────────
    {
      name: 'mobile-chrome',
      testMatch: '**/e2e/**/*.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      testMatch: '**/e2e/**/*.spec.ts',
      use: { ...devices['iPhone 15'] },
    },

    // ─── API Tests ────────────────────────────────────────────────────────────
    // API tests are browser-agnostic. Each test spins up its own local mock server
    // and creates a playwrightRequest.newContext() pointed at localhost, so the
    // baseURL here is only a fallback and is never used in practice.
    {
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: 'http://127.0.0.1',
        extraHTTPHeaders: {
          'Accept':               'application/json',
          'Content-Type':         'application/json',
          'X-QA-Framework-Version': '1.0.0',
        },
      },
    },
  ],
});
