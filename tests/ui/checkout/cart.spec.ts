import { NetworkRecorder } from '@api/interceptors/network-recorder';
import { isAddToCartRequest } from '@api/models/guards';
import { TAGS, tags } from '@config/test-tags';
import { PRODUCT_CATALOG } from '@data/static/products.catalog';
import { cartTestCases } from '@data/test-cases/cart.test-cases';
import { expect, test } from '@fixtures';

test.describe('Shopping cart', tags(TAGS.ui, TAGS.cart), () => {
  test.describe('adding products through the UI', tags(TAGS.smoke, TAGS.regression), () => {
    for (const scenario of cartTestCases) {
      test(`shows the correct items and total for ${scenario.description}`, async ({
        cartWorkflow,
        cartPage,
      }) => {
        const outcomes = await cartWorkflow.addProductsToCart(scenario.products);
        expect(outcomes, 'every product should trigger a confirmation alert').toHaveLength(
          scenario.products.length
        );

        await cartPage.goto();
        await cartPage.expectItems(scenario.products);
      });
    }

    test('sends the selected product id to the cart API', async ({
      homePage,
      productPage,
      networkRecorder,
      testData,
    }) => {
      const product = testData.products.get('nexus6');
      await homePage.goto();
      await homePage.selectCategory(product.category);
      await homePage.openProduct(product.name);

      await productPage.addToCart();

      const request = await networkRecorder.waitForCompleted('/addtocart', { method: 'POST' });
      const payload = NetworkRecorder.postDataAs(request, isAddToCartRequest);
      expect(payload.prod_id).toBe(product.id);
      expect(payload.flag, 'anonymous shoppers use the cookie-keyed cart').toBe(false);
      expect(request.status).toBe(200);
    });
  });

  test.describe('managing the cart', tags(TAGS.regression), () => {
    test('is empty for a new visitor', tags(TAGS.edgeCase), async ({ homePage, cartPage }) => {
      // A real visitor lands on the home page first, which is where the application assigns
      // the anonymous cart cookie; opening the cart without it lists unrelated orphan lines.
      await homePage.goto();
      await cartPage.expectEmpty();
    });

    test('removes a product and updates the total', async ({
      cartPreconditions,
      cartPage,
      context,
      testData,
    }) => {
      const cart = testData.builders.cart().withProducts('samsungGalaxyS6', 'macbookAir').build();
      await cartPreconditions.seedAnonymousCart(context, cart.products);
      await cartPage.goto();
      await cartPage.expectItems(cart.products);

      await cartPage.deleteItem(PRODUCT_CATALOG.samsungGalaxyS6.name);

      await cartPage.expectItems([PRODUCT_CATALOG.macbookAir]);
    });

    test('keeps its items after the page is reloaded', async ({
      cartPreconditions,
      cartPage,
      context,
      testData,
    }) => {
      const cart = testData.builders
        .cart()
        .withProducts('appleMonitor24', 'nokiaLumia1520')
        .build();
      await cartPreconditions.seedAnonymousCart(context, cart.products);
      await cartPage.goto();
      await cartPage.expectItems(cart.products);

      await cartPage.reload();

      await cartPage.expectItems(cart.products);
    });

    test(
      'removes every line one by one until the cart is empty',
      tags(TAGS.edgeCase),
      async ({ cartPreconditions, cartPage, context, testData }) => {
        const cart = testData.builders.cart().withProducts('asusFullHd', 'asusFullHd').build();
        await cartPreconditions.seedAnonymousCart(context, cart.products);
        await cartPage.goto();
        await cartPage.expectItems(cart.products);

        await cartPage.deleteItem(PRODUCT_CATALOG.asusFullHd.name);
        await cartPage.expectItems([PRODUCT_CATALOG.asusFullHd]);

        await cartPage.deleteItem(PRODUCT_CATALOG.asusFullHd.name);
        await cartPage.expectEmpty();
      }
    );
  });
});
