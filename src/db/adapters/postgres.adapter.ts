import { ConfigurationError } from '../../core/errors';
import type { DatabaseClient, DatabaseConfig, QueryResult } from '../db.types';
import { loadOptionalModule } from '../optional-module.loader';

/** Minimal surface of the `pg` driver used by this adapter (keeps the framework driver-agnostic). */
interface PgClientLike {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[]; rowCount: number | null }>;
}

interface PgModule {
  Client: new (config: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
  }) => PgClientLike;
}

/** PostgreSQL adapter. Requires `npm i -D pg @types/pg`. */
export class PostgresAdapter implements DatabaseClient {
  readonly type = 'postgres' as const;
  private client?: PgClientLike;

  constructor(private readonly config: DatabaseConfig) {}

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }
    const pg = await loadOptionalModule<PgModule>(
      'pg',
      'Run "npm i -D pg @types/pg" to enable PostgreSQL support.'
    );
    const client = new pg.Client(
      this.config.connectionString
        ? { connectionString: this.config.connectionString }
        : {
            host: this.config.host,
            port: this.config.port,
            database: this.config.database,
            user: this.config.user,
            password: this.config.password,
          }
    );
    await client.connect();
    this.client = client;
  }

  async disconnect(): Promise<void> {
    await this.client?.end();
    this.client = undefined;
  }

  isConnected(): boolean {
    return this.client !== undefined;
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.query<{ ok: number }>('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
  }

  async query<T = Record<string, unknown>>(
    statement: string,
    params: readonly unknown[] = []
  ): Promise<QueryResult<T>> {
    const result = await this.requireClient().query(statement, [...params]);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length };
  }

  private requireClient(): PgClientLike {
    if (!this.client) {
      throw new ConfigurationError('PostgresAdapter is not connected. Call connect() first.');
    }
    return this.client;
  }
}
