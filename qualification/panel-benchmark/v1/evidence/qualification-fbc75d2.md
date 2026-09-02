# `@wsr/bi` Wave 1 qualification — `fbc75d2`

> Superseded before publication: the human publication checkpoint selected the
> unscoped coordinate `wsr-ui-core`. This result remains as the pre-decision
> optimization history and was never published.

## Candidate identity

- Provider commit: `fbc75d29a863056f61ef69ca8ed76bd93e75aa69`
- Package coordinate: `@wsr/bi@0.1.0-rc.0`
- `npm pack` integrity: `sha512-VWeajaa2UQfNNoj48OvVQ9kzIkcYP0UFZ+JdDii3/RjaRVYewninjfu6VxNnCGrOa9+73wDkV+ZhMNYcoSWPag==`
- `npm pack` shasum: `2f3ef8ff8add0af1b19903be2d447ba89e974547`
- Aggregate `dist/` integrity: `sha512-MKLE46NytCMYwsYNX0+p6lvRBRANDNT6gAOI8eoVLS0uQsB5MEWBwFxBCVRhR+j2k0pOZb0eGzlpVvFPvdfwkg==`
- Benchmark contract: `panel-benchmark@1`
- Manifest SHA-256: `81cbab4305a0a25dadd51b6585b923e329be7c6f2d60b9bc934293490d2262ff`
- Runner image: `sha256:3754cf6f4af84fefd27365f6d8af172982478247f7af0e78456282407a702315`
- Result SHA-256: `6b46cc40c023c6dcd3da99696c14fdd46878e98812d0df8fb2478dc28f8dbaae`

The raw result and browser traces are retained locally at
`qualification/panel-benchmark/v1/results/full-2026-09-01T01-02-24-184Z/`.
They are intentionally excluded from the package and repository inventory.

## Fixed benchmark result

Every fixture completed one warm-up and 30 samples in each of three independent
runs. The first-paint budget was 100 ms p95, the interactive-frame budget was
16.7 ms p95 where applicable, and the long-task budget was zero.

| Panel / fixture                        | First paint p95, runs 1–3 (ms) | Frame p95, runs 1–3 (ms) | Long tasks | Result |
| -------------------------------------- | ------------------------------ | ------------------------ | ---------- | ------ |
| `metric-ratio-bar@1` / typical         | 47.635, 46.255, 47.790         | n/a                      | 0, 0, 0    | PASS   |
| `metric-ratio-bar@1` / upper-bound     | 47.250, 46.870, 45.495         | n/a                      | 0, 0, 0    | PASS   |
| `recorded-trace-graph@1` / typical     | 48.125, 46.720, 43.930         | 16.670, 16.670, 16.670   | 0, 0, 0    | PASS   |
| `recorded-trace-graph@1` / upper-bound | 53.190, 55.425, 55.275         | 16.670, 16.670, 16.670   | 0, 0, 0    | PASS   |
| `unavailable@1` / semantic             | 46.100, 46.500, 45.640         | n/a                      | 0, 0, 0    | PASS   |

All 15 independent runs passed. The versioned inventory contains the product
chart types that actually exist: ratio/compare, recorded trace graph, and the
UNAVAILABLE semantic state. It does not invent dense time-series or
matrix/heatmap panels.

## Raw browser trace SHA-256

| Trace                                          | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `metric-ratio-bar@1.typical.run-1.zip`         | `b9bfbdc7dc5e169d57a915e88667488c53c92d4b6067fe4ae486f80e74256c65` |
| `metric-ratio-bar@1.typical.run-2.zip`         | `ac51c3c25988c21a88c60cf8b00806a0a603151632ba4b7ec12faf7a6e21e313` |
| `metric-ratio-bar@1.typical.run-3.zip`         | `6d850a032600859c1354f57b43048c43dd82a2bba0303d9cb50b93e49760a173` |
| `metric-ratio-bar@1.upper-bound.run-1.zip`     | `3e89715579efe0e4191b1ba164f2d09a2646cb21cae459adf7f15665d3e7f267` |
| `metric-ratio-bar@1.upper-bound.run-2.zip`     | `7b74dd65a0a5720eb9d2bbf63c4e837fc53e726fd0de0cd0e4815d5ce8571121` |
| `metric-ratio-bar@1.upper-bound.run-3.zip`     | `94ffc9e537c2c462db707106e76af3b9393c9d3f3d8492114570889eb4844b0a` |
| `recorded-trace-graph@1.typical.run-1.zip`     | `6c1d588edf382f1204726775212c3b5446e28f74ee56d2f660ff47b5f59b26bb` |
| `recorded-trace-graph@1.typical.run-2.zip`     | `9abb74bebc192254b8d3b8e18c611453c73ecfce8a37a86952c8880bcef9badc` |
| `recorded-trace-graph@1.typical.run-3.zip`     | `4e865487c02abb4bf0dbc6e41dcb6c094b6f4929a69b9653deba9052d15f47c2` |
| `recorded-trace-graph@1.upper-bound.run-1.zip` | `3867f18f3c9885fe5e58551424e16e2be307ad5e9e65e95481e888ab6c45131a` |
| `recorded-trace-graph@1.upper-bound.run-2.zip` | `b32b13a54c6d515b863b7225336ac00e389318da6ca19f24bd08b032af1dede3` |
| `recorded-trace-graph@1.upper-bound.run-3.zip` | `d93f50d7220ec31e9839f5eb9af1c09b4c998da12354944e1f5cde6d0d3b15c9` |
| `unavailable@1.semantic.run-1.zip`             | `00c40990525c43747a74c724e486f6d6012e7c9c914b92802e5f40205694be9c` |
| `unavailable@1.semantic.run-2.zip`             | `87e3f9fddcae6db666c9feb04e835f5aa628b2a0de099356bfd640b0bdb2b2ed` |
| `unavailable@1.semantic.run-3.zip`             | `381b8eea6c57c979732933148f8a62e8ad1b2a7d09f7b5bd76ecaddf080e8518` |

## Renderer decision

The production implementations remain SVG. No panel met the plan's Canvas
trigger because all three qualifying SVG runs passed every applicable budget.
There is therefore no runtime renderer selector and no Canvas approval path to
exercise for this candidate.

## Clean consumer and repository gates

A detached clean worktree at the provider commit passed:

- `npm ci --ignore-scripts`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm test` (28 files, 214 tests)
- `npm run deps:check`
- `npm run build`
- `npm run package:verify`
- `npm run react18:verify`
- `npm run browser` (15 tests)

The React 18 check consumed only the packed artifact in a clean external
consumer and rendered both an AVAILABLE ratio SVG and an UNAVAILABLE semantic
state. Publication through normal package resolution remains a separate,
human-authorized checkpoint.
