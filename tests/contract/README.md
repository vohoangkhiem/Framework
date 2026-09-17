# Contract tests

Reserved for API contract verification.

- Zod schemas describing responses live in `src/api/schemas`; the custom matcher
  `expect(payload).toMatchSchema(schema)` validates any payload against them.
- For provider/consumer contracts (Pact, OpenAPI diffing), place the generated contracts and the
  verification specs here and run them in the `api` project (no browser required).
