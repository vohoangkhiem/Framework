# Performance testing

Functional suites collect lightweight timing signals (`tests/performance`). Real load, stress and
soak testing belongs to dedicated tools that live here, outside the Playwright runner:

```
performance/
├── k6/         # https://k6.io   - JS scripts, thresholds, cloud/CLI execution
└── artillery/  # https://artillery.io - YAML scenarios, plugins, reports
```

## k6

```bash
# install: https://grafana.com/docs/k6/latest/set-up/install-k6/
k6 run performance/k6/api-smoke.js
k6 run -e API_BASE_URL=https://api.demoblaze.com -e VUS=20 -e DURATION=2m performance/k6/api-smoke.js
```

## Artillery

```bash
npx artillery run performance/artillery/api-smoke.yml
npx artillery run --output report.json performance/artillery/api-smoke.yml && npx artillery report report.json
```

## Conventions

- Reuse the same environment variables as the functional framework (`API_BASE_URL`, `BASE_URL`).
- Express SLAs as tool thresholds so that a CI job fails on regression, mirroring
  `PerformanceUtils.assertWithinSla` in the functional suites.
- Keep scripts small and scenario-focused: `api-smoke`, `checkout-load`, `catalog-soak`, ...
- Wire them into CI as a separate, scheduled stage; they must not run on every pull request.
