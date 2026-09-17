import { z } from 'zod';

/**
 * Single source of truth for every environment variable the framework understands.
 * Parsing happens once at startup (see environment.ts); an invalid value fails the run
 * immediately with a precise message instead of surfacing as a confusing test failure.
 */
export const envSchema = z.object({
  TEST_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  CI: z.stringbool().default(false),

  BASE_URL: z.url().default('https://www.demoblaze.com'),
  API_BASE_URL: z.url().default('https://api.demoblaze.com'),

  TEST_USERNAME: z.string().default(''),
  TEST_PASSWORD: z.string().default(''),

  HEADLESS: z.stringbool().default(true),

  DEFAULT_TIMEOUT: z.coerce.number().int().positive().default(60_000),
  ACTION_TIMEOUT: z.coerce.number().int().positive().default(15_000),
  NAVIGATION_TIMEOUT: z.coerce.number().int().positive().default(30_000),
  EXPECT_TIMEOUT: z.coerce.number().int().positive().default(10_000),

  LOCAL_RETRIES: z.coerce.number().int().min(0).default(0),
  CI_RETRIES: z.coerce.number().int().min(0).default(2),
  WORKERS: z
    .string()
    .regex(/^\d+%?$/, 'WORKERS must be a number or a percentage, e.g. 4 or 50%')
    .optional(),

  TEST_TAGS: z.string().optional(),
  EXCLUDE_TAGS: z.string().optional(),

  /**
   * Where traces, videos and screenshots are written. Relative paths resolve from the project
   * root. Point it outside cloud-synced folders (Google Drive, OneDrive): their file locks can
   * stall Playwright's artifact cleanup and worker shutdown on Windows.
   */
  OUTPUT_DIR: z.string().default('test-results'),

  TRACE_MODE: z
    .enum([
      'off',
      'on',
      'retain-on-failure',
      'on-first-retry',
      'on-all-retries',
      'retain-on-first-failure',
    ])
    .default('retain-on-failure'),
  VIDEO_MODE: z
    .enum(['off', 'on', 'retain-on-failure', 'on-first-retry'])
    .default('retain-on-failure'),
  SCREENSHOT_MODE: z.enum(['off', 'on', 'only-on-failure']).default('only-on-failure'),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),

  API_RETRIES: z.coerce.number().int().min(0).default(2),
  API_TIMEOUT: z.coerce.number().int().positive().default(15_000),

  DB_TYPE: z.enum(['postgres', 'mysql', 'mongo']).optional(),
  DB_HOST: z.string().optional(),
  DB_PORT: z.coerce.number().int().positive().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_CONNECTION_STRING: z.string().optional(),
});

export type EnvVars = z.infer<typeof envSchema>;
export type TestEnvironment = EnvVars['TEST_ENV'];
