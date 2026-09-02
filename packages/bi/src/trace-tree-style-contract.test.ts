import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("packages/bi/src/shared.css", "utf8");
const traceViews = readFileSync(
  "packages/bi/src/components/trace-views.tsx",
  "utf8",
);

describe("frozen Trace Tree visual grammar", () => {
  it("consumes the shared semantic type, shape, and surface tokens", () => {
    expect(css).toMatch(
      /--type-heading-size:\s*var\(--wsr-type-section-title,/,
    );
    expect(css).toMatch(/--type-body-size:\s*var\(--wsr-type-body,/);
    expect(css).toMatch(/--type-caption-size:\s*var\(--wsr-type-caption,/);
    expect(css).toMatch(/--shape-panel:\s*var\(--wsr-shape-panel,/);
    expect(css).toMatch(/--surface-panel:\s*var\(--wsr-surface-panel,/);
    expect(css).not.toMatch(/--trace-type-|--trace-surface-/);
  });

  it("restores the Passport divider and frozen spacing hierarchy", () => {
    expect(css).toMatch(
      /\.trace-passport-head\s*\{[^}]*border-block-end:\s*1px solid var\(--border-default\)/s,
    );
    expect(css).toMatch(
      /\.trace-passport-body\s*\{[^}]*padding:\s*0\.8125rem/s,
    );
    expect(css).toMatch(
      /\.trace-passport-title\s*\{[^}]*margin-block-end:\s*0\.875rem/s,
    );
  });

  it("highlights waterfall action icons on hover and keyboard focus", () => {
    expect(css).toMatch(
      /\.trace-waterfall-actions\s+\.wsr-button\[data-icon-button="true"\]:is\(:hover,\s*:focus-visible\)\s*\{[^}]*background:\s*var\(--interaction-selection\);[^}]*color:\s*var\(--interaction-accent\)/s,
    );
  });

  it("anchors the tree minimap in the lower-left corner", () => {
    const minimapRule = css.match(/\.trace-camera-map\s*\{([^}]*)\}/s)?.[1];
    expect(minimapRule).toBeDefined();
    expect(minimapRule).toMatch(/inset-inline-start:\s*var\(--space-grid\)/);
    expect(minimapRule).not.toContain("inset-inline-end");
    expect(minimapRule).toMatch(/inset-block-end:\s*var\(--space-grid\)/);
  });

  it("exposes theme overrides for tree nodes, edges, and Passport accents", () => {
    for (const token of [
      "--wsr-tree-node-surface",
      "--wsr-tree-node-border",
      "--wsr-tree-internal-color",
      "--wsr-tree-client-color",
      "--wsr-tree-error-color",
      "--wsr-tree-selected-color",
      "--wsr-tree-parent-edge-color",
      "--wsr-tree-link-edge-color",
    ]) {
      expect(css).toContain(`${token}:`);
      expect(traceViews).toContain(`"${token}"`);
    }
    expect(css).toMatch(
      /\.trace-passport-sigil\s*\{[^}]*var\(--wsr-tree-internal-color\)/s,
    );
    expect(css).toMatch(
      /\.trace-passport-sigil\.trace-kind-client\s*\{[^}]*var\(--wsr-tree-client-color\)/s,
    );
    expect(css).toMatch(
      /\.trace-link-receipt\s*\{[^}]*var\(--wsr-tree-link-edge-color\)/s,
    );
  });

  it("uses one typography and spacing contract for link and focus receipts", () => {
    expect(css).toMatch(
      /\.trace-link-receipt,\s*\.wsr-bi \.trace-focus-receipt\s*\{[^}]*margin-block:\s*var\(--space-grid\);[^}]*color:\s*var\(--content-secondary\);[^}]*font-family:\s*var\(--type-code-family\);[^}]*font-size:\s*var\(--type-caption-size\);[^}]*line-height:\s*1\.5;[^}]*text-align:\s*start/s,
    );
  });

  it("visually separates the minimap title from its timeline", () => {
    expect(css).toMatch(
      /\.trace-minimap-copy\s*\{[^}]*border-inline-end:\s*1px solid var\(--border-default\);[^}]*background:\s*var\(--surface-panel\)/s,
    );
    expect(css).toMatch(
      /\.trace-minimap\s*\{[^}]*grid-template-columns:\s*minmax\(8rem,\s*10rem\) minmax\(25rem,\s*1fr\)/s,
    );
  });

  it("uses a high-contrast warning color for the minimap zoom window", () => {
    expect(css).toMatch(
      /\.trace-minimap-window\s*\{[^}]*border-block:\s*1px solid\s+color-mix\(in srgb,\s*var\(--status-warning\) 82%,\s*transparent\);[^}]*background:\s*color-mix\(in srgb,\s*var\(--status-warning\) 14%,\s*transparent\)/s,
    );
    expect(css).toMatch(
      /\.trace-minimap-resize-handle::before\s*\{[^}]*background:\s*var\(--status-warning\)/s,
    );
  });

  it("keeps every timeline lane on the same surface", () => {
    expect(css).not.toContain('.trace-waterfall-lane[data-row-parity="odd"]');
  });

  it("uses solid background blocks instead of borders for waterfall indents", () => {
    const indentRule = css.match(/\.trace-indent-item\s*\{([^}]*)\}/s)?.[1];
    expect(indentRule).toBeDefined();
    expect(indentRule).not.toContain("border-inline-start");
    expect(indentRule).toMatch(/background:\s*color-mix\([\s\S]*?24%/);
  });

  it("exposes a four-color waterfall sequence with light and dark defaults", () => {
    expect(css).toMatch(/--wsr-waterfall-color-0:/);
    expect(css).toMatch(/--wsr-waterfall-color-3:/);
    expect(css).toMatch(
      /\.wsr-bi\[data-theme="dark"\]\s*\{[^}]*--wsr-waterfall-color-0:[^}]*--wsr-waterfall-color-3:/s,
    );
    expect(css).toMatch(
      /\.trace-timeline-bar\s*\{[^}]*var\(--trace-waterfall-color\)/s,
    );
  });
});
