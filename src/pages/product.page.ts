import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { config } from '../config/environment';
import { step } from '../core/step.decorator';
import { WaitUtils } from '../core/wait-utils';
import { alertMessages } from '../data/static/messages';
import type { Product } from '../models/product.model';
import { handleDialog } from '../utils/dialog-utils';
import { NumberUtils } from '../utils/number-utils';
import { BasePage } from './base.page';

export interface AddToCartOutcome {
  /** Native alert text ("Product added" / "Product added."). */
  alertMessage: string;
  /** The `/addtocart` API response that preceded the alert. */
  response: Response;
}

/** Product detail page (`prod.html?idp_=<id>`). */
export class ProductPage extends BasePage {
  protected readonly path = '/prod.html';

  readonly title: Locator;
  readonly price: Locator;
  readonly description: Locator;
  readonly addToCartButton: Locator;

  constructor(page: Page) {
    super(page);
    this.title = page.locator('#tbodyid h2.name');
    this.price = page.locator('#tbodyid h3.price-container');
    this.description = page.locator('#more-information');
    this.addToCartButton = page.locator('#tbodyid a.btn-success', { hasText: 'Add to cart' });
  }

  /**
   * `#tbodyid` is empty when the document commits: `prod.js` first loads `config.json`, then
   * POSTs `/view`, and only that response appends the title, price and "Add to cart" button.
   * Readiness is therefore an API round-trip made after navigation and is budgeted like one.
   * The default expect timeout proved too short on a loaded engine (WebKit in the CI container),
   * where it surfaced as "element(s) not found" for `h2.name` and the button.
   */
  async waitForReady(): Promise<void> {
    await expect(this.title, 'product details (POST /view) were not rendered').toBeVisible({
      timeout: config.timeouts.navigation,
    });
    await expect(this.addToCartButton).toBeVisible();
  }

  @step('Open product page for id {0}')
  async gotoProduct(productId: number): Promise<void> {
    await this.navigate(`${this.path}?idp_=${productId}`);
    await this.waitForReady();
  }

  @step('Verify product details for "{0}"')
  async expectProduct(product: Pick<Product, 'name' | 'price'>): Promise<void> {
    // Callers arrive here straight after the navigation commits; wait for the details to render
    // so the expect budget below is spent on comparing values, not on the `/view` round-trip.
    await this.waitForReady();
    await expect(this.title).toHaveText(product.name);
    await expect(this.price).toContainText(`$${product.price}`);
  }

  async displayedPrice(): Promise<number> {
    return NumberUtils.parsePrice(await this.price.innerText());
  }

  /**
   * Adds the product to the cart and waits for both the API confirmation and the native
   * alert. The response promise is registered before clicking so a fast response cannot be
   * missed; the dialog listener is registered inside `handleDialog` for the same reason.
   */
  @step('Add product to cart')
  async addToCart(): Promise<AddToCartOutcome> {
    await this.waitForReady();
    const responsePromise = WaitUtils.forApiResponse(this.page, '/addtocart', { method: 'POST' });
    const alertMessage = await handleDialog(
      this.page,
      () => this.addToCartButton.click(),
      alertMessages.productAdded
    );
    const response = await responsePromise;
    expect(response.ok(), `POST /addtocart responded with ${response.status()}`).toBe(true);
    return { alertMessage, response };
  }
}
