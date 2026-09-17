import type { BrowserContext } from '@playwright/test';
import { config } from '../../config/environment';
import { logger } from '../../core/logger';
import { WaitUtils } from '../../core/wait-utils';
import type { Product } from '../../models/product.model';
import type { AuthenticatedUser } from '../../models/user.model';
import { RandomUtils } from '../../utils/random-utils';
import { StorageUtils } from '../../utils/storage-utils';
import type { CartApiClient, CartKey } from '../clients/cart-api.client';

/** Cookie the application uses to identify anonymous shoppers. */
export const ANONYMOUS_CART_COOKIE_NAME = 'user';

export interface SeededCart {
  key: CartKey;
  /** Cart line ids in the order the products were added. */
  lineIds: string[];
}

/**
 * API-based cart preconditions.
 *
 * Anonymous carts are keyed by the browser's complete `document.cookie` string. By setting a
 * single, known `user` cookie in a fresh context we make that key deterministic
 * ("user=<uuid>") and can populate the cart before the page is even opened.
 */
export class CartPreconditions {
  private readonly log = logger.child({ scope: 'CartPreconditions' });

  constructor(private readonly cartApi: CartApiClient) {}

  async seedAnonymousCart(
    context: BrowserContext,
    products: readonly Product[]
  ): Promise<SeededCart> {
    const cartId = RandomUtils.uuid();
    await StorageUtils.setCookie(context, {
      name: ANONYMOUS_CART_COOKIE_NAME,
      value: cartId,
      url: config.baseUrl,
    });
    const key: CartKey = {
      cookie: `${ANONYMOUS_CART_COOKIE_NAME}=${cartId}`,
      authenticated: false,
    };
    return this.seed(key, products);
  }

  async seedAuthenticatedCart(
    user: AuthenticatedUser,
    products: readonly Product[]
  ): Promise<SeededCart> {
    return this.seed(
      { cookie: user.token, authenticated: true, username: user.username },
      products
    );
  }

  async getProductIds(key: CartKey): Promise<number[]> {
    const items = await this.cartApi.viewCart(key);
    return items.map(item => item.prod_id);
  }

  async clearCart(key: CartKey): Promise<void> {
    await this.cartApi.deleteCart(key);
    this.log.debug('Cleared cart', { authenticated: key.authenticated });
  }

  private async seed(key: CartKey, products: readonly Product[]): Promise<SeededCart> {
    const lineIds: string[] = [];
    for (const product of products) {
      lineIds.push(await this.cartApi.addToCart(key, product.id));
    }
    // The backend is eventually consistent: confirm the writes are readable before the UI
    // (which fetches the cart exactly once on page load) depends on them.
    const expectedIds = products.map(product => product.id).sort((left, right) => left - right);
    await WaitUtils.forValue(
      () => this.getProductIds(key),
      ids =>
        ids.length === expectedIds.length &&
        [...ids]
          .sort((left, right) => left - right)
          .every((id, index) => id === expectedIds[index]),
      {
        timeout: 10_000,
        interval: 300,
        message: 'Seeded cart items were not readable through the API',
      }
    );
    this.log.info('Seeded cart through API', {
      authenticated: key.authenticated,
      products: products.map(product => product.name).join(', '),
    });
    return { key, lineIds };
  }
}
