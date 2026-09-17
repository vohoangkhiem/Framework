import { expect, type Locator, type Page } from '@playwright/test';
import { BaseComponent } from './base.component';

/**
 * Bootstrap 4 modal wrapper.
 *
 * Bootstrap animates modals (`fade` -> `show`) and, when the transition ends, focuses the modal
 * container. Typing into a field before that moment lets the focus change swallow the input on
 * Firefox and WebKit, so `expectOpen()` waits for the animation to complete (opacity and
 * transform settled) before any interaction. This removes a classic cross-browser flake.
 */
export class ModalComponent extends BaseComponent {
  readonly dialog: Locator;
  readonly title: Locator;
  readonly closeButton: Locator;
  readonly dismissIcon: Locator;

  constructor(page: Page, modalId: string) {
    super(page, page.locator(`#${modalId}`));
    this.dialog = this.root.locator('.modal-dialog');
    this.title = this.root.locator('.modal-title');
    this.closeButton = this.root.locator('.modal-footer button', { hasText: 'Close' });
    this.dismissIcon = this.root.locator('.modal-header button.close');
  }

  async expectOpen(): Promise<void> {
    await expect(this.root).toBeVisible();
    await expect(this.root).toHaveClass(/show/);
    await expect(this.root).toHaveCSS('opacity', '1');
    // Bootstrap animates translate(0,-50px) -> none; the settled computed value is the identity matrix.
    await expect(this.dialog).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  }

  async expectClosed(): Promise<void> {
    await expect(this.root).toBeHidden();
    await expect(this.page.locator('.modal-backdrop').last()).toBeHidden();
  }

  async close(): Promise<void> {
    await this.closeButton.click();
    await this.expectClosed();
  }

  async dismiss(): Promise<void> {
    await this.dismissIcon.click();
    await this.expectClosed();
  }
}
