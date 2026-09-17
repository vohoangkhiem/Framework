# Spec template

Copy into `tests/<type>/<area>/<feature>.spec.ts` and replace the placeholders.

```ts
import { TAGS, tags } from '@config/test-tags';
import { expect, test } from '@fixtures';

test.describe('<Feature>', tags(TAGS.ui, TAGS.<feature>), () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.goto();
  });

  test.describe('<capability>', tags(TAGS.smoke, TAGS.regression), () => {
    test('<does something observable>', async ({ /* fixtures */ }) => {
      // Arrange: establish state through API preconditions or builders
      // Act:     call page-object / workflow methods
      // Assert:  page-object expectXxx() + data expectations
    });
  });

  test.describe('negative paths', tags(TAGS.negative, TAGS.regression), () => {
    test('<rejects invalid input with a clear message>', async ({ /* fixtures */ }) => {
      // ...
    });
  });

  test.describe('edge cases', tags(TAGS.edgeCase, TAGS.regression), () => {
    test('<handles boundary condition>', async ({ /* fixtures */ }) => {
      // ...
    });
  });
});
```

Checklist: no raw selectors, no sleeps, every promise awaited, tags applied, runs on all browsers.
