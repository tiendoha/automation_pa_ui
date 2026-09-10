# Automation P.A UI Risk Monitoring

Read-only, configuration-driven Playwright monitoring. It never clicks, submits, uploads, pays, or writes to monitored websites.

## Commands

```bash
npm install
npx playwright install chromium
npm run format:check && npm run lint && npm run typecheck && npm test
npm run migrate
npm run scan -- --page hosting
npm run scan -- --page hosting,cloud-server
npm run cleanup -- --days 30
```

`scan` accepts one or more page ids from `config/pages/*.yaml` and, by default, runs Template → OTE → Production sequentially. `--environment` narrows it to one environment. The router aborts every non-GET/non-HEAD request, blocks downloads, and no scanner code clicks or submits.

## Configuration

Rules and pages are YAML files validated at load time. Missing selectors, baselines, or expected values produce `CONFIG_MISSING`; proposed selectors and exception overrides produce `CONFIG_PENDING` and are never executed.

See `docs/open-items.md` for deliberately unresolved decisions.
