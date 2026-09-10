# Pilot 2 pages — review package v1.4

Status at 2026-09-10: `automation_status: BLOCKED`; `quality_verdict: NO_VERDICT` for both pages. This is an honest incomplete package, not an acceptance claim.

The workspace is not a Git worktree. Runtime used: Node `v22.22.2`, npm `10.9.7`; the required Node 24 gate was therefore not met. Format, lint, typecheck, build and Playwright passed. Playwright: 6 spec files, 21 tests passed, 0 failed/skipped, workers 1. Audit found no Vitest, `it(...)`, `*.test.ts`, `dist/src`, `dist/tests`, or built spec/test files.

Implemented source changes: `src/domain/models.ts`, `src/normalization/model.ts`, `src/normalization/link-policy.ts`, `src/normalization/comparator.ts`, `src/scanner/collector.ts`, `src/rules/tier1/global.ts`, `src/cli/index.ts`, `tests/unit/link-policy.spec.ts`, and `tests/unit/rules.spec.ts`.

The generic link policy retains raw/resolved/canonical URLs and every HEAD/GET attempt, skips unsafe routes without a request, preserves query/fragment, and records `PASS_GET_FALLBACK` and `PASS_CANONICALIZED` independently. It is shared by OTE and Production; comparator keys normalize trailing slashes.

Available v1.4 evidence: Hosting reference/Production/OTE run `98c75893-4639-4495-8b5d-e654219b55e5`; Cloud Server reference/Production run `2bb5ffb6-2736-4d83-8af8-b6e05deb6822`. Hosting Production: 117 links (109 raw pass, 3 fail, 2 unsafe); OTE: 121 links (110 raw pass, 6 fail, 2 unsafe) and 2 page errors. Production completed non-read requests: 0 in both available Production scans.

Cloud Server OTE, per-page comparison evidence, and the required two-page batch have not completed. These, plus Node 24, are pilot blockers; no page is marked FULL. PostgreSQL, CI, scheduler and Telegram remain Phase 2.
