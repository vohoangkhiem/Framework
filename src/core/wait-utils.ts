import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { ConditionTimeoutError } from './errors';
import { sleep } from './retry';

export interface WaitOptions {
  /** Maximum time to wait in milliseconds. Defaults to 10 s. */
  timeout?: number;
  /** Polling interval in milliseconds. Defaults to 250 ms. */
  interval?: number;
  /** Message used when the wait fails. */
  message?: string;
}

export interface ApiResponseWaitOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Expected HTTP status; any status is accepted when omitted. */
  status?: number;
  timeout?: number;
}

/**
 * Smart-wait helpers. These complement (never replace) Playwright's auto-waiting and
 * web-first assertions: use them only for conditions that are not expressible as a
 * locator assertion (e.g. cookie presence, cross-request state).
 */
export const WaitUtils = {
  /** Polls a boolean condition using Playwright's `expect.poll`, so failures produce a rich message. */
  async forCondition(
    condition: () => Promise<boolean> | boolean,
    options: WaitOptions = {}
  ): Promise<void> {
    const { timeout = 10_000, interval = 250, message = 'Condition was not met' } = options;
    await expect
      .poll(async () => condition(), { timeout, intervals: [interval], message })
      .toBe(true);
  },

  /** Polls `producer` until `predicate` accepts the value and returns that value. */
  async forValue<T>(
    producer: () => Promise<T>,
    predicate: (value: T) => boolean,
    options: WaitOptions = {}
  ): Promise<T> {
    const {
      timeout = 10_000,
      interval = 250,
      message = 'Value did not satisfy predicate',
    } = options;
    const deadline = Date.now() + timeout;
    let lastValue: T | undefined;
    while (Date.now() < deadline) {
      lastValue = await producer();
      if (predicate(lastValue)) {
        return lastValue;
      }
      await sleep(interval);
    }
    throw new ConditionTimeoutError(
      `${message}. Last value: ${JSON.stringify(lastValue)}`,
      timeout
    );
  },

  /**
   * Waits for an API response whose URL contains `urlPart`. Must be started BEFORE the
   * action that triggers the request, e.g. `const wait = WaitUtils.forApiResponse(...); await click(); await wait;`.
   */
  async forApiResponse(
    page: Page,
    urlPart: string | RegExp,
    options: ApiResponseWaitOptions = {}
  ): Promise<Response> {
    const { method, status, timeout = 15_000 } = options;
    return page.waitForResponse(
      response => {
        const url = response.url();
        const urlMatches = typeof urlPart === 'string' ? url.includes(urlPart) : urlPart.test(url);
        const methodMatches = method === undefined || response.request().method() === method;
        const statusMatches = status === undefined || response.status() === status;
        return urlMatches && methodMatches && statusMatches;
      },
      { timeout }
    );
  },

  /**
   * Waits until the DOM subtree of `locator` stops changing for `stableForMs`. Useful for
   * lists that are rendered incrementally by multiple asynchronous requests.
   */
  async forDomStable(
    locator: Locator,
    options: WaitOptions & { stableForMs?: number } = {}
  ): Promise<void> {
    const { timeout = 10_000, interval = 200, stableForMs = 600 } = options;
    const deadline = Date.now() + timeout;
    let previous = await locator.innerHTML();
    let stableSince = Date.now();

    while (Date.now() < deadline) {
      await sleep(interval);
      const current = await locator.innerHTML();
      if (current !== previous) {
        previous = current;
        stableSince = Date.now();
      } else if (Date.now() - stableSince >= stableForMs) {
        return;
      }
    }
    throw new ConditionTimeoutError('DOM did not become stable', timeout);
  },

  /** Waits for the document to be interactive; avoids the discouraged `networkidle` state. */
  async forPageReady(page: Page, timeout = 30_000): Promise<void> {
    await page.waitForLoadState('domcontentloaded', { timeout });
  },
} as const;
