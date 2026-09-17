import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { ConfigurationError } from '../core/errors';
import type { UserCredentials } from '../models/user.model';
import { envSchema, type EnvVars, type TestEnvironment } from './env.schema';

export const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ENVIRONMENTS_DIR = path.join(ROOT_DIR, 'environments');

/**
 * Loads environment files without overriding variables that already exist in the process.
 * Resulting precedence (highest first):
 *   process env  >  .env (local overrides)  >  environments/.env.<TEST_ENV>  >  schema defaults
 */
function loadEnvFiles(): void {
  dotenv.config({ path: path.join(ROOT_DIR, '.env'), override: false, quiet: true });

  const requestedEnv = process.env.TEST_ENV?.trim();
  const targetEnv = requestedEnv !== undefined && requestedEnv !== '' ? requestedEnv : 'dev';
  const envFile = path.join(ENVIRONMENTS_DIR, `.env.${targetEnv}`);
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false, quiet: true });
  }
}

/** dotenv yields empty strings for `KEY=` lines; treat them as "not provided" so defaults apply. */
function definedEnvEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value.trim() !== '') {
      entries[key] = value;
    }
  }
  return entries;
}

function parseEnv(): EnvVars {
  loadEnvFiles();
  const result = envSchema.safeParse(definedEnvEntries());
  if (!result.success) {
    const problems = result.error.issues
      .map(issue => `  - ${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('\n');
    throw new ConfigurationError(`Invalid environment configuration:\n${problems}`);
  }
  return result.data;
}

export const env: EnvVars = parseEnv();

/** Converts "@smoke,@regression" / "@smoke|@regression" / "@smoke @regression" into a --grep regex. */
export function toGrepRegex(tags: string | undefined): RegExp | undefined {
  if (!tags) {
    return undefined;
  }
  const parts = tags
    .split(/[\s,|]+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => part.replace(/[.*+?^${}()[\]\\]/g, '\\$&'));
  return parts.length > 0 ? new RegExp(parts.join('|')) : undefined;
}

/**
 * Strongly typed, immutable configuration consumed by playwright.config.ts, fixtures and
 * helpers. Nothing else in the framework reads `process.env` directly.
 */
export const config = {
  environment: env.TEST_ENV,
  isCI: env.CI,
  baseUrl: env.BASE_URL,
  apiBaseUrl: env.API_BASE_URL,

  credentials: {
    username: env.TEST_USERNAME,
    password: env.TEST_PASSWORD,
  },

  browser: {
    headless: env.CI || env.HEADLESS,
  },

  timeouts: {
    test: env.DEFAULT_TIMEOUT,
    action: env.ACTION_TIMEOUT,
    navigation: env.NAVIGATION_TIMEOUT,
    expect: env.EXPECT_TIMEOUT,
  },

  retries: env.CI ? env.CI_RETRIES : env.LOCAL_RETRIES,
  workers: env.WORKERS,

  tags: {
    include: env.TEST_TAGS,
    exclude: env.EXCLUDE_TAGS,
  },

  artifacts: {
    trace: env.TRACE_MODE,
    video: env.VIDEO_MODE,
    screenshot: env.SCREENSHOT_MODE,
  },

  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT,
  },

  api: {
    retries: env.API_RETRIES,
    timeout: env.API_TIMEOUT,
  },

  db: {
    type: env.DB_TYPE,
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    connectionString: env.DB_CONNECTION_STRING,
  },

  paths: {
    root: ROOT_DIR,
    testResults: path.resolve(ROOT_DIR, env.OUTPUT_DIR),
    htmlReport: path.join(ROOT_DIR, 'playwright-report'),
    blobReport: path.join(ROOT_DIR, 'blob-report'),
    authDir: path.join(ROOT_DIR, '.auth'),
    authState: path.join(ROOT_DIR, '.auth', 'user.json'),
  },
} as const;

export type Config = typeof config;

/** Returns the shared test account or fails fast with an actionable message. */
export function requireCredentials(): UserCredentials {
  const { username, password } = config.credentials;
  if (!username || !password) {
    throw new ConfigurationError(
      'TEST_USERNAME and TEST_PASSWORD must be set (in .env locally or as CI secrets) for tests that use the shared account.'
    );
  }
  return { username, password };
}

/** Redacted snapshot of the effective configuration, safe to print in logs and reports. */
export function describeConfig(): Record<string, string | number | boolean | undefined> {
  return {
    environment: config.environment,
    isCI: config.isCI,
    baseUrl: config.baseUrl,
    apiBaseUrl: config.apiBaseUrl,
    headless: config.browser.headless,
    retries: config.retries,
    workers: config.workers,
    tags: config.tags.include,
    excludeTags: config.tags.exclude,
    trace: config.artifacts.trace,
    video: config.artifacts.video,
    username: config.credentials.username
      ? `${config.credentials.username.slice(0, 2)}***`
      : '<not set>',
  };
}

export function isEnvironment(...environments: TestEnvironment[]): boolean {
  return environments.includes(config.environment);
}

/** True once the `setup` project has persisted the shared account's storage state for this run. */
export function hasStoredAuthState(): boolean {
  return fs.existsSync(config.paths.authState);
}

export default config;
