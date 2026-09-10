# Pilot 2 pages — review package v1.5.1

## Honest status

This handoff does **not** claim full live-scan completion. Hosting has completed its independent Template/Production/OTE/comparison stages and is `PARTIAL` / `FAIL` only because the required batch remains outstanding. Cloud Server is `PARTIAL` / `NO_VERDICT`: Template and Production are captured, but OTE cannot finish in this runner. Q18 records the remaining work.

Runtime: Node `v22.22.2`; npm `10.9.7`. Package manager and runtime match the accepted v1.5.1 Node-22 contract.

## Build-contract audit

Build entries are `package.json` `clean:dist` (`node --import tsx src/build/clean-dist.ts`), `build` (`npm run clean:dist && tsc -p tsconfig.build.json && npm run assert:dist`), and `assert:dist` (`node --import tsx src/build/output-guard.ts`). Typecheck is `tsc -p tsconfig.json --noEmit`; no `prebuild` or `postbuild` script exists. Repository search found no other TypeScript compiler, bundler, copy, CI, or Docker entry point.

`tsconfig.json` has `noEmit: true` and includes source, tests, and Playwright config. `tsconfig.build.json` emits only `src/**/*.ts` with `rootDir: ./src` and `outDir: ./dist`. `src/build/clean-dist.ts` removes only the resolved repository `dist`; `src/build/output-guard.ts` rejects `dist/src`, `dist/tests`, `.ts`, `.spec.js`, and `.test.js` artifacts. Its Playwright spec proves a malformed fixture fails and a cleaned valid fixture passes.

`npm run build` ran twice consecutively, each passing the guard. The resulting tree (three levels) is:

```text
dist/
  build/{clean-dist.js,output-guard.js}
  cli/index.js
  config/{loaders.js,schema.js}
  domain/{contracts.js,models.js}
  evidence/file-store.js
  fingerprint/fingerprint.js
  logging/logger.js
  normalization/{comparator.js,link-policy.js,model.js}
  notification/telegram.js
  persistence/postgres.js
  rules/{engine,tier1,tier2,tier3}/
  scanner/{collector.js,retry.js}
```

There is no `dist/src`, `dist/tests`, TypeScript artifact, compiled spec, or compiled test.

## Source/config extension

`loadPageRegistry` loads all YAML page registrations; `config/pages/fixture-page.yaml` is a same-type service-category fixture. The new config test proves it loads together with Hosting and Cloud Server without framework changes or page-ID conditionals. The old JSON fixture remains outside the registry because page registrations are YAML.

## Automation suite

Actual command: `npm test -- --workers=1`.

| Spec files | Total | Passed | Failed | Skipped | Flaky/retried | Duration |
| ---------: | ----: | -----: | -----: | ------: | ------------: | -------: |
|          7 |    24 |     24 |      0 |       0 |             0 |     2.1s |

There were no failed tests to classify.

## New live evidence and issue detail

Run `7ae3c78c-7c06-458b-b7b3-aa148bfd6930` captured Hosting Template, Production, OTE, and comparison evidence. Cloud Server run `c1510000-0000-4000-8000-000000000001` captured Template and Production. Evidence remains under their run/page/environment directories.

Hosting Production: HTTP 200; 114 probe-eligible deduplicated links = 109 raw pass + 0 GET-fallback + 0 canonicalized + 3 fail + 2 unsafe-skipped. Three additional hash-only links are recorded as `FORMAT_ONLY` and do not perform a probe. Completed non-read requests: 0; 15 non-read requests were blocked before send. All three current final failures are listed individually in `pilot-2-pages-link-details-v1.5.csv`; each raw HEAD and GET returned status 0, so no canonical trailing-slash probe was eligible.

Hosting OTE has 6 final status-0 (no HTTP response) link failures and three `window.width is not a function` page errors. Status 0 is recorded as `ENVIRONMENT_ERROR`, never as HTTP 404; its retry result is `NOT_RETRIED` because the scanner makes the documented HEAD then GET attempts only. Cloud Server Production has 19 final failures (one true raw/canonical 404 and 18 status-0 no-response failures); Cloud Server OTE, comparison, and batch are still blocked by the runner.

## Files changed for v1.5.1

`AGENTS.md`, `package.json`, `package-lock.json`, `tsconfig.json`, `src/build/clean-dist.ts`, `src/build/output-guard.ts`, `src/config/loaders.ts`, `tests/unit/build-output-guard.spec.ts`, `tests/unit/config.spec.ts`, `config/pages/fixture-page.yaml`, `docs/open-items.md`, and the four v1.5 review files.
