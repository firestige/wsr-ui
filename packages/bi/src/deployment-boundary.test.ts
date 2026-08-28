import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const nginx = readFileSync("deployment/nginx/default.conf.template", "utf8");
const dockerfile = readFileSync("Dockerfile", "utf8");

describe("Wave9 serving boundary", () => {
  it("binds the image to both private upstreams", () => {
    expect(dockerfile).toContain("ENV EVIDENCE_UPSTREAM=evidence:4318");
    expect(dockerfile).toContain("EVOLUTION_UPSTREAM=evolution:8000");
  });

  it.each([
    ["/v1/evidence/tasks", "GET", "EVIDENCE_UPSTREAM"],
    ["/v1/evidence/facts", "GET", "EVIDENCE_UPSTREAM"],
    ["/v1/evidence/traces", "GET", "EVIDENCE_UPSTREAM"],
    ["/api/evolution/v1/evaluations:compute", "POST", "EVOLUTION_UPSTREAM"],
  ])(
    "allows only %s %s through its approved upstream",
    (path, method, upstream) => {
      const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const location = nginx.match(
        new RegExp(`location = ${escapedPath} \\{([\\s\\S]*?)\\n\\s{4}\\}`),
      )?.[1];

      expect(location).toBeDefined();
      expect(location).toContain(`if ($request_method != ${method})`);
      expect(location).toContain("return 405");
      expect(location).toContain(`proxy_pass http://\${${upstream}}`);
    },
  );

  it("fails closed for every unapproved API path before SPA fallback", () => {
    expect(nginx).toMatch(/location \/api\/ \{[\s\S]*?return 404/);
    expect(nginx).toMatch(/location \/v1\/evidence\/ \{[\s\S]*?return 404/);
    expect(nginx).toMatch(
      /location \/ \{[\s\S]*?try_files \$uri \$uri\/ \/index\.html/,
    );
  });

  it("keeps the compute proxy inside the client-side deadline", () => {
    const location = nginx.match(
      /location = \/api\/evolution\/v1\/evaluations:compute \{([\s\S]*?)\n {4}\}/,
    )?.[1];

    expect(location).toContain("proxy_read_timeout 123s");
    expect(location).toContain("proxy_send_timeout 123s");
  });
});
