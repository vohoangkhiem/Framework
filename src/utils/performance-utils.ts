import { expect, type Page, type TestInfo } from '@playwright/test';

export interface PagePerformanceMetrics {
  dns: number;
  tcp: number;
  ttfb: number;
  domContentLoaded: number;
  loadTime: number;
  transferSizeBytes: number;
}

export interface TimedResult<T> {
  result: T;
  durationMs: number;
}

/**
 * Lightweight client-side performance probes. They give early SLA signals inside functional
 * runs; heavy load testing lives in /performance (k6, Artillery).
 */
export const PerformanceUtils = {
  /** Reads Navigation Timing Level 2 metrics from the current document. */
  async measurePagePerformance(page: Page): Promise<PagePerformanceMetrics> {
    return page.evaluate(() => {
      const [entry] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (!entry) {
        return { dns: 0, tcp: 0, ttfb: 0, domContentLoaded: 0, loadTime: 0, transferSizeBytes: 0 };
      }
      return {
        dns: Math.round(entry.domainLookupEnd - entry.domainLookupStart),
        tcp: Math.round(entry.connectEnd - entry.connectStart),
        ttfb: Math.round(entry.responseStart - entry.requestStart),
        domContentLoaded: Math.round(entry.domContentLoadedEventEnd - entry.startTime),
        loadTime: Math.round(entry.loadEventEnd - entry.startTime),
        transferSizeBytes: Math.round(entry.transferSize),
      };
    });
  },

  /** Times any async operation (API call, navigation, workflow). */
  async measure<T>(operation: () => Promise<T>): Promise<TimedResult<T>> {
    const started = Date.now();
    const result = await operation();
    return { result, durationMs: Date.now() - started };
  },

  assertWithinSla(durationMs: number, maxAllowedMs: number, label = 'Operation'): void {
    expect(durationMs, `${label} exceeded SLA of ${maxAllowedMs} ms`).toBeLessThanOrEqual(
      maxAllowedMs
    );
  },

  async attachMetrics(
    testInfo: TestInfo,
    name: string,
    metrics: Record<string, number>
  ): Promise<void> {
    await testInfo.attach(name, {
      body: JSON.stringify(metrics, null, 2),
      contentType: 'application/json',
    });
  },
} as const;
