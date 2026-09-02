import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("packages/bi/src/shared.css", "utf8");

describe("Trace Statistics visual grammar", () => {
  it("cycles the shared six-color data palette without private theme tokens", () => {
    expect(css).not.toContain("--wsr-statistics-color-");
    for (let index = 0; index < 6; index += 1) {
      expect(css).toMatch(
        new RegExp(
          `\\.trace-statistics-color\\[data-color-index="${index}"\\]\\s*\\{[^}]*--trace-statistics-color:\\s*var\\(--data-series-${index + 1}\\)`,
          "s",
        ),
      );
    }
  });

  it("uses the selected theme color for chart marks and values", () => {
    expect(css).toMatch(
      /\.wsr-typography\.trace-statistics-value\.trace-statistics-color\s*\{[^}]*color:\s*var\(--trace-statistics-color\)/s,
    );
    expect(css).toMatch(
      /\.trace-statistics-donut-segment\s*\{[^}]*stroke:\s*var\(--trace-statistics-color\)/s,
    );
    expect(css).toMatch(
      /\.trace-statistics-pie-segment\s*\{[^}]*fill:\s*var\(--trace-statistics-color\)/s,
    );
    expect(css).toMatch(
      /\.trace-statistics-kind-bar-fill\s*\{[^}]*background:\s*var\(--trace-statistics-color\)/s,
    );
    expect(css).toMatch(
      /\.trace-statistics-kind-bars\s*\{[^}]*grid-template-columns:\s*minmax\(4\.5rem,\s*auto\) minmax\(0,\s*1fr\)/s,
    );
    expect(css).toMatch(
      /\.trace-statistics-kind-bar-row\s*\{[^}]*display:\s*contents/s,
    );
    expect(css).toMatch(
      /\.trace-duration-column-fill\s*\{[^}]*background:\s*var\(--trace-statistics-color\)/s,
    );
  });

  it("uses three inventory cards, semantic statuses, and vertical durations", () => {
    expect(css).toMatch(
      /\.trace-statistics-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
    );
    expect(css).toMatch(
      /data-category="status-ok"[^}]*--trace-statistics-color:\s*var\(--status-available\)/s,
    );
    expect(css).toMatch(
      /data-category="status-error"[^}]*--trace-statistics-color:\s*var\(--status-error\)/s,
    );
    expect(css).toMatch(
      /data-category="status-unset"[^}]*--trace-statistics-color:\s*var\(--status-unavailable\)/s,
    );
    expect(css).toMatch(
      /\.trace-duration-chart\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(5rem,\s*1fr\)\)/s,
    );
    expect(css).toMatch(
      /\.trace-duration-distribution-body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.2fr\) minmax\(15rem,\s*0\.8fr\)/s,
    );
    expect(css).toMatch(
      /\.trace-duration-breakdowns\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
    );
    expect(css).toMatch(
      /\.trace-duration-breakdowns\s*\{[^}]*border-inline-start:\s*1px solid var\(--border-default\)/s,
    );
    const breakdownRule = css.match(
      /\.wsr-bi \.trace-duration-breakdown\s*\{([^}]*)\}/s,
    );
    expect(breakdownRule?.[1]).not.toMatch(/border(?:-|:)/);
  });
});
