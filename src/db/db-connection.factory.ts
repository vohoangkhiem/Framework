import { config } from '../config/environment';
import { ConfigurationError } from '../core/errors';
import { logger } from '../core/logger';
import { MongoAdapter } from './adapters/mongo.adapter';
import { MySqlAdapter } from './adapters/mysql.adapter';
import { PostgresAdapter } from './adapters/postgres.adapter';
import type { DatabaseClient, DatabaseConfig } from './db.types';

/**
 * Creates database clients from configuration. The factory is the only place that knows
 * about concrete adapters; everything else programs against `DatabaseClient`.
 */
export const DbConnectionFactory = {
  /** Builds a config from DB_* environment variables; throws when DB_TYPE is not set. */
  fromEnv(): DatabaseConfig {
    if (!config.db.type) {
      throw new ConfigurationError(
        'DB_TYPE is not set. Configure DB_TYPE (postgres | mysql | mongo) and connection details.'
      );
    }
    return {
      type: config.db.type,
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
      connectionString: config.db.connectionString,
    };
  },

  create(dbConfig: DatabaseConfig = DbConnectionFactory.fromEnv()): DatabaseClient {
    switch (dbConfig.type) {
      case 'postgres':
        return new PostgresAdapter(dbConfig);
      case 'mysql':
        return new MySqlAdapter(dbConfig);
      case 'mongo':
        return new MongoAdapter(dbConfig);
    }
  },

  /** Connects, runs `work`, and always disconnects, even when `work` throws. */
  async withConnection<T>(
    work: (client: DatabaseClient) => Promise<T>,
    dbConfig?: DatabaseConfig
  ): Promise<T> {
    const client = DbConnectionFactory.create(dbConfig);
    await client.connect();
    logger.debug('Database connection opened', { type: client.type });
    try {
      return await work(client);
    } finally {
      await client.disconnect();
      logger.debug('Database connection closed', { type: client.type });
    }
  },
} as const;
