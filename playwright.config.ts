import path from 'node:path';
import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import { config, toGrepRegex } from './src/config/environment';

/**
 * Playwright configuration. All tunables come from the validated `config` object
 * (src/config/environment.ts) so that local runs, Docker and CI share one source of truth.
 *
 * Project layout:
 *  - setup            : registers the shared account and stores an authenticated storage state
 *  - framework        : self-tests of the framework's own building blocks (tests/framework)
 *  - api              : browser-less API tests (tests/api)
 *  - chromium/firefox/webkit : UI, e2e and performance suites (depend on `setup`)
 *  - mobile-*         : device emulation suites (tests/mobile)
 */
const API_TESTS = /tests[\\/]api[\\/].*\.spec\.ts$/;
const MOBILE_TESTS = /tests[\\/]mobile[\\/].*\.spec\.ts$/;
const SETUP_TESTS = /tests[\\/]setup[\\/].*\.setup\.ts$/;
const FRAMEWORK_TESTS = /tests[\\/]framework[\\/].*\.spec\.ts$/;
const DESKTOP_SPECS = /.*\.spec\.ts$/;
const DESKTOP_IGNORE = [API_TESTS, MOBILE_TESTS, FRAMEWORK_TESTS];

/**
 * TEST_TAGS / EXCLUDE_TAGS mapped to grep / grepInvert and applied per project on purpose (see
 * ADR-0005): Playwright applies a config-level `grep` to dependency projects too, so a global
 * filter would silently drop the `setup` test from every tag-filtered run, leaving the browser
 * projects without the shared account and the storage state.
 */
const tagFilter = {
  grep: toGrepRegex(config.tags.include),
  grepInvert: toGrepRegex(config.tags.exclude),
};

const htmlReporter: ReporterDescription = [
  'html',
  { outputFolder: config.paths.htmlReport, open: 'never' },
];
const junitReporter: ReporterDescription = [
  'junit',
  { outputFile: path.join(config.paths.testResults, 'junit.xml') },
];
const jsonReporter: ReporterDescription = [
  'json',
  { outputFile: path.join(config.paths.testResults, 'results.json') },
];
// Per-project pass/fail table for the console, the artifact folder and the GitHub job summary.
const summaryReporter: ReporterDescription = [
  './src/reporting/summary.reporter.ts',
  { outputFile: path.join(config.paths.testResults, 'summary.md') },
];

// In CI the blob reporter is added so that sharded runs can be merged with `npm run report:merge`.
const reporters: ReporterDescription[] = config.isCI
  ? [
      ['list'],
      ['blob', { outputDir: config.paths.blobReport }],
      junitReporter,
      jsonReporter,
      htmlReporter,
      summaryReporter,
    ]
  : [['list'], htmlReporter, junitReporter, jsonReporter, summaryReporter];

function resolveWorkers(): number | string | undefined {
  if (config.workers === undefined) {
    return config.isCI ? '50%' : undefined;
  }
  return /^\d+$/.test(config.workers) ? Number(config.workers) : config.workers;
}

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.(spec|setup)\.ts$/,
  fullyParallel: true,
  forbidOnly: config.isCI,
  retries: config.retries,
  workers: resolveWorkers(),
  timeout: config.timeouts.test,
  globalTimeout: config.isCI ? 60 * 60 * 1000 : 0,
  reporter: reporters,
  outputDir: config.paths.testResults,
  preserveOutput: 'failures-only',
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{projectName}/{arg}{ext}',
  metadata: {
    environment: config.environment,
    baseUrl: config.baseUrl,
    apiBaseUrl: config.apiBaseUrl,
    commit:
      process.env.GIT_COMMIT ?? process.env.GITHUB_SHA ?? process.env.CI_COMMIT_SHA ?? 'local',
  },
  globalSetup: './src/config/global-setup.ts',
  globalTeardown: './src/config/global-teardown.ts',

  expect: {
    timeout: config.timeouts.expect,
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' },
  },

  use: {
    baseURL: config.baseUrl,
    headless: config.browser.headless,
    trace: config.artifacts.trace,
    video: config.artifacts.video,
    screenshot: config.artifacts.screenshot,
    actionTimeout: config.timeouts.action,
    navigationTimeout: config.timeouts.navigation,
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    viewport: { width: 1280, height: 720 },
    testIdAttribute: 'data-testid',
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  },

  projects: [
    {
      // Deliberately NOT tag-filtered: it must run whenever a browser project runs.
      name: 'setup',
      testMatch: SETUP_TESTS,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'framework',
      testMatch: FRAMEWORK_TESTS,
      ...tagFilter,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testMatch: API_TESTS,
      ...tagFilter,
    },
    {
      name: 'chromium',
      testMatch: DESKTOP_SPECS,
      testIgnore: DESKTOP_IGNORE,
      dependencies: ['setup'],
      ...tagFilter,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      testMatch: DESKTOP_SPECS,
      testIgnore: DESKTOP_IGNORE,
      dependencies: ['setup'],
      ...tagFilter,
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testMatch: DESKTOP_SPECS,
      testIgnore: DESKTOP_IGNORE,
      dependencies: ['setup'],
      ...tagFilter,
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testMatch: MOBILE_TESTS,
      dependencies: ['setup'],
      ...tagFilter,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      testMatch: MOBILE_TESTS,
      dependencies: ['setup'],
      ...tagFilter,
      use: { ...devices['iPhone 14'] },
    },
  ],
});
