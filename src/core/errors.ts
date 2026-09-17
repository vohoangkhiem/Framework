/**
 * Framework error hierarchy.
 *
 * Every error thrown by framework code extends `FrameworkError` so that tests and
 * fixtures can distinguish infrastructure failures (configuration, API preconditions,
 * timeouts in helpers) from genuine application defects surfaced by assertions.
 */
export class FrameworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Invalid or missing environment configuration. Thrown at startup to fail fast. */
export class ConfigurationError extends FrameworkError {}

export interface ApiErrorDetails {
  method: string;
  url: string;
  status: number;
  body?: string;
  durationMs?: number;
}

/** Raised when an API call returns an unexpected status or an unparseable body. */
export class ApiError extends FrameworkError {
  readonly details: ApiErrorDetails;

  constructor(message: string, details: ApiErrorDetails, options?: { cause?: unknown }) {
    super(`${message} [${details.method} ${details.url} -> ${details.status}]`, options);
    this.details = details;
  }
}

/** A polled condition did not become true within the allotted time. */
export class ConditionTimeoutError extends FrameworkError {
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number) {
    super(`${message} (timed out after ${timeoutMs} ms)`);
    this.timeoutMs = timeoutMs;
  }
}

/** No browser dialog appeared after an action that was expected to trigger one. */
export class DialogTimeoutError extends FrameworkError {}

/** All retry attempts failed; `cause` holds the last underlying error. */
export class RetryExhaustedError extends FrameworkError {
  readonly attempts: number;

  constructor(label: string, attempts: number, cause: unknown) {
    super(`${label} failed after ${attempts} attempt(s): ${errorMessage(cause)}`, { cause });
    this.attempts = attempts;
  }
}

/** A test precondition (usually established through the API) could not be satisfied. */
export class PreconditionError extends FrameworkError {}

/** Normalises anything thrown (`throw 'string'`, `throw {}`) into an `Error`. */
export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(typeof value === 'string' ? value : safeStringify(value));
}

export function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : safeStringify(value);
}

const TRANSIENT_NETWORK_ERROR_PATTERN =
  /ERR_NETWORK_CHANGED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|ERR_TIMED_OUT|NS_ERROR_NET_RESET|NS_ERROR_NETWORK_CHANGED|NS_ERROR_NET_TIMEOUT|Could not connect|socket hang up|ECONNRESET|ETIMEDOUT/i;

/** Browser or OS level network errors that are worth one retry (they do not describe application behaviour). */
export function isTransientNetworkError(value: unknown): boolean {
  return TRANSIENT_NETWORK_ERROR_PATTERN.test(errorMessage(value));
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}
