import type { Page, Request, Route } from '@playwright/test';
import { logger } from '../../core/logger';
import { sleep } from '../../core/retry';

export type UrlMatcher = string | RegExp;

export interface MockResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  /** Artificial latency before responding, to exercise loading states and timeouts. */
  delayMs?: number;
  /** Stop mocking after N matching requests (subsequent requests hit the real server). */
  times?: number;
}

export interface InterceptedCall {
  url: string;
  method: string;
  postData: string | null;
  timestamp: number;
}

type AbortErrorCode =
  | 'aborted'
  | 'accessdenied'
  | 'addressunreachable'
  | 'blockedbyclient'
  | 'connectionaborted'
  | 'connectionclosed'
  | 'connectionfailed'
  | 'connectionrefused'
  | 'connectionreset'
  | 'internetdisconnected'
  | 'namenotresolved'
  | 'timedout'
  | 'failed';

/**
 * Declarative network mocking on top of `page.route()`.
 *
 * Cross-origin XHR (the UI calls api.demoblaze.com from www.demoblaze.com) requires CORS
 * headers on fulfilled responses and a valid answer to the browser's preflight request;
 * both are handled here so tests only describe the payload they want.
 */
export class RouteMocker {
  private readonly log = logger.child({ scope: 'RouteMocker' });
  private readonly calls: InterceptedCall[] = [];
  private readonly patterns: UrlMatcher[] = [];

  constructor(private readonly page: Page) {}

  async mockJson(url: UrlMatcher, body: unknown, options: MockResponseOptions = {}): Promise<void> {
    await this.register(url, options.times, async route => {
      await this.applyDelay(options.delayMs);
      await route.fulfill({
        status: options.status ?? 200,
        headers: RouteMocker.corsHeaders(route.request(), options.headers),
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });
  }

  async mockText(url: UrlMatcher, body: string, options: MockResponseOptions = {}): Promise<void> {
    await this.register(url, options.times, async route => {
      await this.applyDelay(options.delayMs);
      await route.fulfill({
        status: options.status ?? 200,
        headers: RouteMocker.corsHeaders(route.request(), options.headers),
        contentType: 'text/plain',
        body,
      });
    });
  }

  /** Simulates a server-side failure (500 by default). */
  async mockServerError(
    url: UrlMatcher,
    status = 500,
    body: unknown = { message: 'Internal Server Error' }
  ): Promise<void> {
    await this.mockJson(url, body, { status });
  }

  /** Simulates a network-level failure (DNS, connection reset, offline...). */
  async abort(url: UrlMatcher, errorCode: AbortErrorCode = 'failed'): Promise<void> {
    await this.register(url, undefined, route => route.abort(errorCode));
  }

  /** Lets the request through after an artificial delay. */
  async delay(url: UrlMatcher, delayMs: number): Promise<void> {
    await this.register(url, undefined, async route => {
      await this.applyDelay(delayMs);
      await route.continue();
    });
  }

  /** Fetches the real response and lets the test transform the JSON before it reaches the page. */
  async modifyJsonResponse<T>(
    url: UrlMatcher,
    transform: (payload: T) => T | Promise<T>
  ): Promise<void> {
    await this.register(url, undefined, async route => {
      const response = await route.fetch();
      const original = (await response.json()) as T;
      const modified = await transform(original);
      await route.fulfill({
        response,
        headers: RouteMocker.corsHeaders(route.request(), response.headers()),
        contentType: 'application/json',
        body: JSON.stringify(modified),
      });
    });
  }

  /** Requests intercepted so far (including those that were fulfilled or aborted). */
  interceptedCalls(filter?: UrlMatcher): InterceptedCall[] {
    if (filter === undefined) {
      return [...this.calls];
    }
    return this.calls.filter(call => RouteMocker.matches(filter, call.url));
  }

  async unrouteAll(): Promise<void> {
    for (const pattern of this.patterns) {
      await this.page.unroute(pattern);
    }
    this.patterns.length = 0;
  }

  private async register(
    url: UrlMatcher,
    times: number | undefined,
    handler: (route: Route) => Promise<void>
  ): Promise<void> {
    this.patterns.push(url);
    await this.page.route(
      url,
      async route => {
        const request = route.request();
        if (request.method() === 'OPTIONS') {
          await route.fulfill({ status: 204, headers: RouteMocker.preflightHeaders(request) });
          return;
        }
        this.calls.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData(),
          timestamp: Date.now(),
        });
        this.log.debug('Intercepted request', { method: request.method(), url: request.url() });
        await handler(route);
      },
      times === undefined ? undefined : { times }
    );
  }

  private async applyDelay(delayMs: number | undefined): Promise<void> {
    if (delayMs && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  private static matches(matcher: UrlMatcher, url: string): boolean {
    return typeof matcher === 'string'
      ? url.includes(matcher.replace(/\*/g, ''))
      : matcher.test(url);
  }

  private static corsHeaders(
    request: Request,
    extra: Record<string, string> = {}
  ): Record<string, string> {
    const origin = request.headers().origin ?? '*';
    return {
      'access-control-allow-origin': origin,
      'access-control-allow-credentials': 'true',
      ...extra,
    };
  }

  private static preflightHeaders(request: Request): Record<string, string> {
    return {
      ...RouteMocker.corsHeaders(request),
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'access-control-allow-headers':
        request.headers()['access-control-request-headers'] ?? 'content-type',
      'access-control-max-age': '600',
    };
  }
}
