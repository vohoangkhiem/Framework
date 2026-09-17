import { TAGS, tags } from '@config/test-tags';
import { DialogTimeoutError } from '@core/errors';
import { expect, test } from '@fixtures';
import { handleDialog } from '@utils/dialog-utils';

/**
 * Regression tests for the dialog helper that every alert-driven flow (login errors, sign-up,
 * add to cart, order validation) relies on. They run against a static document, so they exercise
 * the framework rather than the application, which is why raw `page` calls are acceptable here.
 */
test.describe('handleDialog', tags(TAGS.framework), () => {
  test.beforeEach(async ({ page }) => {
    await page.setContent('<button id="trigger">trigger</button>');
  });

  test('captures a dialog raised synchronously by the action', async ({ page }) => {
    const message = await handleDialog(page, () => page.evaluate(() => window.alert('immediate')));

    expect(message).toBe('immediate');
  });

  test('starts the timeout clock only after the action has completed', async ({ page }) => {
    // The action itself outlasts the dialog budget and the alert fires only afterwards. Measuring
    // from before the action (the original implementation) reported a false timeout here.
    const message = await handleDialog(
      page,
      () =>
        page.evaluate(
          () =>
            new Promise<void>(resolve => {
              setTimeout(() => {
                setTimeout(() => window.alert('late'), 50);
                resolve();
              }, 600);
            })
        ),
      { timeout: 300 }
    );

    expect(message).toBe('late');
  });

  test('fails with DialogTimeoutError when no dialog appears', async ({ page }) => {
    await expect(
      handleDialog(page, () => page.locator('#trigger').click(), { timeout: 200 })
    ).rejects.toBeInstanceOf(DialogTimeoutError);
  });

  test('detaches its listener after a timeout so later dialogs are not swallowed', async ({
    page,
  }) => {
    await expect(
      handleDialog(page, () => page.locator('#trigger').click(), { timeout: 200 })
    ).rejects.toBeInstanceOf(DialogTimeoutError);

    const message = await handleDialog(page, () => page.evaluate(() => window.alert('second')));

    expect(message).toBe('second');
  });

  test('asserts the expected message when one is provided', async ({ page }) => {
    await expect(
      handleDialog(page, () => page.evaluate(() => window.alert('actual')), 'expected')
    ).rejects.toThrow(/Unexpected dialog message/);

    const message = await handleDialog(
      page,
      () => page.evaluate(() => window.alert('Product added.')),
      /^Product added\.?$/
    );
    expect(message).toBe('Product added.');
  });
});
