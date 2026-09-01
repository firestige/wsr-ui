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
});
