import { config } from '@config/environment';
import { test as setup, expect } from '@fixtures';

/**
 * Runs once before the browser projects (declared as a project dependency).
 *
 * 1. Guarantees the shared account (TEST_USERNAME / TEST_PASSWORD) exists, so negative login
 *    tests can rely on a real "wrong password" scenario.
 * 2. Authenticates through the API and persists the browser storage state, so suites that
 *    need a logged-in user can start there with `test.use({ storageState })` instead of
 *    repeating the login UI flow.
 */
setup(
  'prepare shared account and authenticated storage state',
  async ({ context, page, authPreconditions, logger }) => {
    const { username, password } = config.credentials;
    setup.skip(
      !username || !password,
      'TEST_USERNAME / TEST_PASSWORD are not configured; suites relying on the shared account will be skipped or fail fast.'
    );

    const user = await authPreconditions.ensureUserExists({ username, password });
    const authenticated = await authPreconditions.authenticateContext(context, user);
    expect(authenticated.token, 'API login should return a session token').toBeTruthy();

    await page.goto('/');
    await expect(page.locator('#nameofuser')).toHaveText(`Welcome ${user.username}`);

    await context.storageState({ path: config.paths.authState });
    logger.info('Stored authenticated state', {
      path: config.paths.authState,
      username: user.username,
    });
  }
);
