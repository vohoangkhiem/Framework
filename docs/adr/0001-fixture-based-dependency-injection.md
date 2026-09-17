# ADR-0001: Fixture-based dependency injection with `mergeTests`

**Status:** Accepted — 2026-09-15

## Context

Page objects, API clients, workflows and test data must be available to every spec without
boilerplate. Early versions instantiated page objects inside tests or via a single, growing
fixture file, which does not scale across teams.

## Decision

- Group fixtures by concern in `src/fixtures/*.fixtures.ts` (`base`, `page`, `api`, `auth`,
  `data`), each exporting its own `xxxTest`.
- Compose them with Playwright's `mergeTests` in `src/fixtures/index.ts`; specs import a single
  `test` / `expect`.
- Override the built-in `page` fixture (not an `auto` fixture) to collect console errors, so
  API-only tests never launch a browser.

## Consequences

- Adding a fixture group is additive: one new file, one line in `mergeTests`.
- Type inference gives autocompletion for every fixture in every spec.
- Fixture files must stay side-effect free at import time (no network calls) because all of
  them are loaded for every spec.
