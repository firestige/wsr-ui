import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("packages/bi/src/shared.css", "utf8");

describe("shared Trace view header grammar", () => {
  it("uses horizontal layout, vertical copy, flexible space, and metrics", () => {
    expect(css).toMatch(
      /\.trace-view-header\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row/s,
    );
    expect(css).toMatch(
      /\.trace-view-header-copy\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column/s,
    );
    expect(css).toMatch(
      /\.trace-view-header-spacer\s*\{[^}]*flex:\s*1 1 auto/s,
    );
    expect(css).toMatch(
      /\.trace-view-header-metrics\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row/s,
    );
  });

  it("keeps overline compact while caption follows the readable text scale", () => {
    expect(css).toMatch(
      /\.trace-view-header-copy\s*>\s*\.wsr-typography\[data-variant="overline"\]\s*\{[^}]*font-size:\s*var\(--type-overline-size\)/s,
    );
    expect(css).toMatch(
      /\.trace-view-header-copy\s*>\s*\.wsr-typography\[data-variant="caption"\]\s*\{[^}]*font-size:\s*var\(--type-caption-size\)/s,
    );
    expect(css).toMatch(
      /\.trace-view-header-copy\s*>\s*\.wsr-typography\[data-variant="overline"\]\s*\{[^}]*color:\s*var\(--content-secondary\);[^}]*font-weight:\s*700/s,
    );
    expect(css).toMatch(
      /\.trace-view-header-copy\s*>\s*\.wsr-typography\[data-variant="caption"\]\s*\{[^}]*color:\s*var\(--content-muted\)/s,
    );
  });
});
