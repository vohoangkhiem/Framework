export type DatabaseType = 'postgres' | 'mysql' | 'mongo';

export interface DatabaseConfig {
  type: DatabaseType;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  /** Takes precedence over the discrete fields when provided. */
  connectionString?: string;
}

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Engine-agnostic contract implemented by every adapter. Tests and repositories depend on
 * this interface only, so swapping PostgreSQL for MySQL is a configuration change.
 */
export interface DatabaseClient {
  readonly type: DatabaseType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  /** Cheap round-trip used by smoke checks and global setup. */
  healthCheck(): Promise<boolean>;
  /**
   * Executes a statement. For SQL engines `statement` is parameterised SQL; for MongoDB it is
   * a JSON command (see MongoAdapter). Prefer the typed repository layer for real queries.
   */
  query<T = Record<string, unknown>>(
    statement: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<T>>;
}

/** Additional document-oriented operations offered by NoSQL adapters. */
export interface DocumentDatabaseClient extends DatabaseClient {
  find<T>(collection: string, filter: Record<string, unknown>, limit?: number): Promise<T[]>;
  insertOne(collection: string, document: Record<string, unknown>): Promise<string>;
  deleteMany(collection: string, filter: Record<string, unknown>): Promise<number>;
}
