## Summary

<!-- What changed and why. Link the ticket. -->

## Type of change

- [ ] New test coverage
- [ ] Framework change (fixtures, page objects, API clients, config)
- [ ] CI / tooling
- [ ] Documentation

## Checklist

- [ ] Happy path, at least one negative path and relevant edge cases are covered
- [ ] Tags applied: suite (`@smoke` / `@regression`) + layer + feature
- [ ] Specs use fixtures and page objects only (no raw selectors or waits in specs)
- [ ] Green on Chromium, Firefox and WebKit (`npm run test:browsers`)
- [ ] `npm run validate` passes (typecheck, lint, format)
- [ ] Framework self-tests pass when framework code changed (`npm run test:framework`)
- [ ] No new `any`, no skipped tests without a linked ticket
- [ ] README / docs / ADR updated when structure or conventions change
