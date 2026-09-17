import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../core/step.decorator';
import { alertMessages } from '../../data/static/messages';
import type { OrderConfirmation } from '../../models/order.model';
import { StringUtils } from '../../utils/string-utils';
import { BaseComponent } from './base.component';

/**
 * SweetAlert dialog shown after a successful purchase. Its body is rendered as
 * "Id: 123<br>Amount: 360 USD<br>Card Number: ...<br>Name: ...<br>Date: d/m/yyyy".
 */
export class OrderConfirmationComponent extends BaseComponent {
  readonly title: Locator;
  readonly body: Locator;
  readonly okButton: Locator;

  constructor(page: Page) {
    super(page, page.locator('.sweet-alert'));
    this.title = this.root.locator('h2');
    this.body = this.root.locator('p.lead');
    this.okButton = this.root.locator('button.confirm');
  }

  @step('Verify purchase confirmation is displayed')
  async expectDisplayed(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.root).toHaveClass(/visible/);
    await expect(this.title).toHaveText(alertMessages.purchaseSuccess);
    await expect(this.body).toContainText(/Id:\s*\d+/);
  }

  /** Parses the confirmation text into a typed structure for precise assertions. */
  @step('Read purchase confirmation details')
  async getDetails(): Promise<OrderConfirmation> {
    await this.expectDisplayed();
    const text = StringUtils.normalizeWhitespace(await this.body.innerText());

    const id = matchGroup(text, /Id:\s*(\d+)/);
    const amount = matchGroup(text, /Amount:\s*(\d+(?:\.\d+)?)\s*USD/);
    const cardNumber = matchGroup(text, /Card Number:\s*(.+?)\s*Name:/);
    const name = matchGroup(text, /Name:\s*(.+?)\s*Date:/);
    const date = matchGroup(text, /Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);

    return { id: Number(id), amount: Number(amount), cardNumber, name, date };
  }

  @step('Confirm purchase dialog')
  async confirm(): Promise<void> {
    await this.okButton.click();
    await expect(this.root).toBeHidden();
  }
}

function matchGroup(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  const group = match?.[1];
  if (group === undefined) {
    throw new Error(`Could not find ${pattern.source} in confirmation text: "${text}"`);
  }
  return group.trim();
}
