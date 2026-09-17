import { expect, type Dialog, type Page } from '@playwright/test';
import { DialogTimeoutError, toError } from '../core/errors';

export interface DialogHandlingOptions {
  /** Exact string or pattern the dialog message must satisfy. */
  expectedMessage?: string | RegExp;
  /** Accept (default) or dismiss the dialog. */
  accept?: boolean;
  /** Text to enter for `prompt()` dialogs. */
  promptText?: string;
  /**
   * How long to wait for the dialog once `action` has completed. Defaults to 10 s.
   * The clock does not run while the action itself executes (including Playwright's
   * auto-waiting), so a slow click on a busy machine never consumes the dialog budget.
   */
  timeout?: number;
}

export interface DialogRecord {
  type: ReturnType<Dialog['type']>;
  message: string;
  timestamp: number;
}

/**
 * Runs `action` and returns the message of the native dialog (alert/confirm/prompt) it
 * triggers.
 *
 * Ordering matters twice here:
 * 1. The listener is registered BEFORE the action, because a dialog opened synchronously inside
 *    a click handler would otherwise be auto-dismissed before anyone subscribes.
 * 2. The timeout starts AFTER the action has resolved. Measuring from before the action made the
 *    budget compete with the click's own auto-waiting, which produced false
 *    `DialogTimeoutError`s on slow engines (a 14 s WebKit click against a 10 s budget).
 *
 * The listener is always detached (success, timeout or a throwing action) so a stale listener
 * can never swallow a later, unrelated dialog in the same test.
 */
export async function handleDialog(
  page: Page,
  action: () => Promise<void>,
  expectedOrOptions?: string | RegExp | DialogHandlingOptions
): Promise<string> {
  const options: DialogHandlingOptions =
    typeof expectedOrOptions === 'string' || expectedOrOptions instanceof RegExp
      ? { expectedMessage: expectedOrOptions }
      : (expectedOrOptions ?? {});
  const { accept = true, promptText, timeout = 10_000, expectedMessage } = options;

  let settle: (message: string) => void = () => undefined;
  let fail: (error: Error) => void = () => undefined;
  const dialogPromise = new Promise<string>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });
  // The promise may lose the race below; a late rejection must never surface as unhandled.
  dialogPromise.catch(() => undefined);

  const listener = (dialog: Dialog): void => {
    const message = dialog.message();
    const close = accept ? dialog.accept(promptText) : dialog.dismiss();
    close.then(() => settle(message)).catch((error: unknown) => fail(toError(error)));
  };
  page.once('dialog', listener);

  let timer: NodeJS.Timeout | undefined;
  try {
    await action();

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(
          new DialogTimeoutError(
            `No dialog appeared within ${timeout} ms after the action completed`
          )
        );
      }, timeout);
    });
    const message = await Promise.race([dialogPromise, timeoutPromise]);

    if (expectedMessage !== undefined) {
      if (typeof expectedMessage === 'string') {
        expect(message, 'Unexpected dialog message').toBe(expectedMessage);
      } else {
        expect(message, 'Unexpected dialog message').toMatch(expectedMessage);
      }
    }
    return message;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    page.off('dialog', listener);
  }
}

/**
 * Records and auto-accepts every dialog on a page. Useful when a flow may raise several
 * alerts and the test only wants to inspect them afterwards.
 */
export class DialogRecorder {
  private readonly records: DialogRecord[] = [];
  private readonly listener = (dialog: Dialog): void => {
    this.records.push({ type: dialog.type(), message: dialog.message(), timestamp: Date.now() });
    dialog.accept().catch(() => undefined);
  };

  constructor(private readonly page: Page) {}

  start(): this {
    this.page.on('dialog', this.listener);
    return this;
  }

  stop(): DialogRecord[] {
    this.page.off('dialog', this.listener);
    return this.messages();
  }

  messages(): DialogRecord[] {
    return [...this.records];
  }

  lastMessage(): string | undefined {
    return this.records.at(-1)?.message;
  }

  clear(): void {
    this.records.length = 0;
  }
}
