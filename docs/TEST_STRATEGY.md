# Test strategy

## Scope by layer

| Layer         | Location                              | Purpose                                          | Runs                       |
| ------------- | ------------------------------------- | ------------------------------------------------ | -------------------------- |
| API           | `tests/api`                           | Contract + behaviour of endpoints, fast feedback | Every PR (`api` project)   |
| UI functional | `tests/ui/<feature>`                  | Feature behaviour incl. negative and edge cases  | Every PR (3 browsers)      |
| End-to-end    | `tests/e2e`                           | Cross-feature business journeys (checkout)       | Every PR / nightly         |
| Performance   | `tests/performance`                   | Timing budgets as early warning                  | Nightly                    |
| Load          | `performance/`                        | k6 / Artillery scenarios                         | Scheduled, dedicated stage |
| Visual / a11y | `tests/visual`, `tests/accessibility` | Screenshot diffs, WCAG audits (reserved)         | Nightly                    |

## Tag vocabulary (`src/config/test-tags.ts`)

- **Suite**: `@smoke` (critical path, < 10 min), `@regression` (full functional), `@e2e`
- **Layer**: `@ui`, `@api`, `@performance`
- **Feature**: `@auth`, `@catalog`, `@cart`, `@checkout`
- **Nature**: `@negative`, `@edge-case`, `@mock`, `@flaky` (quarantined), `@wip` (excluded in CI)

Selection is done with `TEST_TAGS` / `EXCLUDE_TAGS` (mapped to `--grep` / `--grep-invert`) or the
CLI flags directly. CI excludes `@wip|@flaky` by default.

## Environments

`TEST_ENV` selects `environments/.env.<env>`; secrets come from `.env` locally and the CI
credential store in pipelines. Production runs are restricted to non-destructive `@smoke` tests
(`npm run test:prod`).

## Test data

- **Unique per test**: users are generated with a time-based unique id; carts are isolated per
  browser context through a dedicated `user` cookie.
- **Builders** express intent (`OrderBuilder.anOrder().withoutCreditCard()`), **factories**
  produce realistic defaults (Faker), and the **static catalog** pins ids/prices used in
  assertions. An API test guards the catalog against drift.

## Flakiness policy

1. A test that fails intermittently is tagged `@flaky` (quarantined) the same day, with a ticket.
2. Root cause is fixed in the framework layer (waits, preconditions), not by adding retries.
3. Retries (`CI_RETRIES=2`) exist to survive infrastructure blips; a test that only passes on
   retry is treated as failing in review.
4. Traces (`retain-on-failure`) are the first artefact to inspect: `npx playwright show-trace`.

## Definition of done for a new test

- Uses fixtures and page objects only (no raw selectors in the spec).
- Covers the happy path, at least one negative path and relevant edge cases.
- Tagged with suite + layer + feature tags.
- Passes on Chromium, Firefox and WebKit locally (`npm run test:browsers`).
- Lint, typecheck and format checks pass (`npm run validate`).
