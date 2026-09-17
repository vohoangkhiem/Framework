import path from 'node:path';
import type { Locator, Page, TestInfo } from '@playwright/test';
import { config } from '../config/environment';
import { DateUtils } from './date-utils';
import { FileUtils } from './file-utils';
import { StringUtils } from './string-utils';

export interface ScreenshotOptions {
  fullPage?: boolean;
  /** Elements to black out (dynamic content, PII). */
  mask?: Locator[];
  /** Attach the image to the HTML report. Defaults to true. */
  attach?: boolean;
  /** Screenshot timeout in ms. Defaults to the configured action timeout. */
  timeout?: number;
}

/**
 * Screenshot helpers that produce deterministic, traceable file names and attach the
 * images to the Playwright report. Automatic failure screenshots are configured globally
 * in playwright.config.ts; use these helpers for intentional evidence capture.
 */
export const ScreenshotUtils = {
  get directory(): string {
    return path.join(config.paths.testResults, 'screenshots');
  },

  /** e.g. login-feature-logs-in-successfully--after-login--20260915-143012.png */
  buildFileName(testInfo: TestInfo, label: string): string {
    const title = StringUtils.sanitizeFileName(testInfo.titlePath.slice(1).join(' '), '-', 80);
    const safeLabel = StringUtils.sanitizeFileName(label, '-', 40);
    return `${title}--${safeLabel}--${DateUtils.timestampForFileName()}.png`;
  },

  async capturePage(
    page: Page,
    testInfo: TestInfo,
    label: string,
    options: ScreenshotOptions = {}
  ): Promise<string> {
    const filePath = path.join(
      ScreenshotUtils.directory,
      ScreenshotUtils.buildFileName(testInfo, label)
    );
    FileUtils.ensureDir(ScreenshotUtils.directory);
    await page.screenshot({
      path: filePath,
      fullPage: options.fullPage ?? true,
      mask: options.mask,
      timeout: options.timeout ?? config.timeouts.action,
      animations: 'disabled',
      caret: 'hide',
    });
    if (options.attach ?? true) {
      await testInfo.attach(label, { path: filePath, contentType: 'image/png' });
    }
    return filePath;
  },

  async captureElement(
    locator: Locator,
    testInfo: TestInfo,
    label: string,
    options: Omit<ScreenshotOptions, 'fullPage'> = {}
  ): Promise<string> {
    const filePath = path.join(
      ScreenshotUtils.directory,
      ScreenshotUtils.buildFileName(testInfo, label)
    );
    FileUtils.ensureDir(ScreenshotUtils.directory);
    await locator.screenshot({
      path: filePath,
      mask: options.mask,
      timeout: options.timeout ?? config.timeouts.action,
      animations: 'disabled',
    });
    if (options.attach ?? true) {
      await testInfo.attach(label, { path: filePath, contentType: 'image/png' });
    }
    return filePath;
  },

  /** In-memory capture attached to the report (no file management needed). */
  async attachInline(
    page: Page,
    testInfo: TestInfo,
    label: string,
    fullPage = false
  ): Promise<void> {
    const buffer = await page.screenshot({ fullPage, animations: 'disabled' });
    await testInfo.attach(label, { body: buffer, contentType: 'image/png' });
  },
} as const;
