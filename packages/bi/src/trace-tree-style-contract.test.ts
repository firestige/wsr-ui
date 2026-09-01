import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("packages/bi/src/shared.css", "utf8");

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
