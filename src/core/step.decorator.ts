import { test } from '@playwright/test';

type AsyncMethod<This, Args extends unknown[], Return> = (
  this: This,
  ...args: Args
) => Promise<Return>;

export interface StepOptions {
  /**
   * Step title. Supports `{0}`, `{1}` placeholders that are replaced by the call arguments.
   * Defaults to `ClassName.methodName`.
   */
  name?: string;
  /** Hide the step internals in the report (see Playwright `test.step` `box` option). */
  box?: boolean;
}

const SENSITIVE_KEY_PATTERN = /pass(word)?|secret|token|card/i;

/**
 * Method decorator that wraps a page-object / workflow method in `test.step()`, giving
 * the HTML report and trace viewer a readable, hierarchical narrative without cluttering
 * business methods with reporting code.
 *
 * Uses TC39 standard decorators (TypeScript 5+, no `experimentalDecorators` flag), which
 * Playwright's built-in Babel transform supports. When the method is invoked outside a
 * test (e.g. global setup), it runs normally without creating a step.
 */
export function step(nameOrOptions?: string | StepOptions) {
  const options: StepOptions =
    typeof nameOrOptions === 'string' ? { name: nameOrOptions } : (nameOrOptions ?? {});

  return function stepDecorator<This extends object, Args extends unknown[], Return>(
    target: AsyncMethod<This, Args, Return>,
    context: ClassMethodDecoratorContext<This, AsyncMethod<This, Args, Return>>
  ): AsyncMethod<This, Args, Return> {
    const methodName = String(context.name);

    return async function stepWrapper(this: This, ...args: Args): Promise<Return> {
      const title = options.name
        ? formatStepTitle(options.name, args)
        : `${this.constructor.name}.${methodName}`;

      if (!isInsideTest()) {
        return target.call(this, ...args);
      }
      return test.step(title, () => target.call(this, ...args), { box: options.box ?? false });
    };
  };
}

function isInsideTest(): boolean {
  try {
    test.info();
    return true;
  } catch {
    return false;
  }
}

function formatStepTitle(template: string, args: unknown[]): string {
  return template.replace(/\{(\d+)\}/g, (_match, index: string) =>
    describeArgument(args[Number(index)])
  );
}

function describeArgument(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => describeArgument(item)).join(', ');
  }
  if (typeof value === 'object') {
    const masked = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '***' : nested,
      ])
    );
    return JSON.stringify(masked);
  }
  return typeof value;
}
