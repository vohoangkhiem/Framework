import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../core/step.decorator';
import type { OrderConfirmation, OrderFormData } from '../models/order.model';
import { handleDialog } from '../utils/dialog-utils';
import { BasePage } from './base.page';
import { ModalComponent } from './components/modal.component';
import { OrderConfirmationComponent } from './components/order-confirmation.component';

/** "Place order" modal on the cart page plus the purchase confirmation dialog. */
export class PlaceOrderPage extends BasePage {
  protected readonly path = '/cart.html';

  readonly modal: ModalComponent;
  readonly nameInput: Locator;
  readonly countryInput: Locator;
  readonly cityInput: Locator;
  readonly creditCardInput: Locator;
  readonly monthInput: Locator;
  readonly yearInput: Locator;
  readonly purchaseButton: Locator;
  readonly confirmation: OrderConfirmationComponent;

  constructor(page: Page) {
    super(page);
    this.modal = new ModalComponent(page, 'orderModal');
    this.nameInput = this.modal.root.locator('#name');
    this.countryInput = this.modal.root.locator('#country');
    this.cityInput = this.modal.root.locator('#city');
    this.creditCardInput = this.modal.root.locator('#card');
    this.monthInput = this.modal.root.locator('#month');
    this.yearInput = this.modal.root.locator('#year');
    this.purchaseButton = this.modal.root.locator('button', { hasText: 'Purchase' });
    this.confirmation = new OrderConfirmationComponent(page);
  }

  async waitForReady(): Promise<void> {
    await this.modal.expectOpen();
  }

  /** Fills every field; undefined fields are cleared so stale values never leak between attempts. */
  @step('Fill order form')
  async fillForm(order: OrderFormData): Promise<void> {
    await this.waitForReady();
    await this.nameInput.fill(order.name ?? '');
    await this.countryInput.fill(order.country ?? '');
    await this.cityInput.fill(order.city ?? '');
    await this.creditCardInput.fill(order.creditCard ?? '');
    await this.monthInput.fill(order.month ?? '');
    await this.yearInput.fill(order.year ?? '');
  }

  @step('Submit purchase')
  async submit(): Promise<void> {
    await expect(this.purchaseButton).toBeEnabled();
    await this.purchaseButton.click();
  }

  /** Happy path: fills the form, purchases and returns the parsed confirmation. */
  @step('Purchase order')
  async purchase(order: OrderFormData): Promise<OrderConfirmation> {
    await this.fillForm(order);
    await this.submit();
    return this.confirmation.getDetails();
  }

  /** Validation path: submits an incomplete form and returns the alert message. */
  @step('Submit order expecting a validation alert')
  async submitExpectingValidationAlert(order: OrderFormData): Promise<string> {
    await this.fillForm(order);
    const message = await handleDialog(this.page, () => this.submit());
    await this.modal.expectOpen();
    return message;
  }

  @step('Close order modal')
  async close(): Promise<void> {
    await this.modal.close();
  }
}
