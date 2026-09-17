import type { APIRequestContext } from '@playwright/test';
import { RandomUtils } from '../../utils/random-utils';
import type { AddToCartRequest, CartItem } from '../models/cart.models';
import { viewCartResponseSchema } from '../schemas';
import { BaseApiClient, type ApiClientOptions } from './base-api.client';

/**
 * Identifies a server-side cart.
 *
 * - Anonymous shoppers: `cookie` is the browser's `document.cookie` string, `authenticated` false.
 * - Logged-in shoppers: `cookie` is the session token, `authenticated` true. The backend stores
 *   authenticated carts under the *username*, which is what `/deletecart` expects (the UI passes
 *   the username there), so `username` must be provided to clear such a cart.
 */
export interface CartKey {
  cookie: string;
  authenticated: boolean;
  username?: string;
}

/** Client for the shopping-cart endpoints. */
export class CartApiClient extends BaseApiClient {
  constructor(request: APIRequestContext, options: ApiClientOptions = {}) {
    super(request, { name: 'CartApi', ...options });
  }

  /** Adds a product and returns the generated cart line id (needed for `deleteItem`). */
  async addToCart(key: CartKey, productId: number): Promise<string> {
    const payload: AddToCartRequest = {
      id: RandomUtils.uuid(),
      cookie: key.cookie,
      prod_id: productId,
      flag: key.authenticated,
    };
    const response = await this.post('/addtocart', { data: payload });
    await this.assertOk(response, 'POST', '/addtocart');
    return payload.id;
  }

  async viewCart(key: CartKey): Promise<CartItem[]> {
    const result = await this.sendJson('POST', '/viewcart', viewCartResponseSchema, {
      data: { cookie: key.cookie, flag: key.authenticated },
    });
    return result.data.Items;
  }

  async deleteItem(itemId: string): Promise<void> {
    const response = await this.post('/deleteitem', { data: { id: itemId } });
    await this.assertOk(response, 'POST', '/deleteitem');
  }

  async deleteCart(key: CartKey): Promise<void> {
    const cartOwner = key.authenticated ? key.username : key.cookie;
    if (!cartOwner) {
      throw new TypeError('Clearing an authenticated cart requires the username in the CartKey');
    }
    const response = await this.post('/deletecart', { data: { cookie: cartOwner } });
    await this.assertOk(response, 'POST', '/deletecart');
  }
}
