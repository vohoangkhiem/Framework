import type { DatabaseClient } from '../db.types';

/**
 * Template for domain repositories. Copy, rename and add intention-revealing query methods.
 * Repositories keep SQL out of tests and make schema changes a single-file fix.
 */
export abstract class BaseRepository {
  protected constructor(protected readonly db: DatabaseClient) {}
}
