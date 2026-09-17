# ADR-0002: Establish test state through the API, verify through the UI

**Status:** Accepted — 2026-09-15

## Context

Cart and order tests need registered users and populated carts. Creating that state through the
UI is slow (several page loads per product), duplicates coverage already provided by dedicated
tests, and multiplies the surface for flakiness.

## Decision

- `src/api/preconditions/` exposes idempotent operations (`ensureUserExists`,
  `authenticateContext`, `seedAnonymousCart`, `seedAuthenticatedCart`) built on typed API clients.
- Authentication injects the same `tokenp_` cookie the application sets, so the UI is genuinely
  logged in after the next navigation.
- Anonymous carts are keyed by the browser's `document.cookie`; the precondition sets a single
  known `user` cookie so the key is deterministic and the cart can be seeded before the first
  page load. Seeding waits for read-your-writes because the backend is eventually consistent.
- UI flows are exercised only in the tests whose subject they are (login form, add-to-cart
  journey), and there they are covered thoroughly.

## Consequences

- Cart-management and order-validation tests run in seconds and fail for one reason only.
- The framework depends on API knowledge that is documented in the clients; when the API
  changes, Zod schemas fail fast with a clear contract error.
