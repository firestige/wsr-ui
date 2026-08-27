import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = resolve("packages/bi/src/app.tsx");
const tokenPath = resolve("packages/bi/src/styles.css");

describe("semantic style boundary", () => {
  it("keeps raw palette and arbitrary layout values out of component classes", () => {
    const source = readFileSync(sourcePath, "utf8");
    const rawPalette =
      /(?:bg|text|border|fill|stroke)-(?:slate|gray|zinc|red|amber|green|blue)-\d+/;
    const arbitraryValue =
      /(?:bg|text|border|fill|stroke|gap|p[xy]?|m[xy]?)-\[[^\]]+\]/;

    expect(source).not.toMatch(rawPalette);
    expect(source).not.toMatch(arbitraryValue);
  });

  it("binds theme and layout names through Tailwind semantic tokens", () => {
    const tokens = readFileSync(tokenPath, "utf8");

    expect(tokens).toContain("--color-surface-canvas: var(--surface-canvas)");
    expect(tokens).toContain("--color-content-primary: var(--content-primary)");
    expect(tokens).toContain("--spacing-layout-page: var(--space-page)");
    expect(tokens).toContain(':root[data-theme="dark"]');
    expect(tokens).toContain(':root[data-density="compact"]');
  });
});
