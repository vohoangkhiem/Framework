# ADR-0003: Validated, layered environment configuration

**Status:** Accepted — 2026-09-15

## Context

Configuration was read ad hoc from `process.env` with string defaults scattered across files,
and credentials were committed in `.env`. Large projects need several environments, CI-injected
secrets and immediate feedback on misconfiguration.

## Decision

- A single Zod schema (`src/config/env.schema.ts`) declares every variable, its type and default.
- `src/config/environment.ts` loads `.env` (local, git-ignored) then `environments/.env.<TEST_ENV>`
  (committed, no secrets) without overriding real process variables, validates once, and exports
  an immutable `config` object. Empty values are treated as "not provided".
- Secrets (`TEST_USERNAME`, `TEST_PASSWORD`, `DB_PASSWORD`) are only ever supplied by `.env` or
  the CI credential store (Jenkins `withCredentials`, GitHub `secrets`). Logging redacts them.
- Nothing outside `src/config` reads `process.env`.

## Consequences

- A typo in `TRACE_MODE` or a non-numeric timeout aborts the run with a precise message instead
  of producing confusing test failures.
- Adding an environment is a new file plus one enum value.
- `.env` moved to `.gitignore`; `.env.example` documents all keys.
