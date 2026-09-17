# ADR-0005: Tag filters are applied per project, never globally

**Status:** Accepted — 2026-09-15

## Context

`TEST_TAGS` / `EXCLUDE_TAGS` are mapped to Playwright's `grep` / `grepInvert`. The first
implementation set them at the top level of `playwright.config.ts`, where every project inherits
them. Playwright applies a config-level `grep` to dependency projects as well (only the CLI
`--grep` flag is limited to the selected projects), so a run such as `TEST_TAGS=@smoke` silently
removed the only test of the `setup` project. Browser projects then ran without the shared account
guarantee and without a storage state; the storage-state suite skipped itself and negative login
tests depended on the account happening to exist already.

## Decision

- `grep` / `grepInvert` are spread into every project except `setup` (`tagFilter` in
  `playwright.config.ts`).
- The `setup` project is never filtered: it runs whenever a project that depends on it runs.
- Tests that need the storage state check `hasStoredAuthState()` and skip with an explicit reason,
  so a missing state is visible in the report rather than a silent pass.

## Consequences

- Tag-filtered runs (CI parameters, Docker, `.env`) behave exactly like unfiltered ones with
  respect to preconditions.
- Adding a project means adding `...tagFilter` unless the project is itself a dependency.
