# Database layer

Generic, driver-agnostic database access for test preconditions and back-end verification.

```
src/db/
├── db.types.ts                 # DatabaseClient / DocumentDatabaseClient contracts
├── db-connection.factory.ts    # DbConnectionFactory.create() / withConnection()
├── optional-module.loader.ts   # Lazy-loads drivers that are not bundled with the framework
├── adapters/
│   ├── postgres.adapter.ts     # npm i -D pg @types/pg
│   ├── mysql.adapter.ts        # npm i -D mysql2
│   └── mongo.adapter.ts        # npm i -D mongodb
└── repositories/               # Domain repositories (UserRepository, OrderRepository, ...)
```

## Design

- **No driver is installed by default.** Drivers are loaded with a dynamic `import()` the first
  time `connect()` is called. Install only what your project needs.
- **Configuration comes from the environment** (`DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
  `DB_PASSWORD` or a single `DB_CONNECTION_STRING`). Secrets must be injected by the CI credential
  store, never committed.
- **Repositories, not raw SQL in tests.** Put queries in `repositories/*.repository.ts` classes that
  accept a `DatabaseClient` and expose intention-revealing methods (`findOrderById`, `deleteTestUsers`).

## Usage

```ts
import { DbConnectionFactory } from '@db/index';

await DbConnectionFactory.withConnection(async db => {
  const { rows } = await db.query<{ id: number; status: string }>(
    'SELECT id, status FROM orders WHERE customer_email = $1',
    ['qa@example.com']
  );
  expect(rows[0]?.status).toBe('PAID');
});
```

Expose the client as a fixture (`src/fixtures/db.fixtures.ts`) once a project actually needs
database access so that connections are opened per worker and closed automatically.
