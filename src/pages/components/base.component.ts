import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Base for reusable UI components (header, modals, dialogs). A component is scoped to a
 * `root` locator so that all inner locators are relative and cannot leak across components.
 */
export abstract class BaseComponent {
  constructor(
    protected readonly page: Page,
    readonly root: Locator
  ) {}

  async expectVisible(): Promise<void> {
    await expect(this.root).toBeVisible();
  }

  async expectHidden(): Promise<void> {
    await expect(this.root).toBeHidden();
  }

  async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }
}
