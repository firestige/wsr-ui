import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { URL } from "node:url";

const inventoryPath = new URL(
  "../docs/dependency-inventory.ndjson",
  import.meta.url,
);
const lockPath = new URL("../package-lock.json", import.meta.url);
const lockBytes = readFileSync(lockPath);
const lock = JSON.parse(lockBytes.toString("utf8"));
const allowedLicenses = new Set([
  "0BSD",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BlueOak-1.0.0",
  "CC-BY-4.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "Unlicense",
]);

const dependencies = Object.entries(lock.packages)
  .filter(
    ([path, metadata]) =>
      path.includes("node_modules/") && metadata.link !== true,
  )
  .map(([path, metadata]) => ({
    path,
    version: metadata.version,
    license: metadata.license ?? "MISSING",
    development: metadata.dev === true,
    optional: metadata.optional === true,
  }))
  .sort((left, right) => left.path.localeCompare(right.path));

const unsupported = dependencies.filter(
  ({ license }) => !allowedLicenses.has(license),
);
if (unsupported.length > 0) {
  throw new Error(
    `Unreviewed dependency licenses: ${JSON.stringify(unsupported)}`,
  );
}

const header = {
  schema: "wsr-ui.dependency-inventory@0.1.0",
  packageLockSha256: createHash("sha256").update(lockBytes).digest("hex"),
  dependencyCount: dependencies.length,
};
const expected = `${[header, ...dependencies].map((entry) => JSON.stringify(entry)).join("\n")}\n`;

if (process.argv.includes("--write")) {
  writeFileSync(inventoryPath, expected);
} else if (process.argv.includes("--check")) {
  const actual = readFileSync(inventoryPath, "utf8");
  if (actual !== expected) {
    throw new Error("Dependency inventory is stale; run npm run deps:write");
  }
} else {
  process.stdout.write(expected);
}
