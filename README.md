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
`/preview` SPA route is a lightweight Wave 2 component and token preview, not a factual or Trace
business implementation.

## Runtime boundary

`Dockerfile` builds `packages/bi/dist` and copies it into Nginx. The runtime image contains no BI
business server. Nginx serves the SPA and proxies only `GET /v1/evidence/facts` and
`GET /v1/evidence/traces` to `EVIDENCE_UPSTREAM` (default `evidence:4318`). It never connects to
PostgreSQL.

Build locally without publishing:

```sh
docker build --tag wsr-ui-bi:local .
```

See [implementation baseline](docs/implementation-baseline.md) for exact versions, ownership and
qualification commands.
