import { ConfigurationError } from '../../core/errors';
import type { DatabaseClient, DatabaseConfig, QueryResult } from '../db.types';
import { loadOptionalModule } from '../optional-module.loader';

/** Minimal surface of `mysql2/promise` used by this adapter. */
interface MySqlConnectionLike {
  execute(sql: string, values?: unknown[]): Promise<[unknown, unknown]>;
  ping(): Promise<void>;
  end(): Promise<void>;
}

interface MySqlModule {
  createConnection(
    config:
      | string
      | {
          host?: string;
          port?: number;
          database?: string;
          user?: string;
          password?: string;
        }
  ): Promise<MySqlConnectionLike>;
}

/** MySQL / MariaDB adapter. Requires `npm i -D mysql2`. */
export class MySqlAdapter implements DatabaseClient {
  readonly type = 'mysql' as const;
  private connection?: MySqlConnectionLike;

  constructor(private readonly config: DatabaseConfig) {}

  async connect(): Promise<void> {
    if (this.connection) {
      return;
    }
    const mysql = await loadOptionalModule<MySqlModule>(
      'mysql2/promise',
      'Run "npm i -D mysql2" to enable MySQL support.'
    );
    this.connection = await mysql.createConnection(
      this.config.connectionString ?? {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
      }
    );
  }

  async disconnect(): Promise<void> {
    await this.connection?.end();
    this.connection = undefined;
  }

  isConnected(): boolean {
    return this.connection !== undefined;
  }

  async healthCheck(): Promise<boolean> {
    await this.requireConnection().ping();
    return true;
  }

  async query<T = Record<string, unknown>>(
    statement: string,
    params: readonly unknown[] = []
  ): Promise<QueryResult<T>> {
    const [rows] = await this.requireConnection().execute(statement, [...params]);
    const list = Array.isArray(rows) ? (rows as T[]) : [];
    return { rows: list, rowCount: list.length };
  }

  private requireConnection(): MySqlConnectionLike {
    if (!this.connection) {
      throw new ConfigurationError('MySqlAdapter is not connected. Call connect() first.');
    }
    return this.connection;
  }
}
