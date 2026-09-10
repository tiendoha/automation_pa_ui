# Source layout rules

`src/` is the only source of truth. New modules must be integrated into its existing structure; do not create a second source tree or framework.

- `tests/` contains tests, `config/` contains YAML configuration, `docs/` contains documentation, and `evidence/` contains run artifacts.
- `dist/` is disposable TypeScript build output. Never edit, import, or manually create files in `dist/` or `dist/src/`.
- When searching code, exclude `dist/`, `node_modules/`, and `evidence/`.
- `dist/` may be deleted and recreated only by `npm run build`.

## Build and page-extension contract

- Add a page of an existing page type with one `config/pages/<page-id>.yaml` file. Do not create page-specific source trees or hard-code page IDs in collectors/comparators.
- Never copy from `dist/` into `src/`, or edit files under `dist/`.
- Do not emit TypeScript with the base `tsconfig.json`. Use `npm run build`, which cleans only `dist/`, builds with `tsconfig.build.json`, and runs the output-layout guard.
- Before handoff, verify that `dist/src`, `dist/tests`, TypeScript files, and compiled spec/test files do not exist in `dist/`.
