# Mobile (device emulation) tests

Specs placed here run in the `mobile-chrome` (Pixel 7) and `mobile-safari` (iPhone 14) projects
defined in `playwright.config.ts`; they are excluded from the desktop projects.

`mobile-shopping.spec.ts` covers the phone-viewport shopping journey (category, product, add to
cart, cart review) and the collapsed navigation. The page objects are viewport-agnostic; the one
responsive difference on Demoblaze, the hamburger menu, is handled by
`HeaderComponent.expandMenu()`, which is a no-op on desktop.

When a responsive layout differs materially beyond that, add mobile-specific components under
`src/pages/components/mobile/` rather than branching inside existing components.

Run with: `npm run test:mobile` (or `npx playwright test --project=mobile-chrome --project=mobile-safari`).
