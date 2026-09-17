import { expect, type Locator, type Page } from '@playwright/test';
import { retry } from '../core/retry';
import { step } from '../core/step.decorator';
import { WaitUtils } from '../core/wait-utils';
import type { Product, ProductCategory } from '../models/product.model';
import { StringUtils } from '../utils/string-utils';
import { BasePage } from './base.page';

/** Landing page: category sidebar and product grid. */
export class HomePage extends BasePage {
  protected readonly path = '/';

  readonly categoryLinks: Locator;
  readonly productCards: Locator;
  readonly productTitles: Locator;
  readonly productGrid: Locator;

  constructor(page: Page) {
    super(page);
    this.productGrid = page.locator('#tbodyid');
    this.categoryLinks = page.locator('.list-group-item');
    this.productCards = this.productGrid.locator('.card');
    this.productTitles = this.productGrid.locator('.card-title a');
  }

  async waitForReady(): Promise<void> {
    await expect(this.productCards.first()).toBeVisible();
  }

  /**
   * Navigates without requiring any product card. For scenarios where the catalog request is
   * expected to fail or return nothing, `goto()` would wait for content that never appears.
   */
  @step('Navigate to home page expecting an empty catalog')
  async gotoExpectingEmptyCatalog(): Promise<void> {
    await this.navigate(this.path);
    await this.header.expectVisible();
  }

  /**
   * Category filtering re-renders the grid from the `/bycat` response. Waiting for that
   * response (registered before the click) and for the grid to stop changing avoids
   * interacting with a stale or half-rendered grid.
   */
  @step('Select category "{0}"')
  async selectCategory(category: ProductCategory): Promise<void> {
    const categoryResponse = WaitUtils.forApiResponse(this.page, '/bycat', {
      method: 'POST',
      status: 200,
    });
    await this.categoryLinks.filter({ hasText: StringUtils.exactMatch(category) }).click();
    await categoryResponse;
    await this.waitForReady();
    await WaitUtils.forDomStable(this.productGrid, { timeout: 5_000, stableForMs: 400 });
  }

  /**
   * Opens a product from the grid. The grid can be re-rendered by a late catalog response at
   * the very moment of the click, which swallows the navigation; the click is retried when no
   * navigation follows within a short window.
   */
  @step('Open product "{0}"')
  async openProduct(productName: string): Promise<void> {
    const productLink = this.productTitles.filter({ hasText: StringUtils.exactMatch(productName) });
    await expect(productLink).toBeVisible();
    await retry(
      async () => {
        await productLink.click();
        await this.page.waitForURL(/prod\.html\?idp_=\d+/, { timeout: 5_000, waitUntil: 'commit' });
      },
      { attempts: 3, delayMs: 300, label: `Open product "${productName}"` }
    );
  }

  @step('Verify product "{0}" is listed')
  async expectProductListed(productName: string): Promise<void> {
    await expect(
      this.productTitles.filter({ hasText: StringUtils.exactMatch(productName) })
    ).toBeVisible();
  }

  @step('Verify listed products')
  async expectProductsListed(products: ReadonlyArray<Pick<Product, 'name'>>): Promise<void> {
    for (const product of products) {
      await this.expectProductListed(product.name);
    }
  }

  async expectProductCount(count: number): Promise<void> {
    await expect(this.productCards).toHaveCount(count);
  }

  async listedProductNames(): Promise<string[]> {
    await this.waitForReady();
    return (await this.productTitles.allInnerTexts()).map(name => name.trim());
  }
}
