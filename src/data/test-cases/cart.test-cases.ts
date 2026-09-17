import { CartBuilder, type CartScenario } from '../builders/cart.builder';

export type { CartScenario } from '../builders/cart.builder';

export const singleProductCart: CartScenario = CartBuilder.aCart()
  .describedAs('a single product')
  .withProduct('samsungGalaxyS6')
  .build();

export const multiCategoryCart: CartScenario = CartBuilder.aCart()
  .describedAs('multiple products from different categories')
  .withProducts('samsungGalaxyS6', 'macbookAir', 'appleMonitor24')
  .build();

export const duplicateProductCart: CartScenario = CartBuilder.aCart()
  .describedAs('the same product added twice')
  .withProducts('asusFullHd', 'asusFullHd')
  .build();

export const cartTestCases: readonly CartScenario[] = [
  singleProductCart,
  multiCategoryCart,
  duplicateProductCart,
];
