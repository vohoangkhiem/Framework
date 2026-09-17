import type { FullConfig } from '@playwright/test';
import { logger } from '../core/logger';

/** Runs once after all workers finish. Reports total wall-clock time of the run. */
async function globalTeardown(_fullConfig: FullConfig): Promise<void> {
  const startedAt = process.env.RUN_STARTED_AT;
  const durationMs = startedAt ? Date.now() - new Date(startedAt).getTime() : undefined;
  logger.info('Test run finished', { durationMs });
}

export default globalTeardown;
