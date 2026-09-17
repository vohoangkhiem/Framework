import { TAGS, tags } from '@config/test-tags';
import { OrderFactory } from '@data/factories/order.factory';
import { alertMessages } from '@data/static/messages';
import { PRODUCT_CATALOG } from '@data/static/products.catalog';
import { singleProductCart } from '@data/test-cases/cart.test-cases';
import { orderTestCases, orderValidationTestCases } from '@data/test-cases/order.test-cases';
import { expect, test } from '@fixtures';
import type { OrderConfirmation } from '@models/order.model';
import { DateUtils } from '@utils/date-utils';

/** The confirmation date is rendered by the browser at purchase time; accept the day before and after the call. */
function expectConfirmationDate(confirmation: OrderConfirmation, submittedAt: Date): void {
  const acceptedDates = [
    DateUtils.formatDemoblazeOrderDate(submittedAt),
    DateUtils.formatDemoblazeOrderDate(new Date()),
  ];
  expect(acceptedDates, 'confirmation date should reflect the purchase day').toContain(
    confirmation.date
  );
}

test.describe('Place order', tags(TAGS.e2e, TAGS.checkout), () => {
  test.describe('successful purchase', tags(TAGS.smoke, TAGS.regression), () => {
    // Full UI journeys (browse -> product -> cart -> order) for several products legitimately
    // exceed the default per-test budget on slower engines.
    test.slow();
    for (const testCase of orderTestCases) {
      test(
        testCase.description,
        async ({ cartWorkflow, placeOrderPage, homePage, cartPage, logger }) => {
          const submittedAt = new Date();

          const confirmation = await cartWorkflow.checkout(testCase.cart, testCase.orderData);
          logger.info('Order confirmed', { orderId: confirmation.id, amount: confirmation.amount });

          expect(confirmation.id, 'order id should be a positive number').toBeGreaterThan(0);
          expect(confirmation.amount).toBe(testCase.cart.expectedTotal);
          expect(confirmation.cardNumber).toBe(testCase.orderData.creditCard);
          expect(confirmation.name).toBe(testCase.orderData.name);
          expectConfirmationDate(confirmation, submittedAt);

          await placeOrderPage.confirmation.confirm();
          await homePage.expectUrlContains('index.html');
          await homePage.waitForReady();
          await cartPage.expectEmpty();
        }
      );
    }
  });

  test.describe('form validation', tags(TAGS.negative, TAGS.regression), () => {
    for (const testCase of orderValidationTestCases) {
      test(
        testCase.description,
        async ({ cartPreconditions, cartPage, placeOrderPage, context }) => {
          await cartPreconditions.seedAnonymousCart(context, singleProductCart.products);
          await cartPage.goto();
          await cartPage.expectItems(singleProductCart.products);
          await cartPage.clickPlaceOrder();

          const alertMessage = await placeOrderPage.submitExpectingValidationAlert(
            testCase.orderData
          );

          expect(alertMessage).toBe(testCase.expectedMessage);
          await placeOrderPage.close();
          await cartPage.expectItems(singleProductCart.products);
        }
      );
    }
  });

  test.describe('edge cases', tags(TAGS.edgeCase, TAGS.regression), () => {
    test.slow();

    test('charges the updated total after removing an item before checkout', async ({
      cartPreconditions,
      cartPage,
      placeOrderPage,
      context,
      testData,
    }) => {
      const cart = testData.builders.cart().withProducts('samsungGalaxyS6', 'macbookPro').build();
      await cartPreconditions.seedAnonymousCart(context, cart.products);
      await cartPage.goto();
      await cartPage.expectItems(cart.products);

      await cartPage.deleteItem(PRODUCT_CATALOG.samsungGalaxyS6.name);
      await cartPage.expectTotal(PRODUCT_CATALOG.macbookPro.price);
      await cartPage.clickPlaceOrder();
      const confirmation = await placeOrderPage.purchase(OrderFactory.valid());

      expect(confirmation.amount).toBe(PRODUCT_CATALOG.macbookPro.price);
      await placeOrderPage.confirmation.confirm();
    });

    test('closing the order form keeps the cart intact', async ({
      cartPreconditions,
      cartPage,
      placeOrderPage,
      context,
    }) => {
      await cartPreconditions.seedAnonymousCart(context, singleProductCart.products);
      await cartPage.goto();
      await cartPage.clickPlaceOrder();
      await placeOrderPage.fillForm(OrderFactory.valid());

      await placeOrderPage.close();

      await cartPage.expectItems(singleProductCart.products);
    });

    test('places an order as a logged-in shopper', async ({
      authenticatedUser,
      cartWorkflow,
      cartPage,
      placeOrderPage,
      homePage,
    }) => {
      const submittedAt = new Date();
      const product = PRODUCT_CATALOG.sonyXperiaZ5;

      const [outcome] = await cartWorkflow.addProductsToCart([product]);
      expect(outcome?.alertMessage, 'logged-in shoppers get the "Product added." variant').toBe(
        alertMessages.productAddedLoggedIn
      );

      await cartPage.goto();
      await cartPage.header.expectLoggedIn(authenticatedUser.username);
      await cartPage.expectItems([product]);
      const confirmation = await cartWorkflow.placeOrder(OrderFactory.valid());

      expect(confirmation.amount).toBe(product.price);
      expectConfirmationDate(confirmation, submittedAt);
      await placeOrderPage.confirmation.confirm();
      await homePage.header.expectLoggedIn(authenticatedUser.username);
    });
  });
});
