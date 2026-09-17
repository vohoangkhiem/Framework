import type { BrowserContext, Cookie, Page } from '@playwright/test';
import { config } from '../config/environment';

export interface CookieInput {
  name: string;
  value: string;
  /** Defaults to the configured BASE_URL, which yields a host-only cookie like the app itself sets. */
  url?: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Browser storage helpers (cookies / localStorage). Cookies are managed at the context
 * level so that state set here is visible to every page of the test.
 */
export const StorageUtils = {
  async getCookie(context: BrowserContext, name: string): Promise<Cookie | undefined> {
    const cookies = await context.cookies();
    return cookies.find(cookie => cookie.name === name);
  },

  async getCookieValue(context: BrowserContext, name: string): Promise<string | undefined> {
    return (await StorageUtils.getCookie(context, name))?.value;
  },

  async setCookie(context: BrowserContext, cookie: CookieInput): Promise<void> {
    const { url, domain, path, ...rest } = cookie;
    if (domain) {
      await context.addCookies([{ ...rest, domain, path: path ?? '/' }]);
      return;
    }
    await context.addCookies([{ ...rest, url: url ?? config.baseUrl }]);
  },

  async clearCookie(context: BrowserContext, name: string): Promise<void> {
    await context.clearCookies({ name });
  },

  /** Serialises cookies the same way the browser exposes `document.cookie` ("a=1; b=2"). */
  async documentCookieString(
    context: BrowserContext,
    url: string = config.baseUrl
  ): Promise<string> {
    const cookies = await context.cookies(url);
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  },

  async getLocalStorageItem(page: Page, key: string): Promise<string | null> {
    return page.evaluate(storageKey => window.localStorage.getItem(storageKey), key);
  },

  async setLocalStorageItem(page: Page, key: string, value: string): Promise<void> {
    await page.evaluate(
      ([storageKey, storageValue]) => window.localStorage.setItem(storageKey, storageValue),
      [key, value] as const
    );
  },

  async clearLocalStorage(page: Page): Promise<void> {
    await page.evaluate(() => window.localStorage.clear());
  },

  async saveStorageState(context: BrowserContext, filePath: string): Promise<void> {
    await context.storageState({ path: filePath });
  },
} as const;
