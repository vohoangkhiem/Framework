import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { ZodType } from 'zod';
import { config } from '../../config/environment';
import { ApiError } from '../../core/errors';
import { type Logger, logger as frameworkLogger } from '../../core/logger';
import { retry } from '../../core/retry';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  /** JSON-serialisable body. */
  data?: unknown;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  /** Per-request timeout (ms). Defaults to API_TIMEOUT. */
  timeout?: number;
  /** Number of retries for transient failures (network errors, HTTP 5xx). Defaults to API_RETRIES. */
  retries?: number;
}

export interface ApiResult<T> {
  status: number;
  ok: boolean;
  data: T;
  headers: Record<string, string>;
  durationMs: number;
  raw: APIResponse;
}

export interface ApiClientOptions {
  /** Used as logging context, e.g. "AuthApi". */
  name?: string;
  defaultRetries?: number;
  defaultTimeout?: number;
}

/**
 * Base class for typed API clients built on Playwright's `APIRequestContext`.
 *
 * Responsibilities:
 * - uniform logging of every call (method, URL, status, duration) with secrets sanitised
 * - retry with exponential backoff for transient failures only (never for 4xx)
 * - JSON parsing + Zod contract validation that raises `ApiError` with actionable context
 */
export abstract class BaseApiClient {
  protected readonly logger: Logger;
  private readonly defaultRetries: number;
  private readonly defaultTimeout: number;

  protected constructor(
    protected readonly request: APIRequestContext,
    options: ApiClientOptions = {}
  ) {
    this.logger = frameworkLogger.child({ scope: options.name ?? new.target.name });
    this.defaultRetries = options.defaultRetries ?? config.api.retries;
    this.defaultTimeout = options.defaultTimeout ?? config.api.timeout;
  }

  async get(endpoint: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.send('GET', endpoint, options);
  }

  async post(endpoint: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.send('POST', endpoint, options);
  }

  async put(endpoint: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.send('PUT', endpoint, options);
  }

  async patch(endpoint: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.send('PATCH', endpoint, options);
  }

  async delete(endpoint: string, options: RequestOptions = {}): Promise<APIResponse> {
    return this.send('DELETE', endpoint, options);
  }

  /** Sends a request, expects a 2xx status and validates the JSON body against `schema`. */
  protected async sendJson<T>(
    method: HttpMethod,
    endpoint: string,
    schema: ZodType<T>,
    options: RequestOptions = {}
  ): Promise<ApiResult<T>> {
    const started = Date.now();
    const response = await this.send(method, endpoint, options);
    await this.assertOk(response, method, endpoint);
    const data = await BaseApiClient.parseJson(response, schema, method, endpoint);
    return BaseApiClient.toResult(response, data, Date.now() - started);
  }

  /** Sends a request, expects a 2xx status and returns the body as text. */
  protected async sendText(
    method: HttpMethod,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResult<string>> {
    const started = Date.now();
    const response = await this.send(method, endpoint, options);
    await this.assertOk(response, method, endpoint);
    return BaseApiClient.toResult(response, await response.text(), Date.now() - started);
  }

  /** Low-level send with logging and transient-failure retries. Returns any status. */
  protected async send(
    method: HttpMethod,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<APIResponse> {
    const retries = options.retries ?? this.defaultRetries;
    const timeout = options.timeout ?? this.defaultTimeout;

    return retry(
      async attempt => {
        const started = Date.now();
        const response = await this.request.fetch(endpoint, {
          method,
          data: options.data,
          params: options.params,
          headers: options.headers,
          timeout,
        });
        const durationMs = Date.now() - started;
        this.logger.debug(`${method} ${endpoint} -> ${response.status()}`, {
          durationMs,
          attempt,
          body: options.data,
        });
        if (response.status() >= 500) {
          throw new ApiError('Server error', {
            method,
            url: response.url(),
            status: response.status(),
            body: await BaseApiClient.safeText(response),
            durationMs,
          });
        }
        return response;
      },
      {
        attempts: retries + 1,
        delayMs: 300,
        label: `${method} ${endpoint}`,
        shouldRetry: error =>
          !BaseApiClient.isDisposedContextError(error) &&
          (!(error instanceof ApiError) || error.details.status >= 500),
        onRetry: (error, attempt, nextDelayMs) =>
          this.logger.warn(
            `${method} ${endpoint} failed (attempt ${attempt}); retrying in ${nextDelayMs} ms`,
            {
              error: String(error),
            }
          ),
      }
    );
  }

  protected async assertOk(
    response: APIResponse,
    method: HttpMethod,
    endpoint: string
  ): Promise<void> {
    if (!response.ok()) {
      throw new ApiError('Unexpected status', {
        method,
        url: response.url() || endpoint,
        status: response.status(),
        body: await BaseApiClient.safeText(response),
      });
    }
  }

  static async parseJson<T>(
    response: APIResponse,
    schema: ZodType<T>,
    method: HttpMethod,
    endpoint: string
  ): Promise<T> {
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      throw new ApiError(
        'Response body is not valid JSON',
        {
          method,
          url: response.url() || endpoint,
          status: response.status(),
          body: await BaseApiClient.safeText(response),
        },
        { cause: error }
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      throw new ApiError(`Response violates contract (${issues})`, {
        method,
        url: response.url() || endpoint,
        status: response.status(),
        body: JSON.stringify(body).slice(0, 500),
      });
    }
    return parsed.data;
  }

  static async safeText(response: APIResponse): Promise<string> {
    try {
      return (await response.text()).slice(0, 500);
    } catch {
      return '<unreadable body>';
    }
  }

  /** A request issued after the test tore down its API context can never succeed; do not retry it. */
  private static isDisposedContextError(error: unknown): boolean {
    return error instanceof Error && /context disposed/i.test(error.message);
  }

  private static toResult<T>(response: APIResponse, data: T, durationMs: number): ApiResult<T> {
    return {
      status: response.status(),
      ok: response.ok(),
      data,
      headers: response.headers(),
      durationMs,
      raw: response,
    };
  }
}
