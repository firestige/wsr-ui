import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { inspectPackageArtifact } from "./package-contract.mjs";

async function artifactFixture(indexSource) {
  const root = await mkdtemp(join(tmpdir(), "wsr-bi-package-contract-"));
  await mkdir(join(root, "dist"));
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({
      name: "wsr-ui-core",
      version: "0.1.0-rc.0",
      exports: {
        ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
        "./styles.css": "./dist/styles.css",
      },
      peerDependencies: { react: ">=18.3.1 <20", "react-dom": ">=18.3.1 <20" },
    }),
  );
  await writeFile(join(root, "dist/index.js"), indexSource);
  await writeFile(
    join(root, "dist/index.d.ts"),
    "export declare const MetricPanel: unknown;\n",
  );
  await writeFile(join(root, "dist/styles.css"), ".wsr-bi { color: black; }\n");
  return root;
}

test("accepts an external-React artifact with complete public files", async (t) => {
  const root = await artifactFixture(
    'import { createElement } from "react";\nexport { createElement };\n',
  );
  t.after(() => rm(root, { force: true, recursive: true }));

  const result = await inspectPackageArtifact(root);

  assert.equal(result.coordinate, "wsr-ui-core@0.1.0-rc.0");
  assert.deepEqual(result.files, [
    "dist/index.d.ts",
    "dist/index.js",
    "dist/styles.css",
  ]);
  assert.match(result.integrity, /^sha512-/);
});

test("fails closed when the package contains a bundled React runtime", async (t) => {
  const root = await artifactFixture(
    "function react_production_min() {}\nexport { react_production_min };\n",
  );
  t.after(() => rm(root, { force: true, recursive: true }));

  await assert.rejects(inspectPackageArtifact(root), /bundled React runtime/i);
});

test("fails closed when an ESM artifact retains a CommonJS React loader", async (t) => {
  const root = await artifactFixture(
    'import { createElement } from "react";\nconst load = (name) => require(name);\nexport { createElement, load };\n',
  );
  t.after(() => rm(root, { force: true, recursive: true }));

  await assert.rejects(inspectPackageArtifact(root), /CommonJS React loader/i);
});
