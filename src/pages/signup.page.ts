import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../core/step.decorator';
import { alertMessages } from '../data/static/messages';
import type { UserCredentials } from '../models/user.model';
import { handleDialog } from '../utils/dialog-utils';
import { BasePage } from './base.page';
import { ModalComponent } from './components/modal.component';

/** Sign-up modal (available from every page through the header). */
export class SignUpPage extends BasePage {
  protected readonly path = '/';

  readonly modal: ModalComponent;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly signUpButton: Locator;

  constructor(page: Page) {
    super(page);
    this.modal = new ModalComponent(page, 'signInModal');
    this.usernameInput = page.locator('#sign-username');
    this.passwordInput = page.locator('#sign-password');
    this.signUpButton = this.modal.root.locator('button', { hasText: 'Sign up' });
  }

  async waitForReady(): Promise<void> {
    await expect(this.header.signUpLink).toBeVisible();
  }

  @step('Open sign-up modal')
  async open(): Promise<void> {
    if (!(await this.modal.isVisible())) {
      await this.header.signUpLink.click();
    }
    await this.modal.expectOpen();
  }

  /** Submits the form and returns the resulting alert message (success or error). */
  @step('Sign up as "{0}"')
  async signUp(user: UserCredentials): Promise<string> {
    await this.open();
    await this.usernameInput.fill(user.username);
    await this.passwordInput.fill(user.password);
    const message = await handleDialog(this.page, () => this.signUpButton.click());

    // On success the application hides the modal itself; on failure it stays open.
    if (message !== alertMessages.signUpSuccess && (await this.modal.isVisible())) {
      await this.modal.close();
    }
    return message;
  }

  @step('Sign up expecting success for "{0}"')
  async signUpExpectingSuccess(user: UserCredentials): Promise<void> {
    const message = await this.signUp(user);
    expect(message, 'Sign-up alert').toBe(alertMessages.signUpSuccess);
    await this.modal.expectClosed();
  }
}
