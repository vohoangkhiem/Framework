import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../core/step.decorator';
import type { UserCredentials } from '../models/user.model';
import { handleDialog } from '../utils/dialog-utils';
import { BasePage } from './base.page';
import { ModalComponent } from './components/modal.component';

/** Login modal (available from every page through the header). */
export class LoginPage extends BasePage {
  protected readonly path = '/';

  readonly modal: ModalComponent;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.modal = new ModalComponent(page, 'logInModal');
    this.usernameInput = page.locator('#loginusername');
    this.passwordInput = page.locator('#loginpassword');
    this.loginButton = this.modal.root.locator('button', { hasText: 'Log in' });
  }

  async waitForReady(): Promise<void> {
    await expect(this.header.loginLink).toBeVisible();
  }

  @step('Open login modal')
  async open(): Promise<void> {
    if (!(await this.modal.isVisible())) {
      await this.header.loginLink.click();
    }
    await this.modal.expectOpen();
  }

  @step('Fill login form for "{0}"')
  async fillCredentials(user: UserCredentials): Promise<void> {
    await this.usernameInput.fill(user.username);
    await this.passwordInput.fill(user.password);
  }

  @step('Submit login form')
  async submit(): Promise<void> {
    await expect(this.loginButton).toBeEnabled();
    await this.loginButton.click();
  }

  /** Full happy-path login: the application reloads the page on success. */
  @step('Log in as "{0}"')
  async login(user: UserCredentials): Promise<void> {
    await this.open();
    await this.fillCredentials(user);
    await this.submit();
  }

  /** Login attempt that is expected to fail with a native alert; returns the alert text. */
  @step('Attempt login expecting an alert for "{0}"')
  async loginExpectingAlert(user: UserCredentials): Promise<string> {
    await this.open();
    await this.fillCredentials(user);
    return handleDialog(this.page, () => this.submit());
  }

  @step('Verify login succeeded for "{0}"')
  async expectLoginSuccess(username: string): Promise<void> {
    await this.header.expectLoggedIn(username);
    await this.modal.expectClosed();
  }

  @step('Verify user is not logged in')
  async expectLoginFailed(): Promise<void> {
    await this.header.expectLoggedOut();
  }

  @step('Close login modal')
  async close(): Promise<void> {
    await this.modal.close();
  }
}
