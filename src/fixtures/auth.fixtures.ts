import { requireCredentials } from '../config/environment';
import type { AuthenticatedUser, UserCredentials } from '../models/user.model';
import { apiTest } from './api.fixtures';

export interface AuthFixtures {
  /**
   * The shared account from TEST_USERNAME / TEST_PASSWORD. The `setup` project guarantees it
   * exists before browser projects run.
   */
  sharedUser: UserCredentials;
  /**
   * A brand-new account registered and logged in through the API; the session cookie is
   * injected into the browser context, so the next navigation is already authenticated.
   * Each test gets its own user, which keeps server-side carts isolated across workers.
   */
  authenticatedUser: AuthenticatedUser;
}

export const authTest = apiTest.extend<AuthFixtures>({
  sharedUser: async ({}, use) => {
    await use(requireCredentials());
  },

  authenticatedUser: async ({ context, authPreconditions }, use) => {
    const user = await authPreconditions.createAuthenticatedUser(context);
    await use(user);
  },
});
