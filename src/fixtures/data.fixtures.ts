import { test as base } from '@playwright/test';
import { CartBuilder } from '../data/builders/cart.builder';
import { OrderBuilder } from '../data/builders/order.builder';
import { UserBuilder } from '../data/builders/user.builder';
import { OrderFactory } from '../data/factories/order.factory';
import { UserFactory } from '../data/factories/user.factory';
import { ProductCatalog } from '../data/static/products.catalog';

export interface TestData {
  users: typeof UserFactory;
  orders: typeof OrderFactory;
  products: typeof ProductCatalog;
  builders: {
    user: () => UserBuilder;
    order: () => OrderBuilder;
    cart: () => CartBuilder;
  };
}

export interface DataFixtures {
  /** Single entry point to factories, builders and the static catalog. */
  testData: TestData;
}

export const dataTest = base.extend<DataFixtures>({
  testData: async ({}, use) => {
    await use({
      users: UserFactory,
      orders: OrderFactory,
      products: ProductCatalog,
      builders: {
        user: () => UserBuilder.aUser(),
        order: () => OrderBuilder.anOrder(),
        cart: () => CartBuilder.aCart(),
      },
    });
  },
});
