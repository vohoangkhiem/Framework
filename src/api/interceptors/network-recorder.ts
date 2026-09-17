import type { Page, Request, TestInfo } from '@playwright/test';
import { ConditionTimeoutError } from '../../core/errors';
import { sleep } from '../../core/retry';
import { parseJsonAs, type TypeGuard } from '../../utils/json-utils';

export interface RecordedRequest {
  url: string;
  method: string;
  resourceType: string;
  postData: string | null;
  startedAt: number;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  failure?: string;
}

export interface NetworkRecorderOptions {
  /** Only record requests whose URL matches. Defaults to everything. */
  urlFilter?: string | RegExp;
  /** Only record these resource types, e.g. ['xhr', 'fetch']. Defaults to all. */
  resourceTypes?: string[];
}

export interface WaitForRequestOptions {
  method?: string;
  timeout?: number;
}

/**
 * Passive network observer. Unlike `RouteMocker` it never alters traffic; it lets tests
 * assert on what the UI actually sent (payloads, methods) and received (statuses), and
 * attaches a compact network log to the report for failure analysis.
 */
export class NetworkRecorder {
  private readonly records = new Map<Request, RecordedRequest>();
  private readonly onRequest = (request: Request): void => {
    if (!this.shouldRecord(request)) {
      return;
    }
    this.records.set(request, {
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      postData: request.postData(),
      startedAt: Date.now(),
    });
  };
  private readonly onResponse = (response: {
    request(): Request;
    status(): number;
    ok(): boolean;
  }): void => {
    const record = this.records.get(response.request());
    if (record) {
      record.status = response.status();
      record.ok = response.ok();
      record.durationMs = Date.now() - record.startedAt;
    }
  };
  private readonly onRequestFailed = (request: Request): void => {
    const record = this.records.get(request);
    if (record) {
      record.failure = request.failure()?.errorText ?? 'unknown failure';
      record.durationMs = Date.now() - record.startedAt;
    }
  };

  constructor(
    private readonly page: Page,
    private readonly options: NetworkRecorderOptions = {}
  ) {}

  start(): this {
    this.page.on('request', this.onRequest);
    this.page.on('response', this.onResponse);
    this.page.on('requestfailed', this.onRequestFailed);
    return this;
  }

  stop(): RecordedRequest[] {
    this.page.off('request', this.onRequest);
    this.page.off('response', this.onResponse);
    this.page.off('requestfailed', this.onRequestFailed);
    return this.requests();
  }

  requests(predicate?: (record: RecordedRequest) => boolean): RecordedRequest[] {
    const all = Array.from(this.records.values());
    return predicate ? all.filter(predicate) : all;
  }

  find(urlPart: string | RegExp, method?: string): RecordedRequest[] {
    return this.requests(
      record =>
        NetworkRecorder.urlMatches(record.url, urlPart) &&
        (method === undefined || record.method === method)
    );
  }

  failed(): RecordedRequest[] {
    return this.requests(
      record =>
        record.failure !== undefined || (record.status !== undefined && record.status >= 400)
    );
  }

  /** Waits until a matching request has completed (response received). */
  async waitForCompleted(
    urlPart: string | RegExp,
    options: WaitForRequestOptions = {}
  ): Promise<RecordedRequest> {
    const timeout = options.timeout ?? 15_000;
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const completed = this.find(urlPart, options.method).find(
        record => record.status !== undefined
      );
      if (completed) {
        return completed;
      }
      await sleep(100);
    }
    throw new ConditionTimeoutError(`No completed request matching ${String(urlPart)}`, timeout);
  }

  /** Parses the recorded request body as JSON and validates it with a type guard. */
  static postDataAs<T>(record: RecordedRequest, guard: TypeGuard<T>): T {
    if (record.postData === null) {
      throw new TypeError(`Request ${record.method} ${record.url} has no body`);
    }
    return parseJsonAs(record.postData, guard, `${record.method} ${record.url} body`);
  }

  async attach(testInfo: TestInfo, name = 'network-log'): Promise<void> {
    await testInfo.attach(name, {
      body: JSON.stringify(this.requests(), null, 2),
      contentType: 'application/json',
    });
  }

  private shouldRecord(request: Request): boolean {
    const { urlFilter, resourceTypes } = this.options;
    if (urlFilter !== undefined && !NetworkRecorder.urlMatches(request.url(), urlFilter)) {
      return false;
    }
    return resourceTypes === undefined || resourceTypes.includes(request.resourceType());
  }

  private static urlMatches(url: string, matcher: string | RegExp): boolean {
    return typeof matcher === 'string' ? url.includes(matcher) : matcher.test(url);
  }
}
