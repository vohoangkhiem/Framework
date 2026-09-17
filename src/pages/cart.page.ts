import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { viewCartResponseSchema } from '../api/schemas';
import { config } from '../config/environment';
import { step } from '../core/step.decorator';
import { WaitUtils } from '../core/wait-utils';
import type { CartLine, Product } from '../models/product.model';
import { NumberUtils } from '../utils/number-utils';
import { StringUtils } from '../utils/string-utils';
import { BasePage } from './base.page';

/**
 * Shopping cart page. Rows are rendered incrementally: `/viewcart` returns the line ids,
 * then one `/view` request per line fills in title and price. Every assertion below is a
 * web-first assertion so it naturally waits for that rendering to settle.
 */
export class CartPage extends BasePage {
  protected readonly path = '/cart.html';

  readonly table: Locator;
  readonly rows: Locator;
  readonly total: Locator;
  readonly placeOrderButton: Locator;
  private lastLoadedItemCount: number | undefined;

  constructor(page: Page) {
    super(page);
    this.table = page.locator('#tbodyid');
    this.rows = this.table.locator('tr.success');
    this.total = page.locator('#totalp');
    this.placeOrderButton = page.locator('button', { hasText: 'Place Order' });
  }

  async waitForReady(): Promise<void> {
    await expect(this.placeOrderButton).toBeVisible();
  }

  /** Navigates and waits for the cart contents request so that "empty" is a real, settled state. */
  @step('Open cart page')
  override async goto(): Promise<void> {
    const cartLoaded = WaitUtils.forApiResponse(this.page, '/viewcart', {
      method: 'POST',
      timeout: config.timeouts.navigation,
    });
    await this.navigate(this.path);
    this.lastLoadedItemCount = await CartPage.readItemCount(await cartLoaded);
    await this.waitForReady();
  }

  @step('Verify cart contains expected products')
  async expectItems(products: readonly Product[]): Promise<void> {
    await expect(this.rows).toHaveCount(products.length);

    const occurrences = new Map<string, { product: Product; count: number }>();
    for (const product of products) {
      const entry = occurrences.get(product.name) ?? { product, count: 0 };
      entry.count += 1;
      occurrences.set(product.name, entry);
    }
    for (const { product, count } of occurrences.values()) {
      const matchingRows = this.rowsFor(product.name);
      await expect(matchingRows).toHaveCount(count);
      await expect(matchingRows.first().locator('td').nth(2)).toHaveText(String(product.price));
    }
    await this.expectTotal(NumberUtils.sum(products.map(product => product.price)));
  }

  @step('Verify cart total is {0}')
  async expectTotal(expectedTotal: number): Promise<void> {
    await expect(this.total).toHaveText(String(expectedTotal));
  }

  /**
   * Verifies the cart is empty. Rows render progressively after `/viewcart` answers, so an early
   * DOM count of zero proves nothing; the API payload captured during navigation is the
   * authoritative signal. The backend clears carts asynchronously and reads are eventually
   * consistent, so the page is reloaded until the API reports no lines (bounded).
   */
  @step('Verify cart is empty')
  async expectEmpty(): Promise<void> {
    await WaitUtils.forValue(
      async () => {
        await this.goto();
        return this.lastLoadedItemCount;
      },
      count => count === 0,
      { timeout: 20_000, interval: 1_000, message: 'Cart API kept returning items' }
    );
    await expect(this.rows).toHaveCount(0);
    await expect(this.total).toBeEmpty();
  }

  /**
   * Deletes a line. The application reloads the page after `/deleteitem` succeeds, so we wait
   * for the follow-up `/viewcart` request before asserting on the new row count.
   */
  @step('Delete "{0}" from cart')
  async deleteItem(productName: string): Promise<void> {
    const row = this.rowsFor(productName).first();
    await expect(row).toBeVisible();
    const rowCountBefore = await this.rows.count();

    const deleted = WaitUtils.forApiResponse(this.page, '/deleteitem', { method: 'POST' });
    const reloaded = WaitUtils.forApiResponse(this.page, '/viewcart', {
      method: 'POST',
      timeout: config.timeouts.navigation,
    });
    await row.locator('a', { hasText: 'Delete' }).click();
    await deleted;
    await reloaded;
    await this.waitForReady();
    await expect(this.rows).toHaveCount(rowCountBefore - 1);
  }

  @step('Click "Place Order"')
  async clickPlaceOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }

  /** Snapshot of the rendered lines, taken once the table has stopped changing. */
  async lines(): Promise<CartLine[]> {
    await WaitUtils.forDomStable(this.table);
    const rows = await this.rows.all();
    const lines: CartLine[] = [];
    for (const row of rows) {
      const cells = await row.locator('td').allInnerTexts();
      lines.push({ name: (cells[1] ?? '').trim(), price: NumberUtils.parsePrice(cells[2] ?? '0') });
    }
    return lines;
  }

  async totalAmount(): Promise<number> {
    return NumberUtils.parsePrice(await this.total.innerText());
  }

  private rowsFor(productName: string): Locator {
    return this.rows.filter({
      has: this.page.locator('td', { hasText: StringUtils.exactMatch(productName) }),
    });
  }

  /** Number of lines reported by the last `/viewcart` response, or undefined when unreadable. */
  private static async readItemCount(response: Response): Promise<number | undefined> {
    try {
      const parsed = viewCartResponseSchema.safeParse(await response.json());
      return parsed.success ? parsed.data.Items.length : undefined;
    } catch {
      return undefined;
    }
  }
}
