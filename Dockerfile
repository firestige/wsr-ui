FROM node:24.12.0-alpine3.23 AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY packages/bi/package.json packages/bi/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund

COPY . .
RUN npm run typecheck && npm run build

FROM nginx:1.29.5-alpine3.23

ARG WSR_UI_REVISION=unbound
LABEL org.opencontainers.image.source="https://github.com/firestige/wsr-ui" \
      org.opencontainers.image.revision=$WSR_UI_REVISION

ENV EVIDENCE_UPSTREAM=evidence:4318 \
    EVOLUTION_UPSTREAM=evolution:8000
COPY deployment/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/packages/bi/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
