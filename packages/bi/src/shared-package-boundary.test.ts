import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const packageRoot = resolve("packages/bi");
const sourceRoot = resolve(packageRoot, "src");
const packageJson = JSON.parse(
  readFileSync(resolve(packageRoot, "package.json"), "utf8"),
) as Record<string, unknown>;

function productionSources(directory: string): string {
  return readdirSync(directory)
    .map((name) => resolve(directory, name))
    .filter(
      (path) =>
        !path.endsWith(".test.ts") &&
        !path.endsWith(".test.tsx") &&
        !path.includes(`${resolve(sourceRoot, "test")}/`),
    )
    .map((path) =>
      statSync(path).isDirectory()
        ? productionSources(path)
        : /\.[cm]?[jt]sx?$/.test(path)
          ? readFileSync(path, "utf8")
          : "",
    )
    .join("\n");
}

describe("host-neutral shared package boundary", () => {
  it("declares a publishable package with an explicit public surface", () => {
    expect(packageJson.name).toBe("wsr-ui-core");
    expect(packageJson.private).not.toBe(true);
    expect(packageJson.version).toBe("0.1.0-rc.1");
    expect(packageJson.license).toBe("Apache-2.0");
    expect(packageJson.exports).toEqual({
      ".": {
        types: "./dist/index.d.ts",
        import: "./dist/index.js",
      },
      "./styles.css": "./dist/styles.css",
    });
    expect(packageJson.files).toEqual(["dist", "README.md", "LICENSE"]);
    expect(packageJson.sideEffects).toEqual(["./dist/styles.css"]);
  });

  it("uses host React as a compatible peer instead of bundling a second runtime", () => {
    expect(packageJson.peerDependencies).toEqual({
      react: ">=18.3.1 <20",
      "react-dom": ">=18.3.1 <20",
    });
    expect(packageJson.dependencies).toEqual({
      d3: "7.9.0",
      "react-grid-layout": "2.2.4",
    });
  });

  it("has a dedicated public entry that does not start an application", () => {
    const publicEntry = resolve(sourceRoot, "public.ts");

    expect(existsSync(publicEntry)).toBe(true);
    const source = existsSync(publicEntry)
      ? readFileSync(publicEntry, "utf8")
      : "";
    expect(source).not.toMatch(/createRoot|\.render\s*\(/);
    expect(source).not.toMatch(/(?:window|document)\.(?:history|location)/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/@deepseek-ai|dsh-/i);
  });

  it("exports only an opt-in, root-scoped stylesheet", () => {
    const sharedStyles = resolve(sourceRoot, "shared.css");

    expect(existsSync(sharedStyles)).toBe(true);
    const source = existsSync(sharedStyles)
      ? readFileSync(sharedStyles, "utf8")
      : "";
    expect(source).toContain(".wsr-bi {");
    expect(source).not.toMatch(/(^|[},]\s*)(?::root|html|body|\*)\s*[{,]/m);
    expect(source).not.toContain('@import "tailwindcss"');
  });

  it("defines every design token consumed by the shared stylesheet", () => {
    const source = readFileSync(resolve(sourceRoot, "shared.css"), "utf8");
    const used = [...source.matchAll(/var\((--[\w-]+)/g)].map(
      ([, token]) => token,
    );
    const defined = new Set(
      [...source.matchAll(/(--[\w-]+)\s*:/g)].map(([, token]) => token),
    );

    expect(
      [...new Set(used.filter((token) => !defined.has(token)))].sort(),
    ).toEqual([]);
  });

  it("contains trace renderer intrinsic width on narrow host canvases", () => {
    const source = readFileSync(resolve(sourceRoot, "shared.css"), "utf8");

    expect(source).toContain(".wsr-bi .trace-view > *");
    expect(source).toContain("max-inline-size: 100%");
    expect(source).toContain("min-inline-size: 0");
  });

  it("keeps DSH dependencies and imports out of every shared source file", () => {
    expect(JSON.stringify(packageJson)).not.toMatch(/@deepseek-ai|dsh-/i);
    expect(productionSources(sourceRoot)).not.toMatch(
      /from\s+["'][^"']*(?:@deepseek-ai|dsh-)/i,
    );
  });
});
