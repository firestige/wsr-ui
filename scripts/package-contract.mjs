import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import process from "node:process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const requiredFiles = ["dist/index.d.ts", "dist/index.js", "dist/styles.css"];

async function listFiles(root, relative = "") {
  const entries = await readdir(resolve(root, relative), {
    withFileTypes: true,
  });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
      return entry.isDirectory() ? listFiles(root, path) : [path];
    }),
  );
  return files.flat().sort();
}

export async function inspectPackageArtifact(packageRoot) {
  const root = resolve(packageRoot);
  const metadata = JSON.parse(
    await readFile(resolve(root, "package.json"), "utf8"),
  );
  const files = await listFiles(root, "dist");
  for (const required of requiredFiles) {
    if (!files.includes(required)) {
      throw new Error(`Package artifact is missing ${required}`);
    }
  }

  const indexSource = await readFile(resolve(root, "dist/index.js"), "utf8");
  if (
    /react_production_min|react\.production\.min|react-jsx-runtime\.production|__SECRET_INTERNALS_DO_NOT_USE/i.test(
      indexSource,
    )
  ) {
    throw new Error("Package artifact contains a bundled React runtime");
  }
  if (
    !/(?:from\s*["']react["']|from\s*["']react\/jsx-runtime["'])/.test(
      indexSource,
    )
  ) {
    throw new Error(
      "Package artifact does not retain an external React import",
    );
  }

  const styles = await readFile(resolve(root, "dist/styles.css"), "utf8");
  if (!styles.includes(".wsr-bi")) {
    throw new Error("Package stylesheet is not scoped to .wsr-bi");
  }

  const digest = createHash("sha512");
  for (const file of files) {
    digest.update(file);
    digest.update("\0");
    digest.update(await readFile(resolve(root, file)));
    digest.update("\0");
  }

  return {
    coordinate: `${metadata.name}@${metadata.version}`,
    files,
    integrity: `sha512-${digest.digest("base64")}`,
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await inspectPackageArtifact(process.argv[2] ?? "packages/bi");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
