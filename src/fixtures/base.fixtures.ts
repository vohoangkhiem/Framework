import { test as base, type ConsoleMessage } from '@playwright/test';
import { type Logger, logger as frameworkLogger } from '../core/logger';
import { ScreenshotUtils } from '../utils/screenshot-utils';

export interface BaseFixtures {
  /**
   * Test-scoped logger. It is a child of the process-wide framework logger and shares its entry
   * store, so the log attached to a failed test contains everything the framework did on the
   * test's behalf (API calls, preconditions, navigation retries, mocked routes), not only the
   * lines the spec logged itself.
   */
  logger: Logger;
  /** Console errors and uncaught page errors collected while the test ran. */
  consoleErrors: string[];
  /** Convenience wrapper around ScreenshotUtils bound to the current test. */
  screenshots: {
    capture(label: string, fullPage?: boolean): Promise<string>;
  };
}

/**
 * Cross-cutting fixtures shared by every test type. The built-in `page` fixture is
 * overridden (not replaced) to collect browser console errors; because fixtures are lazy,
 * API-only tests that never request `page` still run without launching a browser.
 */
export const baseTest = base.extend<BaseFixtures>({
  // `auto`: every test resets the shared store on teardown, even when it never asks for `logger`.
  // A worker executes one test at a time and auto fixtures are torn down last, so at that point
  // the store holds exactly the entries produced by (and for) the current test.
  logger: [
    async ({}, use, testInfo) => {
      const testLogger = frameworkLogger.child({
        test: testInfo.title,
        project: testInfo.project.name,
        worker: testInfo.workerIndex,
      });
      testLogger.info('Test started');
      await use(testLogger);
      testLogger.info(`Test finished with status "${testInfo.status ?? 'unknown'}"`);
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('test-log.txt', {
          body: testLogger.dump(),
          contentType: 'text/plain',
        });
      }
      testLogger.clearEntries();
    },
    { auto: true },
  ],

  consoleErrors: async ({}, use) => {
    await use([]);
  },

  page: async ({ page, consoleErrors }, use, testInfo) => {
    const onConsole = (message: ConsoleMessage): void => {
      if (message.type() === 'error') {
        consoleErrors.push(`[console.error] ${message.text()}`);
      }
    };
    const onPageError = (error: Error): void => {
      consoleErrors.push(`[pageerror] ${error.message}`);
    };
    page.on('console', onConsole);
    page.on('pageerror', onPageError);

    await use(page);

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    if (consoleErrors.length > 0 && testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('browser-console-errors.txt', {
        body: consoleErrors.join('\n'),
        contentType: 'text/plain',
      });
    }
  },

  screenshots: async ({ page }, use, testInfo) => {
    await use({
      capture: (label: string, fullPage = true) =>
        ScreenshotUtils.capturePage(page, testInfo, label, { fullPage }),
    });
  },
});
