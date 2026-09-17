import { expect, type Page, type TestInfo } from '@playwright/test';
import { config } from '../config/environment';
import { isTransientNetworkError } from '../core/errors';
import { logger } from '../core/logger';
import { retry } from '../core/retry';
import { step } from '../core/step.decorator';
import { ScreenshotUtils } from '../utils/screenshot-utils';
import { StringUtils } from '../utils/string-utils';
import { HeaderComponent } from './components/header.component';

/**
 * Base for all page objects.
 *
 * Conventions:
 * - `path` is relative to BASE_URL; `goto()` navigates and then awaits `waitForReady()`.
 * - Pages expose `expectXxx()` methods built on web-first assertions instead of returning
 *   raw state for the test to compare; this keeps auto-waiting in the page layer.
 * - No hard-coded sleeps anywhere: readiness is always expressed as a locator condition.
 */
export abstract class BasePage {
  readonly header: HeaderComponent;
  protected abstract readonly path: string;

  constructor(protected readonly page: Page) {
    this.header = new HeaderComponent(page);
  }

  /** Locator condition that signals the page is interactive. */
  abstract waitForReady(): Promise<void>;

  @step('Navigate to page')
  async goto(): Promise<void> {
    await this.navigate(this.path);
    await this.waitForReady();
  }

  @step('Reload page')
  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: config.timeouts.navigation });
    await this.waitForReady();
  }

  async expectUrlContains(fragment: string | RegExp): Promise<void> {
    const pattern =
      typeof fragment === 'string' ? new RegExp(StringUtils.escapeRegExp(fragment)) : fragment;
    await expect(this.page).toHaveURL(pattern);
  }

  currentUrl(): string {
    return this.page.url();
  }

  async captureScreenshot(testInfo: TestInfo, label: string): Promise<string> {
    return ScreenshotUtils.capturePage(this.page, testInfo, label);
  }

  /**
   * Navigation with a single retry for OS/browser level network errors (interface change,
   * connection reset). Application errors and timeouts are never retried.
   */
  protected async navigate(url: string): Promise<void> {
    await retry(
      () =>
        this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.timeouts.navigation }),
      {
        attempts: 2,
        delayMs: 500,
        label: `Navigate to ${url}`,
        shouldRetry: isTransientNetworkError,
        onRetry: error =>
          logger.warn(`Transient network error while navigating to ${url}; retrying once`, {
            error: String(error),
          }),
      }
    );
  }
}
