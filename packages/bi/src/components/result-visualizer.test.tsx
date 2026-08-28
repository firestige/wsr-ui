import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MetricResult, MetricSlice } from "../domain/evolution/types";
import { MetricPanel } from "./result-visualizer";

const ratio: MetricSlice = {
  slice_key: {},
  state: "AVAILABLE",
  value: { kind: "RATIO", value: "1/3", unit: "ratio" },
  measures: {},
  numerator: "1",
  denominator: "3",
  coverage: {
    numerator: "3",
    denominator: "4",
    raw_ratio: "3/4",
    state: "PARTIAL",
    alert: null,
  },
  compatibility: {},
  exclusions: [],
  missing_inputs: [],
  provenance_refs: ["fact:one"],
};
const result: MetricResult = {
  metric_id: "delivery-terminal-outcome-rate",
  metric_version: "2.0.0",
  slices: [ratio],
};

describe("Metric panel visualization", () => {
  it("renders a D3 ratio bar with a semantic table fallback", () => {
    render(<MetricPanel result={result} visualizer="ratio-bar@1" />);

    expect(screen.getByRole("img", { name: /ratio bar/i })).toBeVisible();
    expect(
      screen.getByRole("table", { name: /ratio bar data/i }),
    ).toHaveTextContent("1/3");
    expect(screen.getAllByText("33.33%")[0]).toBeVisible();
  });

  it("keeps an unavailable Result as truth rather than substituting zero", () => {
    render(
      <MetricPanel
        result={{
          ...result,
          slices: [
            {
              ...ratio,
              state: "UNAVAILABLE",
              value: undefined,
              withholding_reason: "MISSING_INPUT",
            },
          ],
        }}
        visualizer="numeric-card@1"
      />,
    );

    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText(/^0$/)).toBeNull();
  });

  it("fails one incompatible panel closed without inventing a domain", () => {
    render(<MetricPanel result={result} visualizer="gauge@1" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Visualizer binding incompatible",
    );
    expect(
      screen.getByRole("table", { name: /fallback result data/i }),
    ).toBeVisible();
  });

  it("keeps explanation and Evidence entry points with every visualizer", async () => {
    const explain = vi.fn();
    const evidence = vi.fn();
    render(
      <MetricPanel
        onEvidence={evidence}
        onExplain={explain}
        result={result}
        visualizer="table@1"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Metric explanation" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "View evidence" }),
    );
    expect(explain).toHaveBeenCalledOnce();
    expect(evidence).toHaveBeenCalledOnce();
  });
});
