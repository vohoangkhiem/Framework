import { RetryExhaustedError } from './errors';

export interface RetryOptions {
  /** Total attempts including the first one. Defaults to 3. */
  attempts?: number;
  /** Delay before the second attempt. Defaults to 500 ms. */
  delayMs?: number;
  /** Multiplier applied to the delay after each failure. Defaults to 2 (exponential backoff). */
  backoffFactor?: number;
  /** Upper bound for the computed delay. Defaults to 10 s. */
  maxDelayMs?: number;
  /** Return false to stop retrying for non-transient errors. Defaults to always retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Hook invoked before waiting for the next attempt (useful for logging). */
  onRetry?: (error: unknown, attempt: number, nextDelayMs: number) => void;
  /** Human-readable label used in the final error message. */
  label?: string;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes `operation` until it resolves, retrying with exponential backoff.
 *
 * Intended for transient infrastructure failures (network blips, HTTP 5xx from a
 * precondition API). It must NOT be used to paper over flaky UI interactions; use
 * Playwright's auto-waiting assertions for those.
 */
export async function retry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const backoffFactor = options.backoffFactor ?? 2;
  const maxDelayMs = options.maxDelayMs ?? 10_000;
  const label = options.label ?? 'Operation';
  let delayMs = options.delayMs ?? 500;
  let lastError: unknown;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    attemptsMade = attempt;
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === attempts;
      const retryAllowed = options.shouldRetry?.(error, attempt) ?? true;
      if (isLastAttempt || !retryAllowed) {
        break;
      }
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
      delayMs = Math.min(delayMs * backoffFactor, maxDelayMs);
    }
  }

  // Reports the attempts actually made (a non-retryable error stops after one), not the budget.
  throw new RetryExhaustedError(label, attemptsMade, lastError);
}

/**
 * Polls `producer` until `predicate` accepts its value. Unlike `retry`, a value that fails
 * the predicate is not an error: it simply schedules another attempt.
 */
export async function retryUntil<T>(
  producer: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: Omit<RetryOptions, 'shouldRetry'> = {}
): Promise<T> {
  return retry(
    async () => {
      const value = await producer();
      if (!predicate(value)) {
        throw new Error(`Predicate rejected value: ${JSON.stringify(value)}`);
      }
      return value;
    },
    { ...options, label: options.label ?? 'Condition' }
  );
}
