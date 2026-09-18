import { envSchema } from '@config/env.schema';
import { config, toGrepRegex } from '@config/environment';
import { TAGS, tags } from '@config/test-tags';
import { RetryExhaustedError } from '@core/errors';
import { Logger } from '@core/logger';
import { retry } from '@core/retry';
import { expect, test } from '@fixtures';
import playwrightConfig from '../../playwright.config';

/** Fails `failures` times, then resolves. Declared outside the tests to keep conditionals out of them. */
function flakyOperation(failures: number): (attempt: number) => Promise<string> {
  return async attempt => {
    if (attempt <= failures) {
      throw new Error(`attempt ${attempt} failed`);
    }
    return `ok after ${attempt} attempts`;
  };
}

test.describe('Environment schema', tags(TAGS.framework), () => {
  test('applies documented defaults when variables are absent', () => {
    const parsed = envSchema.parse({});

    expect(parsed.TEST_ENV).toBe('dev');
    expect(parsed.CI).toBe(false);
    expect(parsed.DEFAULT_TIMEOUT).toBe(60_000);
    expect(parsed.TRACE_MODE).toBe('retain-on-failure');
    expect(parsed.WORKERS).toBeUndefined();
  });

  test('coerces numeric and boolean strings from the process environment', () => {
    const parsed = envSchema.parse({ CI: 'true', ACTION_TIMEOUT: '2500', WORKERS: '50%' });

    expect(parsed.CI).toBe(true);
    expect(parsed.ACTION_TIMEOUT).toBe(2500);
    expect(parsed.WORKERS).toBe('50%');
  });

  test('rejects invalid values and names the offending variable', () => {
    expect(() => envSchema.parse({ TEST_ENV: 'qa' })).toThrow(/TEST_ENV/);
    expect(() => envSchema.parse({ WORKERS: 'many' })).toThrow(/number or a percentage/);
    expect(() => envSchema.parse({ BASE_URL: 'not-a-url' })).toThrow(/BASE_URL/);
  });

  test('maps tag lists to an escaped grep pattern', () => {
    expect(toGrepRegex('@smoke, @edge-case|@regression')).toStrictEqual(
      /@smoke|@edge-case|@regression/
    );
    expect(toGrepRegex('a.b (c)')).toStrictEqual(/a\.b|\(c\)/);
    expect(toGrepRegex('')).toBeUndefined();
    expect(toGrepRegex(undefined)).toBeUndefined();
  });

  test('limits WebKit to one worker in CI without changing other browser projects', () => {
    const webkit = playwrightConfig.projects?.find(project => project.name === 'webkit');
    const chromium = playwrightConfig.projects?.find(project => project.name === 'chromium');

    expect(webkit).toBeDefined();
    expect(chromium).toBeDefined();
    expect(webkit?.workers).toBe(config.isCI ? 1 : undefined);
    expect(chromium?.workers).toBeUndefined();
  });
});

test.describe('retry', tags(TAGS.framework), () => {
  test('retries transient failures with backoff and returns the first success', async () => {
    const scheduledDelays: number[] = [];

    const value = await retry(flakyOperation(2), {
      attempts: 4,
      delayMs: 10,
      backoffFactor: 3,
      onRetry: (_error, _attempt, nextDelayMs) => {
        scheduledDelays.push(nextDelayMs);
      },
    });

    expect(value).toBe('ok after 3 attempts');
    expect(scheduledDelays).toStrictEqual([10, 30]);
  });

  test('stops immediately when shouldRetry rejects the error', async () => {
    const failure = retry(flakyOperation(10), {
      attempts: 5,
      delayMs: 1,
      shouldRetry: () => false,
      label: 'Permanent failure',
    });

    await expect(failure).rejects.toBeInstanceOf(RetryExhaustedError);
    await expect(failure).rejects.toThrow(
      'Permanent failure failed after 1 attempt(s): attempt 1 failed'
    );
  });

  test('reports the attempts made and the last error once the budget is exhausted', async () => {
    const failure = retry(flakyOperation(10), { attempts: 2, delayMs: 1, label: 'Always failing' });

    await expect(failure).rejects.toThrow(
      'Always failing failed after 2 attempt(s): attempt 2 failed'
    );
  });
});

test.describe('Logger', tags(TAGS.framework), () => {
  test('masks sensitive keys recursively and leaves other data intact', () => {
    const sanitized = Logger.sanitize({
      username: 'alice',
      password: 'S3cret!!',
      nested: { token: 'abcdef123456', count: 3 },
      list: [{ apiKey: 'xyz' }],
    });

    expect(sanitized).toStrictEqual({
      username: 'alice',
      password: 'S3***',
      nested: { token: 'ab***', count: 3 },
      list: [{ apiKey: 'xy***' }],
    });
  });

  test('shares one entry store between parent and child loggers', () => {
    const printed: string[] = [];
    const root = Logger.create({
      level: 'warn',
      format: 'pretty',
      context: { scope: 'root' },
      sink: line => {
        printed.push(line);
      },
    });
    const child = root.child({ scope: 'child' });

    root.info('stored but below the print threshold');
    child.warn('printed', { password: 'hidden' });

    expect(printed).toHaveLength(1);
    expect(printed[0]).toContain('[WARN ] [scope=child] printed {"password":"hi***"}');
    expect(root.entries).toHaveLength(2);
    expect(root.dump().split('\n')).toHaveLength(2);

    child.clearEntries();
    expect(root.entries).toHaveLength(0);
  });
});
