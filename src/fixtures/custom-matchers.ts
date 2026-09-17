import { expect as baseExpect, type APIResponse } from '@playwright/test';
import type { ZodType } from 'zod';

/**
 * Domain-specific matchers. Extending `expect` (rather than writing helper functions) keeps
 * failure messages consistent and integrates with soft assertions (`expect.soft`).
 */
export const expect = baseExpect.extend({
  /** Asserts a 2xx status on a Playwright `APIResponse`. */
  toBeSuccessful(response: APIResponse) {
    const status = response.status();
    const pass = status >= 200 && status < 300;
    return {
      pass,
      name: 'toBeSuccessful',
      message: () =>
        `Expected ${response.url()} ${pass ? 'not ' : ''}to return a 2xx status, received ${status} ${response.statusText()}`,
    };
  },

  /** Validates any value against a Zod schema and reports every violation. */
  toMatchSchema(received: unknown, schema: ZodType) {
    const result = schema.safeParse(received);
    return {
      pass: result.success,
      name: 'toMatchSchema',
      message: () =>
        result.success
          ? 'Expected value not to match the schema, but it did'
          : `Value does not match schema:\n${result.error.issues
              .map(issue => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
              .join('\n')}`,
    };
  },

  /** Inclusive numeric range check with a readable message (useful for SLA and totals). */
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    return {
      pass,
      name: 'toBeWithinRange',
      message: () => `Expected ${received} ${pass ? 'not ' : ''}to be within [${min}, ${max}]`,
    };
  },
});
