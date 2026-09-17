import { TAGS, tags } from '@config/test-tags';
import { expect, test } from '@fixtures';
import { PerformanceUtils } from '@utils/performance-utils';

/**
 * Lightweight performance signals collected during functional runs. Real load testing lives
 * in /performance (k6, Artillery); these budgets only catch gross regressions early.
 */
test.describe('Performance signals', tags(TAGS.performance), () => {
  test('home page navigation timing stays within budget', async ({ homePage, page }, testInfo) => {
    await homePage.goto();

    const metrics = await PerformanceUtils.measurePagePerformance(page);
    await PerformanceUtils.attachMetrics(testInfo, 'navigation-timing', { ...metrics });

    expect(metrics.domContentLoaded, 'DOMContentLoaded should be measurable').toBeGreaterThan(0);
    PerformanceUtils.assertWithinSla(metrics.ttfb, 5_000, 'Time to first byte');
    PerformanceUtils.assertWithinSla(metrics.domContentLoaded, 15_000, 'DOMContentLoaded');
  });

  test('catalog API responds within SLA', async ({ catalogApi }, testInfo) => {
    const { durationMs, raw } = await catalogApi.getEntries();
    await PerformanceUtils.attachMetrics(testInfo, 'api-timing', { entriesDurationMs: durationMs });

    expect(raw).toBeSuccessful();
    PerformanceUtils.assertWithinSla(durationMs, 5_000, 'GET /entries');
  });
});
