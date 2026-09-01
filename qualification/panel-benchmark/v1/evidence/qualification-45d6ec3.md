# `wsr-ui-core` Wave 1 publication qualification — `45d6ec3`

## Candidate identity

- Provider commit: `45d6ec33148fd81520db203ad047e8af220c3ad2`
- Package coordinate: `wsr-ui-core@0.1.0-rc.0`
- `npm pack` integrity: `sha512-jHK1jASNAw0WqNMrzgOK9KWZls/DiA7q8J2shE96/Gatb2mTw+lzG7UY+8rWuh1PWfyTFuvqnS3u/hVfyCrOBw==`
- `npm pack` shasum: `9cec13b79de92a207e2bcc21729516d742297739`
- Aggregate `dist/` integrity: `sha512-MKLE46NytCMYwsYNX0+p6lvRBRANDNT6gAOI8eoVLS0uQsB5MEWBwFxBCVRhR+j2k0pOZb0eGzlpVvFPvdfwkg==`
- Benchmark contract: `panel-benchmark@1`
- Manifest SHA-256: `81cbab4305a0a25dadd51b6585b923e329be7c6f2d60b9bc934293490d2262ff`
- Runner image: `sha256:0bc08664e9f66cabe1c13065919553225818ea52b828dea4d6fef5a1eddf53c7`
- Result SHA-256: `58e6b5be6a29cad2c9e3b93c2cc6a733cec0b4abb0d0525860744a014b2fef5a`

The publication checkpoint approved a prerelease and selected the unscoped
package name `wsr-ui-core` because the `wsr` npm organization is not controlled
by this project. Registry lookup returned 404 before publication.

The raw result and browser traces are retained locally at
`qualification/panel-benchmark/v1/results/full-2026-09-01T01-46-44-725Z/`.
An earlier interrupted `working-tree` run is retained as non-qualifying raw
history and is not referenced by this candidate.

## Fixed benchmark result

Each fixture completed one warm-up and 30 samples in each of three independent
runs. The first-paint budget was 100 ms p95, the interactive-frame budget was
16.7 ms p95 where applicable, and the long-task budget was zero.

| Panel / fixture                        | First paint p95, runs 1–3 (ms) | Frame p95, runs 1–3 (ms) | Long tasks | Result |
| -------------------------------------- | ------------------------------ | ------------------------ | ---------- | ------ |
| `metric-ratio-bar@1` / typical         | 47.550, 45.230, 45.150         | n/a                      | 0, 0, 0    | PASS   |
| `metric-ratio-bar@1` / upper-bound     | 47.850, 47.485, 47.190         | n/a                      | 0, 0, 0    | PASS   |
| `recorded-trace-graph@1` / typical     | 46.630, 44.805, 47.600         | 16.670, 16.670, 16.670   | 0, 0, 0    | PASS   |
| `recorded-trace-graph@1` / upper-bound | 51.250, 53.485, 53.105         | 16.670, 16.670, 16.670   | 0, 0, 0    | PASS   |
| `unavailable@1` / semantic             | 45.050, 42.940, 45.335         | n/a                      | 0, 0, 0    | PASS   |

All 15 independent runs passed. SVG remains the static production renderer;
the Canvas trigger did not fire and no runtime renderer selector exists.

## Raw browser trace SHA-256

| Trace                                          | SHA-256                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `metric-ratio-bar@1.typical.run-1.zip`         | `ff0aca21633e4547d835541331c0b36258c84badfe263272b726353ee18264c0` |
| `metric-ratio-bar@1.typical.run-2.zip`         | `70a2eca7c8bc52e6656c6eb44e7bcbc245fcb037a8a621fcd8df0ff6ebeff653` |
| `metric-ratio-bar@1.typical.run-3.zip`         | `52817184be7475c6551c4f0b8bac050be45184dfdeaf0feff0674863fa64dce9` |
| `metric-ratio-bar@1.upper-bound.run-1.zip`     | `3634b379fb61cda989152eb3c2fb2eae5999ec9b94456c315c45833b9730daf9` |
| `metric-ratio-bar@1.upper-bound.run-2.zip`     | `2117d7e92eed56c4d9aeefe916fc002aceaab71b42b04e490a6d90bdb06c5b9f` |
| `metric-ratio-bar@1.upper-bound.run-3.zip`     | `2865156bfcc0591ef3e77dbc3b37f6e3fda6a6998be93713197a8d7362a338e3` |
| `recorded-trace-graph@1.typical.run-1.zip`     | `ab65e70ce08218417f189f574c2bb02784b2a1089e1ad0c185ad0a453a300c36` |
| `recorded-trace-graph@1.typical.run-2.zip`     | `a86cb4b0a0defcf99b52f2fc112015771d561326e010a01d49f6c52b63b041c4` |
| `recorded-trace-graph@1.typical.run-3.zip`     | `786acb960079f4a07ef5cb568dac6243b10008d20e19997397ddbd82ad1bd525` |
| `recorded-trace-graph@1.upper-bound.run-1.zip` | `78879fbe58013768399dca6ad3cd117e2f64ebe9874594fcdb9b0f2aa43089eb` |
| `recorded-trace-graph@1.upper-bound.run-2.zip` | `bbc23580c063e84b7d23ce2021949b6811ffc37dc29d9996ecfdc731a7033cb1` |
| `recorded-trace-graph@1.upper-bound.run-3.zip` | `9558d0e6ae74c24876c7db78735362b30789ff4dfcace2217efe49b4d198523f` |
| `unavailable@1.semantic.run-1.zip`             | `850087dcf84da1f1bdf21dda0ac92cec28277007c11b83f06552ba0df2b877fe` |
| `unavailable@1.semantic.run-2.zip`             | `6358b9b3e71ccedf65f780a713d2e4b4761c7ab9f259c6f9d3cb052f79ce669a` |
| `unavailable@1.semantic.run-3.zip`             | `8b35e82e45425d21816ac0ccf2605bfb5ba4b0f9b8b24f048ec4a5fd1be9950a` |

## Exact clean gate

A detached clean worktree at the exact provider commit passed:

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

The React 18 qualification consumed only the `wsr-ui-core` packed artifact and
rendered both an AVAILABLE ratio SVG and an UNAVAILABLE semantic state.

## Publication boundary

Human approval covered publishing this exact prerelease coordinate. npm Web
authentication and the publish-specific Web 2FA challenge completed
successfully.

Post-publication registry verification:

- Published package: `wsr-ui-core@0.1.0-rc.0`
- Tarball: `https://registry.npmjs.org/wsr-ui-core/-/wsr-ui-core-0.1.0-rc.0.tgz`
- Registry integrity: `sha512-jHK1jASNAw0WqNMrzgOK9KWZls/DiA7q8J2shE96/Gatb2mTw+lzG7UY+8rWuh1PWfyTFuvqnS3u/hVfyCrOBw==`
- Registry shasum: `9cec13b79de92a207e2bcc21729516d742297739`
- `next` dist-tag: `0.1.0-rc.0`
- `latest` dist-tag: `0.1.0-rc.0`, automatically created by npm for this
  first package publication; authenticated removal returned HTTP 400, so no
  synthetic stable version was introduced to work around registry behavior.

A new temporary consumer installed the exact version through normal registry
resolution. Its lockfile resolved the registry tarball with the exact integrity
above, selected React and React DOM `18.3.1`, rendered the AVAILABLE SVG and
UNAVAILABLE semantic state, and did not render JSON as the primary surface.
