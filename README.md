# WSR UI

Source-built UI deliverables for Workflow Self Recursive. Iteration 5 instantiates only the BI
deliverable; `workflow-builder` and `intake-sidebar` are intentionally absent.

## BI development

Requirements: Node 24.12.0, npm 11.6.2, and (for image checks) Docker.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run browser
npm run docker:smoke
```

The app is TypeScript/TSX throughout. Vite is the only application development/build path. The
`/preview` SPA route is a component/token catalog. The product workspace is rooted at `/evaluate`.

Run `npm run dev:test` for the persistent component test SPA. Its shell lives under
`packages/bi/src/test-harness`; the active scenario and fixture can be replaced between component tasks.
Stable Playwright and agent selectors follow the
[automation selector convention](docs/automation-selectors.md).

## Runtime boundary

`Dockerfile` builds `packages/bi/dist` and copies it into Nginx. The runtime image contains no BI
business server. Nginx serves the SPA and exposes this closed same-origin API surface:

- `POST /api/evolution/v1/evaluations:compute` to `EVOLUTION_UPSTREAM`;
- `GET /v1/evidence/tasks`, `/v1/evidence/facts`, and `/v1/evidence/traces` to
  `EVIDENCE_UPSTREAM`.

Other `/api/**` and `/v1/evidence/**` routes fail closed instead of reaching the SPA. The browser
cannot query Manifest projections; Evolution does so on its private Evidence connection. Nginx never
computes metrics or connects to PostgreSQL. Its `/healthz` reports Nginx/static-service liveness only.

Build locally without publishing:

```sh
docker build --tag wsr-ui-bi:local .
```

See [implementation baseline](docs/implementation-baseline.md) for exact versions, ownership and
qualification commands.
