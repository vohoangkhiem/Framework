# Contributing

## Workflow

1. Create a branch: `feature/<ticket>-short-description` or `fix/<ticket>-short-description`.
2. Install: `npm ci && npx playwright install` (hooks are installed automatically by `prepare`
   once the project is a git repository).
3. Develop with `npm run test:ui-mode` or `npm run test:headed -- tests/ui/<feature>`.
4. Before pushing: `npm run validate` (typecheck + lint + format) and `npm run test:browsers`.
5. Open a pull request using the checklist below.

## Commit messages

Conventional Commits, enforced by the `commit-msg` hook:

```
feat(cart): seed carts through the API before UI checks
fix(login): tolerate "Product added." alert for logged-in users
docs(readme): describe Jenkins sharding
```

## Naming conventions

| Artefact      | Convention                                                       | Example                                   |
| ------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| Page object   | `<name>.page.ts`, class `<Name>Page`                             | `cart.page.ts` / `CartPage`               |
| Component     | `<name>.component.ts`, class `<Name>Component`                   | `modal.component.ts`                      |
| Workflow      | `<name>.workflow.ts`, class `<Name>Workflow`                     | `cart.workflow.ts`                        |
| API client    | `<name>-api.client.ts`, class `<Name>ApiClient`                  | `auth-api.client.ts`                      |
| Fixture group | `<group>.fixtures.ts`, export `<group>Test`                      | `api.fixtures.ts` / `apiTest`             |
| Test data     | `<name>.builder.ts`, `<name>.factory.ts`, `<name>.test-cases.ts` |                                           |
| Spec          | `<feature>.spec.ts` under `tests/<type>/<area>/`                 | `tests/ui/checkout/cart.spec.ts`          |
| Test title    | Behaviour in third person, no "should"                           | `removes a product and updates the total` |

## Coding rules

- TypeScript strict mode; `any` is forbidden (`unknown` + narrowing instead).
- Every async call is awaited (`no-floating-promises` is an error).
- Locators belong to page objects/components; specs only call methods.
- Prefer web-first assertions (`await expect(locator).toBeVisible()`) over `isVisible()` checks.
- Never `waitForTimeout`; never `networkidle`. Use assertions or `WaitUtils.forApiResponse`.
- Comments explain _why_ (architecture, workaround for an application quirk), not _what_.
- Decorate page-object actions with `@step()` so reports and traces read like a narrative.

## Pull request checklist

- [ ] New behaviour covered by happy path, negative path and edge cases where relevant
- [ ] Tags applied (`suite` + `layer` + `feature`)
- [ ] Runs green on Chromium, Firefox and WebKit
- [ ] No new `any`, no skipped tests without a linked ticket
- [ ] README / docs updated when structure or conventions change
