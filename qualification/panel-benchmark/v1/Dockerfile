FROM node:24.12.0-bookworm-slim@sha256:7326fb2dbdce998edd72140946851be64ef4a643e8715e138ca467e8e9d92c99

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY packages/bi/package.json packages/bi/package.json
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && npx playwright install --with-deps chromium

COPY . .

ENV WSR_BENCHMARK_FIXED_RUNNER=1
CMD ["node", "qualification/panel-benchmark/v1/run.mjs", "--mode=full"]
