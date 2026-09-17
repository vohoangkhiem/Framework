# Accessibility tests

Reserved for automated accessibility audits.

Recommended setup:

```bash
npm i -D @axe-core/playwright
```

```ts
import AxeBuilder from '@axe-core/playwright';

test('home page has no critical accessibility violations', async ({ page, homePage }) => {
  await homePage.goto();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter(v => v.impact === 'critical')).toEqual([]);
});
```

Expose the builder through a fixture (`src/fixtures/a11y.fixtures.ts`) once adopted and tag suites
with `@a11y`.
