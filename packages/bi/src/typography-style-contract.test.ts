import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const primitives = readFileSync("packages/bi/src/primitives.css", "utf8");
const shared = readFileSync("packages/bi/src/shared.css", "utf8");

describe("shared Typography scale", () => {
  it("uses seven familiar variants on one deliberate default scale", () => {
    expect(shared).toMatch(/--wsr-type-h1:\s*2\.25rem/);
    expect(shared).toMatch(/--wsr-type-h2:\s*1\.25rem/);
    expect(shared).toMatch(/--wsr-type-subtitle1:\s*1\.125rem/);
    expect(shared).toMatch(/--wsr-type-body1:\s*1rem/);
    expect(shared).toMatch(/--wsr-type-body2:\s*0\.875rem/);
    expect(shared).toMatch(/--wsr-type-caption:\s*0\.75rem/);
    expect(shared).toMatch(/--wsr-type-overline:\s*0\.5625rem/);
    expect(shared).not.toMatch(
      /--wsr-type-(?:page-title|section-title|body|label|micro|code|value):/,
    );

    expect(
      [...primitives.matchAll(/data-variant="([^"]+)"/g)].map(
        ([, variant]) => variant,
      ),
    ).toEqual([
      "h1",
      "h2",
      "subtitle1",
      "body1",
      "body2",
      "caption",
      "overline",
    ]);
  });

  it("keeps family, emphasis, decoration, and tone orthogonal to size", () => {
    for (const selector of [
      'data-family="mono"',
      'data-weight="regular"',
      'data-weight="medium"',
      'data-weight="semibold"',
      'data-weight="bold"',
      'data-tone="primary"',
      'data-tone="secondary"',
      'data-tone="muted"',
      'data-tone="inverse"',
      'data-tone="error"',
      'data-tone="warning"',
      'data-tone="success"',
      "data-italic",
      "data-underline",
      "data-truncate",
    ])
      expect(primitives).toContain(`[${selector}]`);
  });
});
