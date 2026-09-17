import { config, hasStoredAuthState } from '@config/environment';
import { TAGS, tags } from '@config/test-tags';
import { test } from '@fixtures';

/**
 * Demonstrates the storage-state pattern: the `setup` project logged in once through the API
 * and saved the browser state; these tests start already authenticated.
 *
 * The state file is produced after spec collection, so its presence is evaluated lazily (in the
 * `storageState` option fixture and in `beforeEach`) rather than at module load time.
 */
test.describe(
  'Authenticated session (storage state)',
  tags(TAGS.ui, TAGS.auth, TAGS.regression),
  () => {
    test.use({
      storageState: async ({}, use) => {
        await use(hasStoredAuthState() ? config.paths.authState : undefined);
      },
    });

    test.beforeEach(() => {
      test.skip(
        !hasStoredAuthState(),
        'Storage state missing: the setup project did not run or was skipped.'
      );
    });

    test('shows the shared user as logged in without using the login form', async ({
      homePage,
      sharedUser,
    }) => {
      await homePage.goto();
      await homePage.header.expectLoggedIn(sharedUser.username);
    });

    test('keeps the user logged in while navigating to the cart', async ({
      homePage,
      cartPage,
      sharedUser,
    }) => {
      await homePage.goto();
      await homePage.header.openCart();
      await cartPage.waitForReady();
      await cartPage.header.expectLoggedIn(sharedUser.username);
    });
  }
);
