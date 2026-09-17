# ADR-0004: Reporting and diagnostics defaults

**Status:** Accepted — 2026-09-15

## Context

Debugging failures from CI logs alone is slow. Playwright offers traces, videos and screenshots,
but their cost (disk, time) means defaults have to be deliberate.

## Decision

- Defaults: `trace: retain-on-failure`, `video: retain-on-failure`, `screenshot: only-on-failure`,
  `preserveOutput: failures-only`. All overridable through `TRACE_MODE`, `VIDEO_MODE`,
  `SCREENSHOT_MODE`.
- Reporters: `list` + `html` + `junit` + `json` + the custom `SummaryReporter` (per-project table
  on the console, `test-results/summary.md`, GitHub job summary) everywhere; `blob` added in CI so
  shards can be merged with `scripts/merge-reports.js` (`npx playwright merge-reports`).
- Every page-object action is a named `test.step` via the `@step` decorator, which structures the
  HTML report and the trace viewer timeline.
- On failure the fixtures attach: the complete structured log of the test, browser console errors,
  and (when the `networkRecorder` fixture is used) the XHR log. The test logger is a child of the
  process-wide framework logger, so the attachment includes every API call, precondition, mocked
  route and navigation retry performed for the test; the `auto` logger fixture clears the shared
  store on teardown (a worker runs one test at a time).

## Consequences

- Successful runs stay lean; failed tests carry everything needed for offline analysis.
- Sharded CI runs produce a single report without extra infrastructure.
