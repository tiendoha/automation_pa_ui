# Daily Run Acceptance v1.6

Automated framework acceptance covers daily-ID timezone handling, state transitions, atomic manifest recovery, process-resume checkpointing, duplicate-run lock, terminal publication gate, and corrupt-current-manifest fallback.

Live acceptance for Hosting and Cloud Server remains pending execution on a persistent browser-capable runner. It must be run with one scheduled `npm run monitor:daily -- --pages hosting,cloud-server` invocation, including an intentional browser disconnect and process restart after a checkpoint. Do not mark this item FULL until the resulting evidence manifest, final report, metrics, and link details are reviewed.

An attempted read-only run on 2026-09-10 produced `daily-20260910-desktop` and a terminal `COMPLETED_WITH_INCONCLUSIVE` report, but Chromium was prevented from launching by the current container's sandbox (`sandbox_host_linux.cc: shutdown: Operation not permitted`). The runner correctly did not leave pending work and published [the final report](/home/user/automation_pa_ui/evidence/daily-20260910-desktop/report.final.md), but this is an environment-failure report—not live acceptance. Its [manifest](/home/user/automation_pa_ui/evidence/daily-20260910-desktop/manifest.json) records every failed browser-stage attempt.
