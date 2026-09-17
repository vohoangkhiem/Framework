import { mergeTests } from '@playwright/test';
import { authTest } from './auth.fixtures';
import { baseTest } from './base.fixtures';
import { dataTest } from './data.fixtures';
import { pageTest } from './page.fixtures';

/**
 * The single `test` object every spec imports. Fixture groups live in separate files so
 * that large projects can add new groups (db, feature flags, mobile...) without touching
 * existing ones; `mergeTests` composes them into one strongly typed `test`.
 */
export const test = mergeTests(baseTest, pageTest, authTest, dataTest);

export { expect } from './custom-matchers';
export type { BaseFixtures } from './base.fixtures';
export type { PageFixtures } from './page.fixtures';
export type { ApiFixtures } from './api.fixtures';
export type { AuthFixtures } from './auth.fixtures';
export type { DataFixtures, TestData } from './data.fixtures';
