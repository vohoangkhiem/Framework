# Changelog

All notable changes to this framework are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and versions follow SemVer.

## [Unreleased]

### Fixed

- WebKit in the GitHub Actions container crashed on every second navigation within a test (home
  -> product, login reload, header -> cart, delete-item reload): explicit `Page crashed` errors, or a
  dead page reported as "element(s) not found" / `Received: undefined` for the product title and
  the welcome text. Chromium and Firefox ran the identical steps green, so this is not an
  application defect. Root cause: every Demoblaze page instantiates a video.js HLS player (in a
  modal no test opens) whose MediaSource is backed by a GStreamer pipeline on WebKit/Linux, and
  that pipeline's teardown killed the renderer. `stubMediaPlayer` (`src/api/mocks`) now serves an
  inert `videojs` and aborts HLS traffic for every browser context (`BLOCK_MEDIA`, default `true`).
- `ProductPage` gave the product details only the default 10 s expect budget right after the
  navigation committed, although `#tbodyid` is rendered from `config.json` + `POST /view`. On a
  loaded WebKit (GitHub Actions container) this surfaced as "element(s) not found" for `h2.name`
  and the "Add to cart" button, and the cart journeys hit the 60 s test timeout. `waitForReady()`
  now budgets the details like a navigation, `expectProduct()` waits for readiness first, and the
  UI cart journeys in `cart.spec.ts` declare `test.slow()` like the place-order journeys.

### Added

- `BLOCK_MEDIA` environment variable; `tests/framework/media-player-stub.spec.ts` covers the URL
  matchers, the inert player and the aborted HLS requests.
- The `page` fixture records renderer crashes as a `[crash]` line in the console-errors attachment
  and in the framework log.

### Changed

- GitHub Actions: `upload-artifact@v7` and `download-artifact@v8` (Node 24 runtime; v5 still ran on
  the deprecated Node 20) and jobs pinned to `ubuntu-24.04` instead of `ubuntu-latest`, which
  migrates to Ubuntu 26.04 from October 2026.

## [2.1.0] - 2026-09-15

### Fixed

- `handleDialog` measured its timeout from before the triggering action, so a slow click (14 s on
  a loaded WebKit) exhausted the 10 s dialog budget and produced a false `DialogTimeoutError`.
  The clock now starts once the action has completed, and the listener is always detached.
- `TEST_TAGS` / `EXCLUDE_TAGS` were applied at the config level, which Playwright also enforces
  on dependency projects: tag-filtered runs silently dropped the `setup` project (no shared
  account, no storage state). Filters are now applied per project; `setup` is never filtered
  (ADR-0005).
- The per-test log attached on failure contained only the spec's own lines. The test logger is
  now a child of the framework logger, so API calls, preconditions, mocked routes and navigation
  retries are part of the attachment.
- `RetryExhaustedError` reported the configured attempt budget instead of the attempts made.

### Added

- `tests/framework`: self-tests for dialog handling, retry/backoff, environment schema, tag
  mapping, logger sanitisation and data utilities (`framework` project, `npm run test:framework`).
- `tests/mobile`: phone-viewport shopping journey on Pixel 7 and iPhone 14;
  `HeaderComponent.expandMenu()` handles the collapsed navigation.
- `SummaryReporter` (`src/reporting`): per-project pass/fail table for the console,
  `test-results/summary.md` and the GitHub Actions job summary.
- `.gitlab-ci.yml` (quality gate, API + framework job, 3 UI shards, merged report), nightly
  schedule in the GitHub workflow, mobile/framework choices in the manual workflow, pull request
  template.
- `HomePage.gotoExpectingEmptyCatalog()` and `alertMessages.productAddedLoggedIn` so specs no
  longer need raw `page` calls or literal alert text.

## [2.0.0] - 2026-09-15

### Added

- Layered architecture: `core` (logger, errors, retry, waits, `@step` decorator), `api`
  (typed clients, Zod contracts, preconditions, `RouteMocker`, `NetworkRecorder`), `data`
  (static catalog, builders, Faker factories, parameterised cases), `db` (driver-agnostic
  PostgreSQL/MySQL/MongoDB adapters), `models`, `utils` (string, random, date, number, JSON,
  file, storage, dialog, screenshot, performance helpers).
- Fixture groups composed with `mergeTests`; custom matchers `toBeSuccessful`,
  `toMatchSchema`, `toBeWithinRange`.
- Validated multi-environment configuration (`environments/.env.<env>`, Zod schema) with
  secret redaction and a configurable artifact location (`OUTPUT_DIR`).
- Resilience layer: API preconditions confirm read-your-writes on the eventually consistent
  backend, navigation retries once on transient network errors, product clicks are retried when
  a re-rendering grid swallows them, and Bootstrap modals are typed into only after their
  transition completes.
- `setup` project storing authenticated storage state; `api` browser-less project; mobile
  projects reserved for `tests/mobile`.
- Demo suites: login (valid, invalid, edge cases, mocked API, storage state), cart, place-order
  journey with validation and edge cases, catalog mocking, cart/auth/catalog API suites.
- CI: parameterised Jenkinsfile with dynamic sharding and report merging; GitHub Actions with
  quality gate, sharded matrix and merged report; Dockerfile and docker-compose.
- Code quality: ESLint (type-aware, Playwright plugin), Prettier, Husky + lint-staged,
  Conventional Commits hook, EditorConfig, VS Code workspace settings.
- Documentation: README, ARCHITECTURE, TEST_STRATEGY, CONTRIBUTING, ADRs, spec template;
  performance scaffolding for k6 and Artillery.

### Changed

- Upgraded to Playwright 1.61.1 (last release supporting Node 18), TypeScript 5.9, ESLint 8.57
  with typescript-eslint 8, Faker 9, dotenv 17.
- Tests reorganised under `tests/{api,ui,e2e,performance,setup}` plus reserved folders.
- `.env` is now git-ignored; `.env.example` documents every variable.

### Removed

- `src/support/` (replaced by `src/fixtures/`), `src/utils/api-utils.ts` (replaced by
  `src/api/clients/`), ad hoc `.env` parsing in test data.
