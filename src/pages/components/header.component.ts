import { expect, type Locator, type Page } from '@playwright/test';
import { step } from '../../core/step.decorator';
import { uiText } from '../../data/static/messages';
import { BaseComponent } from './base.component';

/** Global navigation bar present on every page. */
export class HeaderComponent extends BaseComponent {
  readonly homeLink: Locator;
  readonly cartLink: Locator;
  readonly loginLink: Locator;
  readonly signUpLink: Locator;
  readonly logoutLink: Locator;
  readonly welcomeUser: Locator;
  /** Hamburger button rendered below Bootstrap's `lg` breakpoint (phones and small tablets). */
  readonly menuToggle: Locator;
  /** Collapsible container holding the navigation links. */
  readonly menu: Locator;

  constructor(page: Page) {
    super(page, page.locator('nav.navbar'));
    this.homeLink = this.root.locator('.navbar-brand');
    this.cartLink = page.locator('#cartur');
    this.loginLink = page.locator('#login2');
    this.signUpLink = page.locator('#signin2');
    this.logoutLink = page.locator('#logout2');
    this.welcomeUser = page.locator('#nameofuser');
    this.menuToggle = this.root.locator('.navbar-toggler');
    this.menu = this.root.locator('.navbar-collapse');
  }

  /**
   * Expands the collapsed navigation on small viewports so the links become interactive.
   * No-op on desktop, where Bootstrap does not render the toggler.
   */
  @step('Expand navigation menu when collapsed')
  async expandMenu(): Promise<void> {
    if (await this.menuToggle.isVisible()) {
      await this.menuToggle.click();
      await expect(this.menu).toHaveClass(/show/);
    }
  }

  @step('Open cart from header')
  async openCart(): Promise<void> {
    await this.cartLink.click();
    await expect(this.page).toHaveURL(/cart\.html/);
  }

  @step('Go to home page from header')
  async goHome(): Promise<void> {
    await this.homeLink.click();
    await expect(this.page).toHaveURL(/index\.html|\/$/);
  }

  @step('Log out from header')
  async logout(): Promise<void> {
    await this.logoutLink.click();
    await this.expectLoggedOut();
  }

  @step('Verify header shows logged-in user "{0}"')
  async expectLoggedIn(username: string): Promise<void> {
    await expect(this.welcomeUser).toHaveText(`${uiText.welcomePrefix}${username}`);
    await expect(this.logoutLink).toBeVisible();
    await expect(this.loginLink).toBeHidden();
    await expect(this.signUpLink).toBeHidden();
  }

  @step('Verify header shows anonymous state')
  async expectLoggedOut(): Promise<void> {
    await expect(this.loginLink).toBeVisible();
    await expect(this.signUpLink).toBeVisible();
    await expect(this.logoutLink).toBeHidden();
    await expect(this.welcomeUser).toBeHidden();
  }
}
