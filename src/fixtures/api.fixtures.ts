import { test as base, type APIRequestContext } from '@playwright/test';
import { AuthApiClient } from '../api/clients/auth-api.client';
import { CartApiClient } from '../api/clients/cart-api.client';
import { CatalogApiClient } from '../api/clients/catalog-api.client';
import { AuthPreconditions } from '../api/preconditions/auth.preconditions';
import { CartPreconditions } from '../api/preconditions/cart.preconditions';
import { config } from '../config/environment';

export interface ApiFixtures {
  /** Request context bound to API_BASE_URL with JSON headers; disposed after each test. */
  apiContext: APIRequestContext;
  authApi: AuthApiClient;
  catalogApi: CatalogApiClient;
  cartApi: CartApiClient;
  authPreconditions: AuthPreconditions;
  cartPreconditions: CartPreconditions;
}

/**
 * API fixtures. Usable on their own (project "api", no browser) and alongside UI fixtures
 * to establish preconditions through the API before driving the UI.
 */
export const apiTest = base.extend<ApiFixtures>({
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: config.apiBaseUrl,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    await use(context);
    await context.dispose();
  },

  authApi: async ({ apiContext }, use) => {
    await use(new AuthApiClient(apiContext));
  },

  catalogApi: async ({ apiContext }, use) => {
    await use(new CatalogApiClient(apiContext));
  },

  cartApi: async ({ apiContext }, use) => {
    await use(new CartApiClient(apiContext));
  },

  authPreconditions: async ({ authApi }, use) => {
    await use(new AuthPreconditions(authApi));
  },

  cartPreconditions: async ({ cartApi }, use) => {
    await use(new CartPreconditions(cartApi));
  },
});
