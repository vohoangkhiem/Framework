import { ConfigurationError } from '../../core/errors';
import { isRecord } from '../../utils/json-utils';
import type { DatabaseConfig, DocumentDatabaseClient, QueryResult } from '../db.types';
import { loadOptionalModule } from '../optional-module.loader';

/** Minimal surface of the `mongodb` driver used by this adapter. */
interface MongoCollectionLike {
  find(filter: Record<string, unknown>): {
    limit(count: number): { toArray(): Promise<unknown[]> };
    toArray(): Promise<unknown[]>;
  };
  insertOne(document: Record<string, unknown>): Promise<{ insertedId: { toString(): string } }>;
  deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
}

interface MongoDbLike {
  collection(name: string): MongoCollectionLike;
  command(command: Record<string, unknown>): Promise<Record<string, unknown>>;
}

interface MongoClientLike {
  connect(): Promise<unknown>;
  close(): Promise<void>;
  db(name?: string): MongoDbLike;
}

interface MongoModule {
  MongoClient: new (uri: string) => MongoClientLike;
}

/** MongoDB adapter. Requires `npm i -D mongodb`. */
export class MongoAdapter implements DocumentDatabaseClient {
  readonly type = 'mongo' as const;
  private client?: MongoClientLike;

  constructor(private readonly config: DatabaseConfig) {}

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }
    const mongo = await loadOptionalModule<MongoModule>(
      'mongodb',
      'Run "npm i -D mongodb" to enable MongoDB support.'
    );
    const client = new mongo.MongoClient(this.connectionUri());
    await client.connect();
    this.client = client;
  }

  async disconnect(): Promise<void> {
    await this.client?.close();
    this.client = undefined;
  }

  isConnected(): boolean {
    return this.client !== undefined;
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.database().command({ ping: 1 });
    return result.ok === 1;
  }

  /**
   * Runs a raw database command expressed as JSON, e.g. `{"count": "orders"}`.
   * Parameters are not applicable to commands and are ignored.
   */
  async query<T = Record<string, unknown>>(statement: string): Promise<QueryResult<T>> {
    const command: unknown = JSON.parse(statement);
    if (!isRecord(command)) {
      throw new ConfigurationError(
        'MongoAdapter.query expects a JSON object describing a database command.'
      );
    }
    const result = await this.database().command(command);
    return { rows: [result as T], rowCount: 1 };
  }

  async find<T>(collection: string, filter: Record<string, unknown>, limit?: number): Promise<T[]> {
    const cursor = this.database().collection(collection).find(filter);
    const documents =
      limit === undefined ? await cursor.toArray() : await cursor.limit(limit).toArray();
    return documents as T[];
  }

  async insertOne(collection: string, document: Record<string, unknown>): Promise<string> {
    const result = await this.database().collection(collection).insertOne(document);
    return result.insertedId.toString();
  }

  async deleteMany(collection: string, filter: Record<string, unknown>): Promise<number> {
    const result = await this.database().collection(collection).deleteMany(filter);
    return result.deletedCount;
  }

  private database(): MongoDbLike {
    if (!this.client) {
      throw new ConfigurationError('MongoAdapter is not connected. Call connect() first.');
    }
    return this.client.db(this.config.database);
  }

  private connectionUri(): string {
    if (this.config.connectionString) {
      return this.config.connectionString;
    }
    const credentials =
      this.config.user && this.config.password
        ? `${encodeURIComponent(this.config.user)}:${encodeURIComponent(this.config.password)}@`
        : '';
    return `mongodb://${credentials}${this.config.host ?? 'localhost'}:${this.config.port ?? 27017}/${this.config.database ?? ''}`;
  }
}
