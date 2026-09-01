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
