# Pilot 2 pages — acceptance v1.5.1

Status date: 2026-09-10. This is an in-progress acceptance record, not a claim that the pilot is complete. Runtime: Node `v22.22.2`; npm `10.9.7`.

| Criterion                              | Hosting | Cloud Server | Evidence / reason                                                                                    |
| -------------------------------------- | ------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| C01 mapping                            | DONE    | DONE         | `config/pages/*.yaml`                                                                                |
| C02 YAML/registry                      | DONE    | DONE         | `loadPageRegistry`; config spec                                                                      |
| C03 Template reference                 | DONE    | DONE         | Hosting run `7ae3c78c-7c06-458b-b7b3-aa148bfd6930`; Cloud run `c1510000-0000-4000-8000-000000000001` |
| C04 Production + OTE targets           | DONE    | PARTIAL      | Hosting both targets captured; Cloud OTE is outstanding                                              |
| C05 global rules/evidence              | DONE    | PARTIAL      | Hosting target evidence; Cloud Production only                                                       |
| C06 page-type rule                     | DONE    | PARTIAL      | Hosting target evidence; Cloud OTE required                                                          |
| C07 Template comparisons               | DONE    | PENDING      | Hosting comparison evidence exists; Cloud requires OTE                                               |
| C08 OTE–Production comparison          | DONE    | PENDING      | Hosting comparison evidence exists; Cloud requires OTE                                               |
| C09 evidence traceability              | PARTIAL | PENDING      | Existing Hosting scan and screenshot path below                                                      |
| C10 full Playwright suite              | DONE    | DONE         | `npm test -- --workers=1`: 7 spec files, 24 passed, 0 failed/skipped, 2.1s                           |
| C11 format/lint/typecheck/build guard  | DONE    | DONE         | All pass; build run twice                                                                            |
| C12 Production zero completed non-read | DONE    | DONE         | Both Production scans: 0; each blocked 15 writes before send                                         |
| C13 false-positive classification      | PENDING | PENDING      | Live issues require complete run and owner classification                                            |
| C14 independent + batch                | PARTIAL | PARTIAL      | Both pages have partial independent runs; batch outstanding                                          |
| C15 review package consistency         | PARTIAL | PARTIAL      | This package accurately records incomplete scope                                                     |

Neither page meets `FULL`; both retain `NO_VERDICT`. The current blocker is Q18 in `docs/open-items.md`.
