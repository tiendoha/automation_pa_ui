# Daily Orchestrator Review v1.6

Implemented source modules are `src/orchestration/daily-runner.ts`, `state-machine.ts`, `task-queue.ts`, `browser-supervisor.ts`, and `run-lock.ts`, plus `src/reporting/daily-report.ts` and the atomic `RunManifestStore`.

Commands are `npm run monitor:daily`, `npm run monitor:status -- --run-id <id>`, and `npm run monitor:report -- --run-id <id>`. The daily command defaults to the `Asia/Ho_Chi_Minh` run identity, resumes a same-day manifest, skips terminal stages, and rejects a config/rule hash mismatch unless `--force-new` creates a revision.

The runner bounds browser work (90 seconds, three recovery attempts), persists checkpoints atomically, records an environment-inconclusive terminal outcome after exhaustion, and emits `report.final.md` and `metrics.csv` only after every stage is terminal. The lock is deliberately process-local evidence-volume locking; a production scheduler/supervisor must restart this command and keep the evidence volume persistent.

Framework tests do not invoke `monitor:daily` and do not navigate live sites. Live acceptance is intentionally not claimed by this review package.

Quality gate: `npm test -- --workers=1` (31 passed), `npm run format:check`, `npm run lint`, `npm run typecheck`, and `npm run build` all exited 0. The build output contains no `dist/src` or compiled specs.
