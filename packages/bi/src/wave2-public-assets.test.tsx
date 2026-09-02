import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MetricResult } from "./domain/evolution/types";
import {
  BiCard,
  BiSection,
  BiSurface,
  MetricPanel,
  createBiTheme,
  selectDefaultVisualizer,
} from "./public";

const ratioResult: MetricResult = {
  metric_id: "role-template-rework-rate",
  metric_version: "2.0.0",
  slices: [
    {
      slice_key: {},
      state: "AVAILABLE",
      value: { kind: "RATIO", value: "17/25", unit: "ratio" },
      measures: {},
      numerator: "17",
      denominator: "25",
      coverage: null,
      compatibility: {},
      exclusions: [],
      missing_inputs: [],
      provenance_refs: ["fact:rework"],
    },
  ],
};

describe("Wave 2 public reusable BI assets", () => {
  it("accepts a host-created theme while retaining semantic container ownership", () => {
    const theme = createBiTheme({
      mode: "dark",
      density: "compact",
      containerBorderStyle: "dashed",
      palette: {
        surface: {
          section: "var(--host-section)",
          panel: "var(--host-panel)",
          raised: "var(--host-raised)",
          inset: "var(--host-inset)",
        },
        content: {
          primary: "var(--host-content-primary)",
          secondary: "var(--host-content-secondary)",
          muted: "var(--host-content-muted)",
          inverse: "var(--host-content-inverse)",
        },
        border: {
          default: "var(--host-border-default)",
          strong: "var(--host-border-strong)",
        },
        interaction: {
          accent: "var(--host-accent)",
          selection: "var(--host-selection)",
          disabled: "var(--host-disabled)",
          focusRing: "var(--host-focus-ring)",
        },
        status: {
          available: "var(--host-available)",
          attention: "var(--host-attention)",
          unavailable: "var(--host-unavailable)",
          expired: "var(--host-expired)",
          incompatible: "var(--host-incompatible)",
          error: "var(--host-error)",
        },
        data: [
          "var(--host-data-1)",
          "var(--host-data-2)",
          "var(--host-data-3)",
        ],
      },
      typography: {
        fontFamily: "Host Sans",
        codeFontFamily: "Host Mono",
        h1: "1.5rem",
        h2: "1rem",
        subtitle1: "0.875rem",
        body1: "0.875rem",
        body2: "0.75rem",
        caption: "0.6875rem",
        overline: "0.6875rem",
      },
    });

    render(
      <BiSurface theme={theme}>
        <BiSection aria-label="Evaluation metrics">
          <BiCard>Metric content</BiCard>
        </BiSection>
      </BiSurface>,
    );

    const surface = screen.getByText("Metric content").closest(".wsr-bi");
    expect(surface).toHaveAttribute("data-theme", "dark");
    expect(surface).toHaveAttribute("data-density", "compact");
    expect(surface).toHaveStyle("--wsr-container-border-style: dashed");
    expect(surface).toHaveStyle("--wsr-surface-section: var(--host-section)");
    expect(surface).toHaveStyle("--wsr-surface-panel: var(--host-panel)");
    expect(surface).toHaveStyle("--wsr-surface-raised: var(--host-raised)");
    expect(surface).toHaveStyle("--wsr-surface-inset: var(--host-inset)");
    expect(surface).toHaveStyle(
      "--content-primary: var(--host-content-primary)",
    );
    expect(surface).toHaveStyle("--border-strong: var(--host-border-strong)");
    expect(surface).toHaveStyle("--interaction-accent: var(--host-accent)");
    expect(surface).toHaveStyle("--focus-ring: var(--host-focus-ring)");
    expect(surface).toHaveStyle("--status-error: var(--host-error)");
    expect(surface).toHaveStyle("--status-warning: var(--host-attention)");
    expect(surface).toHaveStyle("--data-series-1: var(--host-data-1)");
    expect(surface).toHaveStyle("--data-series-4: var(--host-data-1)");
    expect(surface).toHaveStyle("--data-series-6: var(--host-data-3)");
    expect(surface).toHaveStyle("--wsr-type-h1: 1.5rem");
    expect(surface).toHaveStyle("--wsr-font-family: Host Sans");
    expect(surface).toHaveStyle("--wsr-code-font-family: Host Mono");
    expect(surface).toHaveStyle("--wsr-type-h2: 1rem");
    expect(surface).toHaveStyle("--wsr-type-subtitle1: 0.875rem");
    expect(surface).toHaveStyle("--wsr-type-body1: 0.875rem");
    expect(surface).toHaveStyle("--wsr-type-body2: 0.75rem");
    expect(surface).toHaveStyle("--wsr-type-caption: 0.6875rem");
    expect(surface).toHaveStyle("--wsr-type-overline: 0.6875rem");
    expect(surface?.getAttribute("style")).not.toMatch(
      /--wsr-type-(?:page-title|section-title|body|label|micro|code|value):/,
    );
    expect(surface?.getAttribute("style")).not.toMatch(
      /--wsr-(?:tree|waterfall|statistics|trace-indent)-/,
    );
    expect(
      screen.getByRole("region", { name: "Evaluation metrics" }),
    ).toContainElement(screen.getByText("Metric content"));
  });

  it("keeps default visualizer selection and metric projection inside core", () => {
    expect(selectDefaultVisualizer(ratioResult)).toBe("ratio-bar@1");

    render(<MetricPanel result={ratioResult} />);

    expect(screen.getByRole("img", { name: /ratio bar/i })).toBeVisible();
    expect(screen.getAllByText("68.00%")[0]).toBeVisible();
  });

  it("fails a malformed formal Metric DTO closed inside the cohesive panel", () => {
    render(
      <MetricPanel
        result={
          {
            metric_id: "malformed",
            metric_version: "2.0.0",
            slices: [
              {
                state: "AVAILABLE",
                value: { kind: "RATIO", value: "1/2", unit: "ratio" },
              },
            ],
          } as unknown as MetricResult
        }
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Metric Result incompatible",
    );
    expect(screen.queryByRole("img")).toBeNull();
  });
});
