import fs from 'node:fs';
import { request, type FullConfig } from '@playwright/test';
import { logger } from '../core/logger';
import { config, describeConfig } from './environment';

/**
 * Runs once before all workers. Kept deliberately light: it validates the environment,
 * prepares artifact folders and probes the target URL so that an unreachable environment
 * is reported once, clearly, instead of as dozens of identical test failures.
 *
 * Authentication state is NOT created here; that is the job of the `setup` project
 * (tests/setup/auth.setup.ts), which benefits from retries, tracing and reporting.
 */
async function globalSetup(fullConfig: FullConfig): Promise<void> {
  process.env.RUN_STARTED_AT = new Date().toISOString();

  logger.info('Test run starting', {
    ...describeConfig(),
    projects: fullConfig.projects.map(project => project.name).join(', '),
    workers: fullConfig.workers,
    shard: fullConfig.shard ? `${fullConfig.shard.current}/${fullConfig.shard.total}` : 'none',
  });

  for (const dir of [config.paths.testResults, config.paths.authDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await probeBaseUrl();
}

async function probeBaseUrl(): Promise<void> {
  const context = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const started = Date.now();
    const response = await context.get(config.baseUrl, { timeout: 15_000 });
    logger.info('Base URL probe completed', {
      url: config.baseUrl,
      status: response.status(),
      durationMs: Date.now() - started,
    });
  } catch (error) {
    // A failed probe is a strong warning but not fatal: transient network issues should not
    // abort a run that has retries configured.
    logger.warn('Base URL probe failed; tests may fail if the environment is down', {
      url: config.baseUrl,
      error: String(error),
    });
  } finally {
    await context.dispose();
  }
}

export default globalSetup;
