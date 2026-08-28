import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve("packages/bi/src");
const tokenPath = resolve("packages/bi/src/styles.css");

function componentSources(directory: string): string {
  return readdirSync(directory)
    .map((name) => resolve(directory, name))
    .filter((path) => !path.endsWith(".test.tsx"))
    .map((path) =>
      statSync(path).isDirectory()
        ? componentSources(path)
        : path.endsWith(".tsx")
          ? readFileSync(path, "utf8")
          : "",
    )
    .join("\n");
}

describe("semantic style boundary", () => {
  it("keeps raw palette and arbitrary layout values out of component classes", () => {
    const source = componentSources(sourceRoot);
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

  it("defines every frozen visual-semantic role", () => {
    const tokens = readFileSync(tokenPath, "utf8");
    const roles = [
      "surface-canvas",
      "surface-panel",
      "surface-raised",
      "surface-overlay",
      "surface-inset",
      "content-primary",
      "content-secondary",
      "content-muted",
      "content-inverse",
      "border-default",
      "border-strong",
      "interaction-accent",
      "interaction-selection",
      "interaction-disabled",
      "focus-ring",
      "status-available",
      "status-attention",
      "status-unavailable",
      "status-expired",
      "status-incompatible",
      "status-error",
      "compare-before",
      "compare-after",
      "compare-delta-neutral",
      "data-series-1",
      "data-series-2",
      "data-series-3",
      "data-series-4",
      "data-series-5",
      "data-series-6",
    ];

    for (const role of roles) {
      expect(tokens, role).toContain(`--${role}:`);
      expect(tokens, role).toContain(`--color-${role}: var(--${role})`);
    }
    expect(tokens).not.toMatch(/status-(?:positive|negative|good|bad)/);
  });

  it("defines semantic type, density, shape, layer and finite-motion bindings", () => {
    const tokens = readFileSync(tokenPath, "utf8");
    for (const token of [
      "type-display-size",
      "type-heading-size",
      "type-body-size",
      "type-label-size",
      "type-code-size",
      "type-numeric-size",
      "density-row",
      "density-control",
      "shape-panel",
      "shape-control",
      "elevation-panel",
      "elevation-overlay",
      "layer-base",
      "layer-sticky",
      "layer-overlay",
      "motion-finite-duration",
      "motion-finite-easing",
    ]) {
      expect(tokens, token).toContain(`--${token}:`);
    }
  });

  it("provides non-color and no-motion fallbacks", () => {
    const tokens = readFileSync(tokenPath, "utf8");

    expect(tokens).toContain("@media print");
    expect(tokens).toContain("@media (forced-colors: active)");
    expect(tokens).toContain("@media (prefers-reduced-motion: reduce)");
    expect(tokens).toContain("--motion-finite-duration: 0ms");
  });
});
