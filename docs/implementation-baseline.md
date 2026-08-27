# Iteration 5 BI Implementation Baseline

> Status: Wave 2 G2b candidate, 2026-08-27. This document freezes routine implementation
> parameters under the owner-approved G1 design at superproject commit `7de892a7c02ca8164798c1d61b5b68b88182b99c`.

## Repository and authority

| Coordinate                    | Frozen value                                                             |
| ----------------------------- | ------------------------------------------------------------------------ |
| Repository                    | `firestige/wsr-ui`, public                                               |
| Project license declaration   | none, matching the existing component repositories                       |
| Default branch                | `main`                                                                   |
| Initial main commit           | `96c87d2` (empty repository initialization; no Iter5 code)               |
| Iter5 feature line            | `iter5/implementation`                                                   |
| Branch protection at creation | none, matching the existing component repositories                       |
| Superproject mount            | `wsr-ui/` submodule                                                      |
| Product scope                 | BI only; no workflow-builder/intake-sidebar package, shell, image or job |

All Iter5 source changes land on `iter5/implementation`. Wave 8 must squash-merge the component
feature line to component `main` first, then repin the superproject feature line to that main commit.
The superproject feature line is squash-merged to superproject `main` only after Wave 9 PASS.

## Exact toolchain and dependencies

| Role                   | Exact version/reference                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Node / npm             | `24.12.0` / `11.6.2`                                                 |
| package manager        | npm workspaces, lockfile version 3                                   |
| TypeScript             | `6.0.3`; latest version inside `typescript-eslint@8.68.0` peer range |
| React / React DOM      | `19.2.8` / `19.2.8`                                                  |
| Vite / React plugin    | `8.2.2` / `6.1.0`                                                    |
| D3 / types             | `7.9.0` / `7.4.3`                                                    |
| Tailwind / Vite plugin | `4.3.3` / `4.3.3`                                                    |
| Vitest / jsdom         | `4.1.11` / `29.1.1`                                                  |
| Playwright             | `1.62.1`, Chromium 151 oracle at baseline time                       |
| builder image          | `node:24.12.0-alpine3.23`                                            |
| runtime image          | `nginx:1.29.5-alpine3.23`                                            |

TypeScript `7.0.2` was rejected during the bounded spike because the frozen ESLint TypeScript parser
requires `<6.1`. jsdom `30.0.1` was rejected because it requires Node `24.15.0` or newer. No peer or
engine check is bypassed.

`dependency-inventory.ndjson` inventories every locked transitive package and its license. The
allowlist covers the observed permissive licenses, `MPL-2.0` build tooling, `caniuse-lite` data under
`CC-BY-4.0`, and `mdn-data` under `CC0-1.0`. The runtime image copies no `node_modules`; the only
runtime program is the frozen Nginx base.

## Owned paths

| Owner                 | Paths                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| wsr-ui BI source      | `packages/bi/**`                                                                                   |
| wsr-ui build/runtime  | `package*.json`, TypeScript/Vite/test config, `Dockerfile`, `.dockerignore`, `deployment/nginx/**` |
| wsr-ui qualification  | `.github/workflows/ci.yml`, `scripts/**`, `tests/browser/**`, `docs/dependency-inventory.ndjson`   |
| superproject assembly | `deployment/compose.iter5.yaml` (Wave 6), `qualification/iter5/**` (Wave 7), `wsr-ui` pin          |

The complete `pg + evidence + bi-app` Compose never lives in this repository. The BI Dockerfile and
Nginx configuration never live in the superproject. Future UI deliverables do not consume or constrain
the BI package in Iter5.

## Runtime and distribution

The BI application is an SPA with Vite routes `/factual`, `/trace` and the Wave 2-only `/preview`.
Nginx listens on container port 80. `EVIDENCE_UPSTREAM` defaults to Docker DNS `evidence:4318` and
is substituted into the Nginx template at container start. Only the exact facts and traces paths admit
GET/HEAD; other methods are denied. `/healthz` is local infrastructure health, not Evidence health.

The superproject-owned Compose path is frozen as `deployment/compose.iter5.yaml`. Its default host
binding is `127.0.0.1:8080:80`; PostgreSQL and Evidence expose no host port. Wave 6 owns its
implementation and Wave 9 owns the clean full-Compose oracle:

```sh
docker compose -f deployment/compose.iter5.yaml up --build --wait
npm --prefix qualification/iter5 run e2e
docker compose -f deployment/compose.iter5.yaml down --volumes
```

Distribution is source-build only. Users select source access, a local image tag, target platform and
any public/private base or package mirrors. No registry coordinate, publisher workflow, credential,
multi-platform matrix or prebuilt artifact is a product contract.

## Semantic UI and bounded spike result

`packages/bi/src/styles.css` maps raw light/dark values to semantic surface, content, border, data,
state, spacing, shape and layout tokens through Tailwind `@theme inline`. Components use semantic
utilities; D3 SVGs inherit the same tokens through `currentColor`. Comfortable/compact density and
system/light/dark theme selection alter tokens without changing component composition.

The bounded preview proves:

- React owns state and accessible controls; strict TypeScript checks both app and tool configs.
- Vite builds the SPA and Tailwind semantic utilities without another application builder.
- D3 generates factual line geometry; the recorded Trace preview uses explicit relationships only.
- Both SVGs expose accessible image names and preserve keyboard-operated theme/density controls.
- Vitest guards semantic state and token boundaries; Playwright covers the deterministic browser path.
- Multi-stage Docker build and live Nginx smoke pass without a BI backend.

This is stack feasibility only. It does not implement, claim or infer #53–#55 business behavior.

## Contract-derived fixtures and oracle map

`packages/bi/src/test/fixtures/upstream-binding.json` binds four Wave 3 mock derivations to exact files,
digests and commit `b50525f5b1db2c017d71ed307ed25bb1c3a7c783` from `system-contracts`. Wave 2 records provenance;
Wave 3 owns typed payload derivation. No formula or Evidence response is copied into UI production code.

| Gate                          | Exact command / artifact                           |
| ----------------------------- | -------------------------------------------------- |
| format                        | `npm run format:check`                             |
| lint                          | `npm run lint`                                     |
| strict TypeScript             | `npm run typecheck` (`tsc -b --pretty false`)      |
| unit/token boundary           | `npm test`                                         |
| Vite application build        | `npm run build`                                    |
| browser                       | `npm run browser`                                  |
| dependency/license drift      | `npm run deps:check`                               |
| local image                   | `npm run docker:build`                             |
| live Nginx/source-build smoke | `npm run docker:smoke`                             |
| component CI                  | `.github/workflows/ci.yml`                         |
| future complete Compose       | superproject `deployment/compose.iter5.yaml`       |
| future independence oracle    | superproject `qualification/iter5/independence/**` |

Any need for a BI backend, database route, write proxy, registry publication, cross-system contract
change, future-product abstraction or inferred fact/relationship blocks the current wave.
