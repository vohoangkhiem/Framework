/**
 * Central registry of test tags. Using constants (instead of free-form strings) keeps
 * `--grep` filters reliable across hundreds of spec files and lets CI pipelines rely on
 * a documented vocabulary.
 *
 * Suite tags:   smoke / regression / e2e
 * Layer tags:   ui / api / performance / mobile / framework
 * Feature tags: auth / catalog / cart / checkout
 * Nature tags:  negative / edgeCase / mock / flaky / wip
 */
export const TAGS = {
  smoke: '@smoke',
  regression: '@regression',
  e2e: '@e2e',
  ui: '@ui',
  api: '@api',
  performance: '@performance',
  mobile: '@mobile',
  /** Self-tests of the framework's own building blocks (tests/framework). */
  framework: '@framework',
  auth: '@auth',
  catalog: '@catalog',
  cart: '@cart',
  checkout: '@checkout',
  negative: '@negative',
  edgeCase: '@edge-case',
  mock: '@mock',
  flaky: '@flaky',
  wip: '@wip',
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];

/** Sugar for `test.describe('title', tags(TAGS.smoke, TAGS.auth), () => {...})`. */
export function tags(...list: Tag[]): { tag: Tag[] } {
  return { tag: list };
}
