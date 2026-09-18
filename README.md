# Demoblaze Test Automation Framework

Production-ready UI and API test automation framework for [Demoblaze](https://www.demoblaze.com/), built with **Playwright 1.61** and **TypeScript 5 (strict)**. It is designed as a template for large projects: layered architecture, fixture-based dependency injection, API-driven preconditions, validated multi-environment configuration, rich diagnostics, and CI pipelines with sharding.

- [Quick start](#quick-start)
- [Framework structure and rationale](#framework-structure-and-rationale)
  - [Folder layout](#folder-layout)
  - [Why it is organised this way](#why-it-is-organised-this-way)
  - [One demo test through the layers](#one-demo-test-through-the-layers)
- [Key design decisions](#key-design-decisions)
- [Configuration and secrets](#configuration-and-secrets)
- [Running tests](#running-tests)
- [Demo scripts](#demo-scripts)
  - [Steps to execute the demo scripts](#steps-to-execute-the-demo-scripts)
  - [What the demo scripts cover](#what-the-demo-scripts-cover)
- [Reporting and diagnostics](#reporting-and-diagnostics)
- [Code quality](#code-quality)
- [CI/CD](#cicd)
  - [Jenkins](#jenkins)
  - [GitHub Actions](#github-actions)
  - [GitLab CI](#gitlab-ci)
  - [Docker](#docker)
- [Scaling the framework for large projects](#scaling-the-framework-for-large-projects)
- [Troubleshooting](#troubleshooting)

---

## Quick start

Prerequisites: **Node.js >= 18.18** (20 LTS recommended, see `.nvmrc`) and **npm >= 9**.

```bash
npm ci                          # install dependencies (also installs git hooks when in a git repo)
npx playwright install          # download Chromium, Firefox and WebKit
cp .env.example .env            # set TEST_USERNAME / TEST_PASSWORD for the shared account
npm run test:demo               # login + place-order flows on Chromium, Firefox and WebKit
npm run report                  # open the HTML report
```

`TEST_USERNAME` / `TEST_PASSWORD` identify a shared account used by negative login tests and the
storage-state demo. The `setup` project creates it automatically if it does not exist yet. Any
value works on Demoblaze; pick something unique to you. A detailed walkthrough is in
[Steps to execute the demo scripts](#steps-to-execute-the-demo-scripts).

---

## Framework structure and rationale

### Folder layout

```
.
├── .github/workflows/        CI: quality gate + sharded matrix + report merge (also nightly); manual run
├── .github/                  Pull request template with the definition-of-done checklist
├── .husky/                   pre-commit (lint-staged + typecheck) and commit-msg hooks
├── .vscode/                  Recommended extensions, settings and tasks
├── docs/                     ARCHITECTURE, TEST_STRATEGY, CONTRIBUTING, adr/, templates/
├── environments/             .env.dev | .env.staging | .env.prod (committed, no secrets)
├── performance/              k6/ and artillery/ load-test scaffolding
├── scripts/                  clean-results, merge-reports, setup-hooks, verify-commit-msg
├── src/
│   ├── api/                  API layer
│   │   ├── clients/          BaseApiClient + Auth/Catalog/Cart clients (typed, retrying, logged)
│   │   ├── models/           Request/response DTOs and runtime type guards
│   │   ├── schemas/          Zod contracts used by clients and the toMatchSchema matcher
│   │   ├── preconditions/    API-based state: ensureUserExists, authenticateContext, seed carts
│   │   ├── mocks/            RouteMocker (page.route wrapper with CORS/preflight handling), media player stub, data
│   │   └── interceptors/     NetworkRecorder (passive request/response log for assertions)
│   ├── config/               env.schema (Zod), environment (typed config), test-tags, global hooks
│   ├── core/                 logger, errors, retry, WaitUtils, @step decorator
│   ├── data/                 static/ catalog & messages, builders/, factories/ (Faker), test-cases/
│   ├── db/                   DatabaseClient contract, factory, Postgres/MySQL/Mongo adapters, repositories/
│   ├── fixtures/             base | page | api | auth | data fixture groups, custom matchers, index
│   ├── models/               Domain types (user, product, order)
│   ├── pages/                Page objects + components/ (header, modal, order confirmation)
│   ├── reporting/            SummaryReporter: per-project table for console, artifacts and GitHub job summary
│   ├── utils/                string, random, date, number, json, file, storage, dialog, screenshot, performance
│   └── workflows/            Multi-page business journeys (auth, cart/checkout)
├── tests/
│   ├── api/                  auth-api, products-api, cart-api           (project: api)
│   ├── ui/                   authentication/, checkout/, catalog/       (chromium | firefox | webkit)
│   ├── e2e/                  place-order journey
│   ├── mobile/               phone-viewport shopping journey            (mobile-chrome | mobile-safari)
│   ├── performance/          timing budgets collected during functional runs
│   ├── framework/            self-tests of the framework (dialog handling, retry, config, utils)
│   ├── setup/                auth.setup: shared account + authenticated storage state
│   ├── accessibility/        reserved (README explains how to start)
│   ├── contract/             reserved
│   └── visual/               reserved
├── .env.example              Every supported variable, documented (.env itself is git-ignored)
├── .eslintrc.js  .prettierrc  .prettierignore  .editorconfig  .lintstagedrc.json  .nvmrc
├── Dockerfile  docker-compose.yml  .dockerignore
├── Jenkinsfile               Parameterised declarative pipeline with dynamic sharding
├── .gitlab-ci.yml            GitLab pipeline: quality gate, API + framework tests, 3 UI shards, merged report
├── package.json  playwright.config.ts  tsconfig.json
└── README.md  CHANGELOG.md
```

### Why it is organised this way

The code is arranged in layers, and dependencies only point downwards: a spec may use a
fixture, a fixture may build a page object, a page object may use a utility, never the other
way round. The goal is that each kind of change lands in exactly one layer.

```
tests/            intent, data selection, assertions          "what we check"
   │
src/fixtures/     dependency injection (mergeTests)            "how a spec gets its tools"
   │
src/workflows/    multi-page business journeys                 "how the user does it"
src/pages/        page objects and components                  "where things are on the page"
src/api/          typed clients, contracts, preconditions      "how we talk to the backend"
   │
src/data/         catalog, builders, factories, test cases     "which values we use"
src/models/       shared domain types
src/utils/        pure helpers
src/core/         logger, errors, retry, waits, @step
src/config/       validated environment + tag registry
```

| Layer                          | What belongs here                                                                                              | Why it is separate                                                                                                                                |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/`                       | Specs grouped by type (`api`, `ui/<feature>`, `e2e`, `mobile`) and tagged (`@smoke`, `@auth`, ...).            | Specs read as business scenarios; they contain no selectors or waits, so a UI change never requires touching a spec.                              |
| `src/fixtures/`                | Fixture groups (`base`, `page`, `api`, `auth`, `data`) composed with `mergeTests`; custom matchers.            | One `test` import gives every spec typed access to pages, workflows, clients and data. Adding a concern is one file plus one line (ADR-0001).     |
| `src/workflows/`               | Journeys that span several pages, e.g. browse -> product -> cart -> order.                                     | The same journey is reused by the cart and place-order suites, so it is written once and annotated once with `@step`.                             |
| `src/pages/`                   | One class per page or component: locators, actions and `expectXxx()` assertions.                               | Locators live in a single place. Readiness (e.g. the product page rendering after `POST /view`) is encoded once instead of in every test.         |
| `src/api/`                     | `BaseApiClient` + typed clients, Zod schemas, preconditions (create user, seed cart), `RouteMocker`, recorder. | Test state is created through the API in milliseconds and the UI is exercised only where it is the subject (ADR-0002).                            |
| `src/data/`                    | Static product catalog, builders, Faker factories, parameterised test cases.                                   | Specs choose data by intent (`builders.cart().withProducts(...)`); expected totals and messages are computed, not hard-coded per test.            |
| `src/core/`, `src/utils/`      | Logger, error hierarchy, retry/backoff, `WaitUtils`, `@step`; pure string/date/number/dialog helpers.          | Framework plumbing is shared and tested by `tests/framework`, so resilience fixes (like a dialog-timing bug) are made once and covered by a test. |
| `src/config/`                  | `env.schema.ts` (Zod), `environment.ts` (immutable `config`), `test-tags.ts`.                                  | Nothing else reads `process.env`; misconfiguration fails at startup with a readable message (ADR-0003).                                           |
| `src/reporting/`, `src/db/`    | `SummaryReporter`; optional driver-agnostic database access.                                                   | Kept outside the test stack so they can evolve (or be dropped) without touching specs or pages.                                                   |
| `environments/`, `.env`        | Committed per-environment defaults, git-ignored local overrides.                                               | The same suite runs against dev, staging or prod by switching `TEST_ENV`; secrets never enter the repository.                                     |
| `.github/`, `Jenkinsfile`, ... | Pipelines for GitHub Actions, Jenkins, GitLab; Dockerfile.                                                     | The framework is CI-agnostic: every pipeline calls the same npm scripts and reads the same environment variables.                                 |

Five rules keep the layers honest (details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)):
specs never call `page.locator`; assertions live only in page objects and specs; state is set
up through the API unless the UI is the subject; only `src/config/environment.ts` reads
`process.env`; no sleeps, readiness is always a locator condition or an awaited response.

### One demo test through the layers

The place-order demo (`tests/e2e/place-order.spec.ts`) shows how the layers cooperate:

1. The spec picks a parameterised case from `src/data/test-cases/order.test-cases.ts` and asks
   the `cartWorkflow` fixture for `checkout(cart, orderData)`.
2. `src/fixtures/page.fixtures.ts` has already built `CartWorkflow` from the `HomePage`,
   `ProductPage`, `CartPage` and `PlaceOrderPage` page objects.
3. `CartWorkflow.checkout()` (`src/workflows/cart.workflow.ts`) opens each product through the
   real UI, adds it to the cart, verifies the cart lines and total, then submits the order
   form. Every method is decorated with `@step`, so the HTML report shows the journey as
   named steps.
4. Page objects wait on locator conditions and API responses (`WaitUtils.forApiResponse` for
   `/addtocart`, `handleDialog` for the native alert), never on fixed delays.
5. The confirmation dialog is parsed into a typed `OrderConfirmation` (`src/models`) and the
   spec asserts on plain data: id, amount from the catalog, card number, name and date.
6. On failure Playwright keeps the trace, video and screenshot (`playwright.config.ts`,
   ADR-0004) and the `base` fixtures attach the browser console errors and the structured log of
   everything the framework did for that test.

The [Key design decisions](#key-design-decisions) below summarise the trade-offs behind this
layout; each one links to an ADR with the alternatives that were considered.

---

## Key design decisions

Full rationale lives in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and the ADRs under
[`docs/adr/`](docs/adr). In short:

| Decision                                                                               | Why it matters at scale                                                                                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Layered architecture** (tests -> fixtures -> workflows/pages/api -> data/utils/core) | Selectors, waits and API details live in exactly one layer; specs read as business intent.                                    |
| **Fixture groups composed with `mergeTests`**                                          | New concerns (db, feature flags) are one file + one line; every spec gets typed access to everything.                         |
| **API preconditions, UI verification** (ADR-0002)                                      | Users and carts are created through the API in milliseconds; UI flows are exercised only where they are the subject.          |
| **Validated, layered configuration** (ADR-0003)                                        | Zod schema for all env vars; `process env > .env > environments/.env.<env> > defaults`; misconfiguration fails fast.          |
| **Web-first assertions, no sleeps**                                                    | Page objects expose `expectXxx()` built on auto-waiting `expect`; responses are awaited via `WaitUtils.forApiResponse`.       |
| **`@step` decorator on page/workflow methods**                                         | HTML report and trace viewer show a readable narrative without manual `test.step` calls.                                      |
| **Diagnostics on failure only** (ADR-0004)                                             | Trace + video + screenshot + console errors + network log + structured test log, attached only when a test fails.             |
| **Unique data per test**                                                               | Time-based unique usernames and a per-context cart cookie make parallel workers and retries collision-free.                   |
| **Tag filters per project, `setup` never filtered** (ADR-0005)                         | `TEST_TAGS=@smoke` in CI, Docker or `.env` keeps the shared-account setup and storage state; only the selected suites shrink. |
| **Framework self-tests** (`tests/framework`)                                           | Dialog handling, retry/backoff, configuration parsing and data utilities are tested like production code.                     |
| **Strict TypeScript, type-aware ESLint, `any` forbidden**                              | Un-awaited promises (the #1 flakiness source) and unsafe types are lint errors, enforced by pre-commit hooks and CI.          |

---

## Configuration and secrets

All configuration flows through `src/config/environment.ts`, which validates every variable
against `src/config/env.schema.ts` and exposes an immutable `config` object.

Resolution order (highest wins): real process environment (CI secrets, `cross-env`) -> `.env`
(local, git-ignored) -> `environments/.env.<TEST_ENV>` (committed, no secrets) -> schema defaults.

| Variable                                                                                     | Purpose                                                                                                | Default                                                       |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `TEST_ENV`                                                                                   | Selects `environments/.env.<env>`: `dev`, `staging`, `prod`                                            | `dev`                                                         |
| `BASE_URL`, `API_BASE_URL`                                                                   | Application and API under test                                                                         | Demoblaze URLs                                                |
| `TEST_USERNAME`, `TEST_PASSWORD`                                                             | Shared account (secret; from `.env` or the CI credential store)                                        | empty                                                         |
| `HEADLESS`                                                                                   | Headless browsers (always true in CI)                                                                  | `true`                                                        |
| `BLOCK_MEDIA`                                                                                | Serve an inert stand-in for the page's video.js HLS player and abort HLS traffic (see Troubleshooting) | `true`                                                        |
| `DEFAULT_TIMEOUT`, `ACTION_TIMEOUT`, `NAVIGATION_TIMEOUT`, `EXPECT_TIMEOUT`                  | Timeouts in ms                                                                                         | 60000 / 15000 / 30000 / 10000                                 |
| `LOCAL_RETRIES`, `CI_RETRIES`                                                                | Retries locally / in CI                                                                                | 0 / 2                                                         |
| `WORKERS`                                                                                    | Parallel workers, number or percentage (`4`, `50%`)                                                    | Playwright default / `50%` in CI                              |
| `TEST_TAGS`, `EXCLUDE_TAGS`                                                                  | Regex mapped to `--grep` / `--grep-invert`                                                             | none                                                          |
| `OUTPUT_DIR`                                                                                 | Artifact folder (traces, videos, screenshots, junit/json)                                              | `test-results`                                                |
| `TRACE_MODE`, `VIDEO_MODE`, `SCREENSHOT_MODE`                                                | Artifact policy                                                                                        | `retain-on-failure` / `retain-on-failure` / `only-on-failure` |
| `LOG_LEVEL`, `LOG_FORMAT`                                                                    | `debug\|info\|warn\|error\|silent`, `pretty\|json`                                                     | `info`, `pretty`                                              |
| `API_RETRIES`, `API_TIMEOUT`                                                                 | API client retry count and per-request timeout                                                         | 2, 15000                                                      |
| `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_CONNECTION_STRING` | Optional database access                                                                               | unset                                                         |

Secrets are never committed: `.env` is git-ignored, `environments/*` contain no credentials,
Jenkins injects them with `withCredentials`, GitHub Actions with `secrets.*`, and the logger
redacts any key that looks like a password, token or cookie.

---

## Running tests

| Command                                                                    | What it does                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm test`                                                                 | Clean artifacts, then run every project (setup, api, 3 desktop browsers) |
| `npm run test:demo`                                                        | The two demo flows on Chromium, Firefox and WebKit                       |
| `npm run test:smoke` / `npm run test:regression`                           | Tag-based suites                                                         |
| `npm run test:api`                                                         | Browser-less API project                                                 |
| `npm run test:framework`                                                   | Framework self-tests (dialog handling, retry, config schema, utilities)  |
| `npm run test:mobile`                                                      | Phone-viewport journeys on Pixel 7 (Chromium) and iPhone 14 (WebKit)     |
| `npm run test:ui` / `npm run test:e2e`                                     | UI feature tests / end-to-end journeys                                   |
| `npm run test:chromium` / `test:firefox` / `test:webkit` / `test:browsers` | Per browser / all three                                                  |
| `npm run test:headed` / `test:debug` / `test:ui-mode`                      | Local development modes                                                  |
| `npm run test:staging` / `npm run test:prod`                               | Switch environment (`prod` is restricted to `@smoke`)                    |
| `npm run report` / `npm run trace -- <trace.zip>`                          | Open the HTML report / a trace                                           |

Everything is also available through the Playwright CLI, for example:

```bash
npx playwright test tests/ui/checkout --project=firefox --grep @regression --grep-invert @flaky
npx playwright test --shard=2/4 --project=chromium        # CI sharding
npx cross-env TEST_TAGS="@smoke|@cart" playwright test    # tag filter via environment
```

Tags are constants in `src/config/test-tags.ts`: suite (`@smoke`, `@regression`, `@e2e`), layer
(`@ui`, `@api`, `@performance`, `@mobile`, `@framework`), feature (`@auth`, `@catalog`, `@cart`,
`@checkout`) and nature (`@negative`, `@edge-case`, `@mock`, `@flaky`, `@wip`). Filters apply to
the selected suites only; the `setup` project always runs when a browser project runs (ADR-0005).

---

## Demo scripts

The two demo scenarios requested for this assignment are:

| #   | Scenario                                      | Spec files                                                                         |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | Log in with valid credentials                 | `tests/ui/authentication/login.spec.ts`, `tests/ui/authentication/session.spec.ts` |
| 2   | Add product(s) to the cart and place an order | `tests/e2e/place-order.spec.ts` (+ `tests/ui/checkout/cart.spec.ts`)               |

### Steps to execute the demo scripts

Follow the steps in order; each one is a copy-and-paste command.

1. **Check the prerequisites.** Node.js `>= 18.18` (20 LTS recommended, see `.nvmrc`), npm
   `>= 9`, git and internet access (the tests run against the public
   <https://www.demoblaze.com>).

   ```bash
   node --version     # v18.18.0 or newer
   npm --version      # 9.x or newer
   ```

2. **Get the code and install the dependencies.**

   ```bash
   git clone https://github.com/vohoangkhiem/Framework.git
   cd Framework
   npm ci
   ```

3. **Install the browsers** Playwright drives (Chromium, Firefox and WebKit).

   ```bash
   npx playwright install            # Windows / macOS
   npx playwright install --with-deps   # Linux: also installs the system libraries
   ```

4. **Create the local configuration.** Copy the template and set the shared test account. Any
   unique username/password works: the `setup` project registers the account on Demoblaze
   automatically the first time it runs.

   ```bash
   cp .env.example .env              # PowerShell: Copy-Item .env.example .env
   ```

   Then edit `.env`:

   ```dotenv
   TEST_USERNAME=<pick-a-unique-username>
   TEST_PASSWORD=<pick-a-password>
   ```

   Everything else can stay at its default. Tip for Windows users with the project inside a
   cloud-synced folder (Google Drive, OneDrive): set `OUTPUT_DIR` to a local path such as
   `C:\temp\demoblaze-results` to avoid sync-lock errors during artifact cleanup.

5. **Run the demo scripts.** This runs both scenarios (login + add to cart / place order) on
   Chromium, Firefox and WebKit. The `setup` project runs first and creates the shared account
   and an authenticated storage state.

   ```bash
   npm run test:demo
   ```

   Useful variations:

   ```bash
   npx playwright test tests/ui/authentication tests/e2e --project=chromium   # one browser only
   npm run test:demo -- --headed                            # watch the browsers
   npx playwright test tests/ui/authentication --project=chromium   # demo 1 only
   npx playwright test tests/e2e --project=chromium                 # demo 2 only
   npx playwright test tests/ui/checkout/cart.spec.ts --project=chromium   # cart suite only
   npm run test:ui-mode                                     # Playwright UI mode (pick tests interactively)
   npm run test:debug                                       # step through with the Playwright Inspector
   ```

6. **Read the results.** The console prints a `list` reporter followed by a per-project pass/fail
   summary table. Open the HTML report for the step-by-step narrative of every test:

   ```bash
   npm run report
   ```

   Failed tests carry a trace, video, screenshot, console errors and the structured test log
   as attachments in the report (`npx playwright show-trace <trace.zip>` opens a trace directly).
   Machine-readable results are written to `test-results/junit.xml` and
   `test-results/results.json`.

Expected outcome: every test in the `setup`, `chromium`, `firefox` and `webkit` columns of the
summary table passes. The full demo run takes several minutes; WebKit is the slowest engine. The
demos can also be executed without a local Node installation:

- **Docker**: `docker compose run --rm tests npm run test:demo` (see [Docker](#docker)).
- **GitHub Actions**: Actions tab -> **Manual Test Run** -> _Run workflow_, choose the
  `all-browsers` project and clear the `tags` input. This runs the whole desktop suite, which
  includes both demos (see [GitHub Actions](#github-actions)). `TEST_USERNAME` /
  `TEST_PASSWORD` must exist as repository secrets.
- **Jenkins**: _Build with Parameters_ on the pipeline job (see [Jenkins](#jenkins)).

### What the demo scripts cover

#### 1. Logging in with valid credentials - `tests/ui/authentication/login.spec.ts`

- **Valid credentials** (parameterised): freshly registered user, 30-character username,
  30-character password, password with special characters. Each user is created through the API
  precondition, logged in through the UI, and verified by header state, closed modal and the
  persisted session cookie.
- **Session behaviour**: stays logged in after reload; logout clears the cookie; a session
  injected through the API is recognised by the UI.
- **Invalid credentials** (parameterised): wrong password, unknown user, empty username/password,
  both empty, case-sensitivity. Alert text and anonymous header state are asserted.
- **Edge cases**: dismissing the modal without submitting; API error surfaced from a mocked
  `/login` response; username with surrounding spaces.
- `tests/ui/authentication/session.spec.ts` shows the **storage-state** pattern (pre-authenticated
  browser context produced by the `setup` project).

#### 2. Add product(s) to cart, then place an order - `tests/e2e/place-order.spec.ts` (+ `tests/ui/checkout/cart.spec.ts`)

- **Successful purchases** (parameterised): all fields, mandatory fields only, name with special
  characters, multiple products across categories. Products are added through the real UI
  journey (category -> product page -> "Add to cart" alert + `/addtocart` response), the cart is
  verified line by line and by total, then the confirmation dialog is parsed and checked (id,
  amount, card, name, date) and the cart is confirmed empty afterwards.
- **Validation**: missing name and card, missing name, missing card -> alert text, modal stays
  open, cart untouched.
- **Edge cases**: total recomputed after removing a line before checkout; closing the order form
  keeps the cart; purchasing as a logged-in shopper (different alert text, authenticated cart).
- Cart suite: correct items/totals for single, multi-category and duplicate products; request
  payload verification via `NetworkRecorder`; empty cart for new visitors; deletion; persistence
  across reloads; emptying the cart line by line.

---

## Reporting and diagnostics

- Reporters: `list` (console), `html` (`playwright-report/`), `junit` (`test-results/junit.xml`),
  `json` (`test-results/results.json`), `SummaryReporter` (`src/reporting`: per-project pass/fail
  table printed to the console, saved as `test-results/summary.md` and appended to the GitHub
  Actions job summary); in CI also `blob` (`blob-report/`) for merging shards.
- On failure: trace (`npx playwright show-trace`), video, screenshot, browser console errors,
  the complete structured log of the test (its own lines plus every API call, precondition,
  mocked route and navigation retry the framework performed for it) and, when the
  `networkRecorder` fixture is used, the XHR log are attached to the test in the HTML report.
  Successful tests keep no artifacts.
- `ScreenshotUtils` produces named, timestamped evidence screenshots on demand.
- `LOG_FORMAT=json` switches the logger to JSON lines for log aggregation in CI.

---

## Code quality

- **TypeScript strict** plus `noUncheckedIndexedAccess`, `noImplicitOverride`, unused checks.
- **ESLint** (`.eslintrc.js`): type-aware `typescript-eslint` rules, `no-explicit-any` and
  `no-floating-promises` as errors, `eslint-plugin-playwright` for specs, Prettier integration.
- **Prettier** (`.prettierrc`) formats TS, JS, JSON, Markdown and YAML.
- **Husky + lint-staged**: `pre-commit` runs ESLint/Prettier on staged files and a type check;
  `commit-msg` enforces Conventional Commits. Hooks install automatically via `npm ci` once the
  folder is a git repository (`git init && npm run prepare`).
  > **Temporarily disabled:** the Conventional Commits title check is commented out in
  > `.husky/commit-msg` (`pre-commit` still runs lint-staged + typecheck as normal). To re-enable,
  > uncomment the `node scripts/verify-commit-msg.js "$1"` line in that file.
- `npm run validate` = typecheck + lint + format check; CI runs it as the quality gate.
- `npm run test:framework` runs the framework's own regression tests (`tests/framework`): the
  dialog helper's timing contract, retry/backoff semantics, environment schema validation and the
  data utilities that assertions depend on (Luhn card numbers, price parsing, catalog totals).
  CI runs them next to the API project.

---

## CI/CD

### Jenkins

The root `Jenkinsfile` is a parameterised declarative pipeline:

1. **Parameters**: `TEST_ENV`, `BROWSERS` (all/chromium/firefox/webkit), `RUN_API_TESTS`,
   `TAGS`, `EXCLUDE_TAGS` (default `@wip|@flaky`), `SHARDS`, `WORKERS`.
2. **Install**: `npm ci`, `npx playwright install --with-deps`.
3. **Quality gate** (parallel): typecheck, lint, format check.
4. **Test**: credentials are injected with `withCredentials` from the credential id
   `demoblaze-test-user` (username -> `TEST_USERNAME`, password -> `TEST_PASSWORD`). With
   `SHARDS > 1` the UI suites fan out to that many agents (`--shard=i/N`), each shard stashes its
   blob report and the pipeline merges them with `npm run report:merge`.
5. **Post**: JUnit results, HTML Publisher report, archived traces/videos for failures.

Jenkins prerequisites: NodeJS plugin (tool named `NodeJS`), JUnit, HTML Publisher and Credentials
Binding plugins. Cross-platform agents are supported (`sh` on Unix, `bat` on Windows).

To run it: create a Pipeline job pointing at this repository (`Jenkinsfile` at the root), add the
`demoblaze-test-user` credential, then "Build with Parameters".

### GitHub Actions

> **Temporarily disabled:** the `push`, `pull_request` and nightly `schedule` triggers in
> `.github/workflows/playwright.yml` are commented out, so this pipeline currently only runs via
> manual **"Run workflow"** (`workflow_dispatch`). To re-enable, uncomment the `push:`,
> `pull_request:` and `schedule:` blocks under `on:` in that file. `manual-tests.yml` is unaffected
> (it only ever ran on-demand).

- `playwright.yml`: quality gate job, browser-less API + framework self-test job, UI matrix
  sharded 3 ways across Chromium/Firefox/WebKit inside the official Playwright container, and a
  job that merges the blob reports into a single HTML report artifact. Runs on push, pull request,
  nightly (`schedule`) and on demand. Each job appends the run summary table to the job summary.
  Secrets: `TEST_USERNAME`, `TEST_PASSWORD`.
- `manual-tests.yml`: on-demand run with environment, project (desktop, mobile, api, framework)
  and tag inputs.
- `pull_request_template.md`: definition-of-done checklist from `docs/TEST_STRATEGY.md`.

### GitLab CI

`.gitlab-ci.yml` mirrors the GitHub pipeline with GitLab primitives: `quality` stage
(`npm run validate`), `test` stage with the `api` + `framework` job and a `parallel: 3` UI job
(`--shard=$CI_NODE_INDEX/$CI_NODE_TOTAL`), and a `report` stage that merges the shard blobs into
one HTML report. JUnit results are published through `artifacts.reports.junit`; `npm` is cached per
`package-lock.json`. Provide `TEST_USERNAME` / `TEST_PASSWORD` as masked CI/CD variables.

### Docker

```bash
docker compose run --rm tests                                    # full run
TEST_TAGS=@smoke docker compose run --rm tests                   # tag filter
docker compose run --rm tests npx playwright test --project=api  # any CLI
```

The image is based on `mcr.microsoft.com/playwright:v1.61.1-jammy`; keep the tag aligned with
the `@playwright/test` version. Reports are written to the mounted `playwright-report/` folder.

---

## Scaling the framework for large projects

| Need                                     | How                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hundreds of specs across teams           | One feature folder per team under `tests/ui/<feature>`; tags per feature; `CODEOWNERS` per folder.                                                                 |
| New pages / components / workflows       | Extend `BasePage` / `BaseComponent`; register in `src/fixtures/page.fixtures.ts`; keep locators private to the page object.                                        |
| New APIs                                 | Add a client extending `BaseApiClient`, a Zod schema and DTOs; expose through `api.fixtures.ts`; prefer preconditions over UI setup.                               |
| New fixture concerns (db, feature flags) | New `src/fixtures/<group>.fixtures.ts`, add to `mergeTests` in `src/fixtures/index.ts`.                                                                            |
| More environments                        | Add `environments/.env.<name>` and extend the `TEST_ENV` enum in `env.schema.ts`.                                                                                  |
| Faster CI                                | Increase `SHARDS` (Jenkins) or the matrix (GitHub); `WORKERS` per shard; run `@smoke` on PRs and `@regression` nightly.                                            |
| Test data at scale                       | Builders for intent, Faker factories for realistic defaults, static catalog pinned by an API drift test; `UserFactory.seed()` for repro.                           |
| Database verification                    | `DbConnectionFactory.withConnection()` with the adapter for your engine; queries live in `src/db/repositories`.                                                    |
| Visual / a11y / mobile / contract        | Mobile: `tests/mobile` on the `mobile-*` projects, `HeaderComponent.expandMenu()` for the collapsed nav. Visual, a11y and contract: reserved folders with READMEs. |
| Load testing                             | `performance/k6` and `performance/artillery` scaffolds sharing the same environment variables.                                                                     |
| Flaky tests                              | Quarantine with `@flaky` (excluded in CI by default), fix root cause in the framework layer, never add sleeps.                                                     |
| Framework changes                        | Cover them in `tests/framework`; the suite runs in every pipeline next to the API project.                                                                         |

See [`docs/TEST_STRATEGY.md`](docs/TEST_STRATEGY.md) and [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
for the operating model and conventions.

---

## Troubleshooting

| Symptom                                                                                                         | Fix                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Invalid environment configuration` at startup                                                                  | Read the listed variables; check `.env` and `environments/.env.<TEST_ENV>`.                                                                                                                                                                    |
| Setup project skipped / `sharedUser` tests fail                                                                 | Set `TEST_USERNAME` and `TEST_PASSWORD` (locally in `.env`, in CI as secrets).                                                                                                                                                                 |
| Storage-state tests reported as skipped                                                                         | The `setup` project did not produce `.auth/user.json`; check its result in the report (credentials, API down).                                                                                                                                 |
| Browsers missing                                                                                                | `npx playwright install` (or `--with-deps` on Linux CI).                                                                                                                                                                                       |
| `EPERM ... rmdir test-results` on Windows                                                                       | A sync client (e.g. Google Drive) or an open report locks the folder; run `npm run clean` or close the lock.                                                                                                                                   |
| `worker-N process did not exit ... force-killed`                                                                | Cloud-sync file locks stall artifact cleanup. Set `OUTPUT_DIR` to a non-synced local path (see `.env.example`).                                                                                                                                |
| Husky hooks not running                                                                                         | The folder must be a git repository: `git init && npm run prepare`.                                                                                                                                                                            |
| Need to see what a failing test did                                                                             | `npm run report`, open the test, click the trace; or `npx playwright show-trace <path-to-trace.zip>`.                                                                                                                                          |
| Demoblaze API slow or flaky                                                                                     | Retries are configured (`CI_RETRIES=2`); API clients retry 5xx automatically; check `LOG_LEVEL=debug`.                                                                                                                                         |
| WebKit: `Page crashed`, or a dead page after a second navigation (empty header, product details never rendered) | The site's video.js HLS player crashed WebKit's renderer on Linux when torn down; the framework serves an inert player (`BLOCK_MEDIA=true`, `src/api/mocks/media-player-stub.ts`). Look for a `[crash]` line in the console-errors attachment. |
