import { step } from '../core/step.decorator';
import type { CartScenario } from '../data/builders/cart.builder';
import type { OrderConfirmation, OrderFormData } from '../models/order.model';
import type { Product } from '../models/product.model';
import type { CartPage } from '../pages/cart.page';
import type { HomePage } from '../pages/home.page';
import type { PlaceOrderPage } from '../pages/place-order.page';
import type { AddToCartOutcome, ProductPage } from '../pages/product.page';

/** UI-driven shopping journeys: browse -> add to cart -> review cart -> place order. */
export class CartWorkflow {
  constructor(
    private readonly homePage: HomePage,
    private readonly productPage: ProductPage,
    private readonly cartPage: CartPage,
    private readonly placeOrderPage: PlaceOrderPage
  ) {}

  /** Adds each product through the UI (category -> product page -> "Add to cart"). */
  @step('Add products to cart through the UI')
  async addProductsToCart(products: readonly Product[]): Promise<AddToCartOutcome[]> {
    const outcomes: AddToCartOutcome[] = [];
    for (const product of products) {
      await this.homePage.goto();
      await this.homePage.selectCategory(product.category);
      await this.homePage.openProduct(product.name);
      await this.productPage.expectProduct(product);
      outcomes.push(await this.productPage.addToCart());
    }
    return outcomes;
  }

  @step('Open cart and verify its contents')
  async openCartAndVerify(scenario: CartScenario): Promise<void> {
    await this.cartPage.goto();
    await this.cartPage.expectItems(scenario.products);
    await this.cartPage.expectTotal(scenario.expectedTotal);
  }

  /** Opens the "Place order" modal from an already populated cart and completes the purchase. */
  @step('Place order from cart')
  async placeOrder(order: OrderFormData): Promise<OrderConfirmation> {
    await this.cartPage.clickPlaceOrder();
    return this.placeOrderPage.purchase(order);
  }

  /** End-to-end checkout: add products via UI, verify the cart, and purchase. */
  @step('Checkout end-to-end')
  async checkout(scenario: CartScenario, order: OrderFormData): Promise<OrderConfirmation> {
    await this.addProductsToCart(scenario.products);
    await this.openCartAndVerify(scenario);
    return this.placeOrder(order);
  }
}
