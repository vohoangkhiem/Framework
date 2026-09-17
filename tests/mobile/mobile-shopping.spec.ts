import { TAGS, tags } from '@config/test-tags';
import { PRODUCT_CATALOG } from '@data/static/products.catalog';
import { test } from '@fixtures';

/**
 * Device-emulation journeys for the `mobile-chrome` (Pixel 7) and `mobile-safari` (iPhone 14)
 * projects. The page objects are viewport-agnostic; the one responsive difference on Demoblaze is
 * the collapsed navigation, which `HeaderComponent.expandMenu()` handles.
 */
test.describe('Mobile shopping', tags(TAGS.mobile, TAGS.ui, TAGS.cart, TAGS.smoke), () => {
  test('browses a category, adds a product and reviews the cart on a phone', async ({
    homePage,
    productPage,
    cartPage,
  }) => {
    const product = PRODUCT_CATALOG.nexus6;

    await homePage.goto();
    await homePage.selectCategory(product.category);
    await homePage.openProduct(product.name);
    await productPage.expectProduct(product);
    await productPage.addToCart();

    await cartPage.goto();
    await cartPage.expectItems([product]);
  });

  test('exposes the authentication links through the collapsed navigation', async ({
    homePage,
  }) => {
    await homePage.goto();

    await homePage.header.expandMenu();

    await homePage.header.expectLoggedOut();
  });
});
