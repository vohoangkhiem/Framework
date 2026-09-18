# Architecture

This document explains how the framework is layered and why. The README covers day-to-day
usage; architectural decisions with alternatives are recorded in `docs/adr/`.

## Layers (dependencies point downwards only)

```
tests/                    Specs: intent, data selection, assertions. No selectors, no waits.
   │
src/fixtures/             Dependency injection: composes pages, workflows, API clients, data.
   │
src/workflows/            Multi-page business journeys (browse -> cart -> order).
src/pages/                Page objects + components: locators, actions, expectXxx() assertions.
src/api/                  Typed API clients, Zod contracts, preconditions, mocking, recording.
   │
src/data/                 Static catalog, builders, factories, parameterised test cases.
src/models/               Domain types shared by every layer.
src/utils/                Pure helpers (strings, dates, random, files, storage, dialogs...).
src/core/                 Framework plumbing: logger, errors, retry, waits, step decorator.
src/config/               Validated environment configuration and tag registry.
src/reporting/            Custom Playwright reporters (run summary for console, artifacts, CI job summary).
src/db/                   Driver-agnostic database access (optional).
```

`tests/framework/` sits outside this stack: it tests the framework itself (dialog helper timing,
retry semantics, configuration parsing, data utilities) and runs as the `framework` project.

Rules that keep the layers honest:

1. **Specs never touch `page.locator`**; they call page-object methods. This is what makes a
   selector change a one-file fix in a 500-spec project.
2. **Assertions live in two places only**: `expectXxx()` methods on pages/components (web-first,
   auto-waiting) and specs (pure data checks such as totals or API payloads).
3. **State is established through the API whenever the UI is not the subject** (see ADR-0002).
4. **Nothing reads `process.env` except `src/config/environment.ts`** (see ADR-0003).
5. **No sleeps.** Readiness is a locator condition or an awaited network response. `WaitUtils`
   exists for the few conditions that are not expressible as locator assertions.

## Runtime composition

```
playwright.config.ts ──reads──▶ config (validated env)
        │ projects: setup ─▶ chromium / firefox / webkit / mobile-*   +   api
        ▼
tests/setup/auth.setup.ts   ensures shared account, saves .auth/user.json
        ▼
spec ──▶ test (mergeTests of base + page + auth/api + data fixtures)
              ├─ page override: collects console errors, attaches them on failure
              ├─ logger: per-test structured log attached on failure
              ├─ networkRecorder / routeMocker: observe or stub the API layer
              └─ authenticatedUser / cartPreconditions: API-based state
```

## Resilience toolkit

| Concern                             | Mechanism                                                                                                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Element timing                      | Playwright auto-wait + web-first `expect` in page objects; Bootstrap `show` class checks                                                                                                              |
| Async re-rendering (cart rows)      | `expect(locator).toHaveCount/ToHaveText` retries; `WaitUtils.forDomStable` for snapshots                                                                                                              |
| Requests racing the click           | `WaitUtils.forApiResponse` registered before the action, awaited after                                                                                                                                |
| Native dialogs                      | `handleDialog` registers `page.once('dialog')` before the action; the timeout starts only after the action completes, so slow clicks never consume the dialog budget; the listener is always detached |
| Eventually consistent backend       | `CartPreconditions.seed` confirms read-your-writes before the UI loads; `AuthPreconditions.obtainToken` confirms `/check` accepts the token; `CartPage.expectEmpty` reloads until the API agrees      |
| Transient API errors                | `BaseApiClient` retries 5xx/network errors with exponential backoff (never 4xx)                                                                                                                       |
| Transient browser network errors    | `BasePage.navigate` retries a navigation once on `ERR_NETWORK_CHANGED`-class errors                                                                                                                   |
| Clicks swallowed by re-rendering    | `HomePage.openProduct` re-clicks when no navigation follows; `selectCategory` waits for a stable grid                                                                                                 |
| Animated modals stealing focus      | `ModalComponent.expectOpen` waits for the Bootstrap transition to finish before typing                                                                                                                |
| Test isolation                      | Unique users per test (`RandomUtils.uniqueId`), one anonymous cart cookie per browser context                                                                                                         |
| Tag-filtered runs                   | `grep` / `grepInvert` applied per project; the `setup` dependency is never filtered (ADR-0005)                                                                                                        |
| Responsive layout                   | `HeaderComponent.expandMenu()` opens the collapsed navigation on phone viewports; page objects stay viewport-agnostic                                                                                 |
| Media player in the page under test | `stubMediaPlayer` (per context, `BLOCK_MEDIA`) serves an inert video.js and aborts HLS requests, so browsers never build a media pipeline; WebKit/Linux crashed on its teardown between navigations   |
| Failure diagnostics                 | Trace, video, screenshot on failure + console errors + network log + the complete structured log (spec lines and framework activity)                                                                  |

## Reporting

`list` for the console, `html` for humans, `junit` for CI dashboards, `json` for tooling, the
`SummaryReporter` for a per-project table (console, `test-results/summary.md`, GitHub job summary)
and in CI additionally `blob` so sharded runs can be merged (`scripts/merge-reports.js`). The
`@step` decorator names every page-object call in the report and trace viewer.

## Extending the framework

| Need                | Where                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| New page            | `src/pages/<name>.page.ts` extending `BasePage`; register in `page.fixtures.ts`                     |
| New reusable widget | `src/pages/components/<name>.component.ts` extending `BaseComponent`                                |
| New API             | `src/api/clients/<name>-api.client.ts` + schema + model; expose in `api.fixtures.ts`                |
| New fixture group   | `src/fixtures/<group>.fixtures.ts` and add to `mergeTests` in `src/fixtures/index.ts`               |
| New test type       | `tests/<type>/` (+ project in `playwright.config.ts` with `...tagFilter` unless it is a dependency) |
| New reporter        | `src/reporting/<name>.reporter.ts` implementing Playwright's `Reporter`; register by path           |
| New environment     | `environments/.env.<name>` + extend the `TEST_ENV` enum in `env.schema.ts`                          |
| New tag             | `src/config/test-tags.ts`                                                                           |
| Framework change    | Add or update a spec in `tests/framework/`                                                          |
