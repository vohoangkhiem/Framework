import type { CartKey } from '@api/clients/cart-api.client';
import { TAGS, tags } from '@config/test-tags';
import { expect, test } from '@fixtures';
import { RandomUtils } from '@utils/random-utils';

function anonymousCartKey(): CartKey {
  return { cookie: `user=${RandomUtils.uuid()}`, authenticated: false };
}

test.describe('Cart API', tags(TAGS.api, TAGS.cart, TAGS.regression), () => {
  test('returns an empty cart for an unknown key', tags(TAGS.edgeCase), async ({ cartApi }) => {
    const items = await cartApi.viewCart(anonymousCartKey());

    expect(items).toHaveLength(0);
  });

  test('adds, lists and removes a line in an anonymous cart', async ({ cartApi, testData }) => {
    const key = anonymousCartKey();
    const product = testData.products.get('samsungGalaxyS6');

    const lineId = await cartApi.addToCart(key, product.id);

    // Reads are eventually consistent; poll instead of asserting once.
    await expect
      .poll(async () => (await cartApi.viewCart(key)).map(item => item.prod_id))
      .toStrictEqual([product.id]);
    const [line] = await cartApi.viewCart(key);
    expect(line?.id).toBe(lineId);

    await cartApi.deleteItem(lineId);
    await expect.poll(async () => (await cartApi.viewCart(key)).length).toBe(0);
  });

  test('clears a whole cart at once', async ({ cartApi, testData }) => {
    const key = anonymousCartKey();
    await cartApi.addToCart(key, testData.products.get('macbookAir').id);
    await cartApi.addToCart(key, testData.products.get('appleMonitor24').id);
    await expect.poll(async () => (await cartApi.viewCart(key)).length).toBe(2);

    await cartApi.deleteCart(key);

    await expect.poll(async () => (await cartApi.viewCart(key)).length).toBe(0);
  });

  test('keeps an authenticated cart separate from anonymous carts', async ({
    cartApi,
    authPreconditions,
    testData,
  }) => {
    const user = await authPreconditions.ensureUserExists(testData.users.unique());
    const token = await authPreconditions.obtainToken(user);
    const authenticatedKey: CartKey = {
      cookie: token,
      authenticated: true,
      username: user.username,
    };
    const product = testData.products.get('nexus6');

    await cartApi.addToCart(authenticatedKey, product.id);

    await expect
      .poll(async () => (await cartApi.viewCart(authenticatedKey)).map(item => item.prod_id))
      .toStrictEqual([product.id]);
    expect(await cartApi.viewCart(anonymousCartKey())).toHaveLength(0);

    await cartApi.deleteCart(authenticatedKey);
    await expect.poll(async () => (await cartApi.viewCart(authenticatedKey)).length).toBe(0);
  });
});
