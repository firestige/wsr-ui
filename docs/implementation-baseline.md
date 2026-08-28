# Iteration 5 BI Implementation Baseline

> Status: Wave 2 G2b conformity PASS with Wave3 design rebaseline, 2026-08-28. The exact toolchain,
> repository, source-build and test feasibility below remain reusable. Browser metric evaluation,
> the BI-local manifest, fixed `/factual`/`/trace` IA and single-Evidence-upstream assumptions are
> superseded by the accepted Wave3 candidate designs in the superproject. This document does not
> authorize product implementation or publish a Contract.

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

All Iter5 source changes land on `iter5/implementation`. Wave 11 must squash-merge the component
feature line to component `main` first, then repin the superproject feature line to that main commit.
The superproject feature line is squash-merged to superproject `main` only after Wave 12 qualification.

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
| superproject assembly | `deployment/compose.iter5.yaml` (Wave 9), `qualification/iter5/**` (Wave 10), `wsr-ui` pin         |

The complete `database + evidence + evolution + bi-app` Compose never lives in this repository (the
Evidence migration job remains an operational prerequisite). The BI Dockerfile and Nginx configuration
never live in the superproject. Future UI deliverables do not consume or constrain the BI package in
Iter5.

## Runtime and distribution

The accepted Iter5 application is one SPA rooted at `/evaluate`; single is the default and compare is
an explicit same-workspace mode. Evidence Console and recorded Trace are drill-down routes that retain
the evaluation selection and return identity. `/preview` remains only a Wave 2 feasibility route until
later waves replace the superseded feature-branch UI.

The Nginx boundary has two private upstream authorities:

- Evolution accepts only the approved side-effect-free Metric Result compute POST;
- Evidence accepts only approved Task discovery and Fact/recorded-Trace read operations.

The closed browser surface is Evolution compute POST plus Evidence Task/Facts/Traces GET. Manifest
projection stays private to Evolution. `EVIDENCE_UPSTREAM` defaults to `evidence:4318` and
`EVOLUTION_UPSTREAM` defaults to `evolution:8000`; these are private container coordinates, not host
ports. Unknown/write routes fail closed. Nginx computes no metric, stores no receipt and has no database
client. `/healthz` is local infrastructure health, not Evolution or Evidence semantic health.

The superproject-owned Compose path is frozen as `deployment/compose.iter5.yaml`. Its default host
binding is `127.0.0.1:8080:80`; PostgreSQL, Evidence and Evolution expose no host port. Wave 9 owns its
implementation and Wave 12 owns the clean full-Compose oracle:

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

Wave3 freezes the future UI contract in superproject
`docs/systems/bi/bi-ui-design.md`. Tailwind continues to consume semantic bindings; the detailed
contract adds `/evaluate` deep-link restoration, bounded dashboard presets/custom layout, a closed
visualizer registry, multi-slice Metric Results, full/partial compare, receipt/metric-explanation
responsibility separation, Evidence Console, recorded-structure navigation, finite Still/Live motion,
three responsive capacities and complete accessibility/error recovery. The old preview's factual line,
fixed pages and component names are not authority for those behaviors.

## Superseded feature-branch boundary

The following committed feature-branch work is retained as history but must not be imported into the
new product path:

- browser-side Catalog formulas, evaluator or result digest;
- `wsr.bi.evaluation-context@1.0.0` and local `evaluation-context.json`;
- fixed `/factual` and `/trace` page composition;
- any component/API whose semantics require a single Evidence upstream;
- an independent `Recorded Reach` result/component.

The typed Evidence transport/decoder can be reused only after rebinding it to direct Fact/Trace
drill-down and the exact revised Contract coordinates. React/D3/Tailwind/Vite, semantic tokens,
theme/density controls, primitives and test/build infrastructure remain reusable. The published
`delivery-stage-reach` Metric Result remains valid; Trace recorded-structure navigation is a separate
presentation responsibility.

## Contract-derived fixtures and oracle map

`packages/bi/src/test/fixtures/upstream-binding.json` binds the Wave 2 feasibility fixtures to exact files,
digests and commit `b50525f5b1db2c017d71ed307ed25bb1c3a7c783` from `system-contracts`. This is historical fixture
provenance, not proof of the accepted Evolution result or Task-query contracts. Later waves must derive
their typed fixtures from the then-approved coordinates; no formula or Evidence response is copied into
UI production code.

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

Any need for a BI backend, database route, write proxy, registry publication, future-product abstraction,
inferred fact/relationship, or cross-system semantic change beyond the accepted Task/Evolution alignment
returns to design review.

Wave3 adds the following future implementation verification map without changing current product code:

| Design boundary     | Required later-wave verification                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| authority           | no Catalog formula, Delta computation, currency/unit conversion or missing-value fill in BI                                                                                            |
| selection/deep link | exact ID-only restoration; Task display-name missing/duplicate/rename cases; 24 IDs/side and 8 KiB encoded URL bounds                                                                  |
| Metric Result       | 12 candidate coordinates on every successful side; canonical multi-slice keys; zero/absence and coverage/sample separation; exact integer wire values remain canonical decimal strings |
| compare             | full compare and `PARTIAL_COMPARE`; successful side retained; failed side scoped retry; all Delta coordinates side-unresolved                                                          |
| dashboard/registry  | closed preset/import schema; named channels; compatibility/domain/missing tolerance; table/text fallback                                                                               |
| semantic UI         | light/dark parity, print/forced-colors, status redundancy, compact/comfortable information parity                                                                                      |
| responsive/a11y     | desktop/tablet/narrow, long names/numbers, 200-row table, keyboard-only journey, focus restoration and announcements                                                                   |
| Evidence drill-down | receipt-bound exact evidence vs related non-lineage Facts vs resolved read set; no reconstructed Fact/detail                                                                           |
| recorded Trace      | parent-depth only, siblings together, independent LINK, orphan lane, no timestamp/arrival ordering, finite Still/Live                                                                  |

These cases extend existing identity, duplicate/conflict, pagination, completeness, retention and expiry
fixtures. They do not introduce a Task-specific or cross-Fact/Trace global-snapshot Oracle.

Wave 2 exit verification passed on 2026-08-27: clean locked install, format, lint, strict TypeScript,
four unit/token tests, Vite build, dependency/license drift, Playwright keyboard/theme coverage,
source-built Nginx smoke and runtime-content audit. GitHub Actions run `33057518397` passed both verify
and Docker jobs for baseline commit `50d75063`.
