# Open items

Environment check for v1.5.1: Node `v22.22.2` and npm `10.9.7` are the accepted runtime and package manager. No local PostgreSQL connection was configured; it is PHASE_2.

- Q01: rule precedence/override behavior.
- Q03: real pilot seed URLs.
- Q04: final global thresholds, ignore lists, redirect/resource patterns.
- Q05: FLAKY and RECOVERED lifecycle semantics.
- Q06: production action/API allowlist confirmation.
- Q07: RESOLVED for this workspace: Node 22.22.2 is the approved pilot runtime. CI must select Node major 22.
- Q08: CI approval.
- Q09: scheduler.
- Q10: authoritative rule-config source.
- Q11: Telegram recipients and credentials.
- Q12: deployment server capability.
- Q13: RESOLVED for pilot by explicit approval. Hosting and Cloud Server Production each made 15 script-initiated POST attempts; context guard aborted all before send and each run recorded zero completed non-GET/HEAD requests.
- Q14: approve selectors and expected state for desktop mega menu, footer, sticky header; approve critical resource/console patterns and critical-link GET/HEAD allowlist.
- Q15: RESOLVED for pilot by explicit approval. Internal links compare path, query and fragment across the three configured origins; external links compare full URL.
- Q16: RESOLVED. Hosting rerun `4714af12-738a-4320-bf73-d4557420b2f5` has distinct screenshots under template/ote/production evidence paths.
- Q17: `HISTORICAL_OUT_OF_SCOPE`. Template defects from pre-v1.4 are not target defects.
- Q18: `PILOT_BLOCKER`. Hosting v1.5.1 has Template, Production, OTE, and comparison evidence. Cloud Server has new Template and Production evidence, but Cloud Server OTE, its comparison, and the workers-1 batch need a persistent browser-capable runner: this runner ends the OTE collector before it writes evidence.
- Q19: RESOLVED. Node 22.22.2 is accepted; Node 24 is not a pilot blocker.
- Q20: `PILOT_BLOCKER`. v1.6 live daily acceptance (including intentional browser and process recovery) must run on the persistent scheduled runner; no interactive-session result is treated as acceptance.
- PostgreSQL, CI, scheduler and Telegram are `PHASE_2`, not pilot blockers.
