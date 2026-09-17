# Visual regression tests

Reserved for screenshot-comparison suites (`expect(page).toHaveScreenshot()`).

- Baselines are stored under `tests/__snapshots__/<spec>/<project>/` (see `snapshotPathTemplate`
  in `playwright.config.ts`); commit them per browser project.
- Mask dynamic regions (`mask: [locator]`) and disable animations to keep diffs meaningful.
- Run `npx playwright test tests/visual --update-snapshots` to (re)generate baselines, ideally in
  the same Docker image used by CI so fonts and rendering match.

Tag suites with `@visual` and register the tag in `src/config/test-tags.ts`.
