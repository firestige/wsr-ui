import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MetricResult, MetricSlice } from "../domain/evolution/types";
import { DashboardMetricPanel, MetricPanel } from "./result-visualizer";

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
  it("renders a compact, non-scrolling SMALL numeric card with icon evidence", () => {
    render(
      <DashboardMetricPanel
        onEvidence={vi.fn()}
        result={result}
        size="SMALL"
        visualizer="numeric-card@1"
      />,
    );

    const panel = screen.getByRole("article", {
      name: "Delivery terminal outcome rate",
    });
    expect(panel).toHaveAttribute("data-presentation", "dashboard");
    expect(panel).toHaveAttribute("data-panel-size", "SMALL");
    expect(panel).toHaveAttribute("data-scrollable", "false");
    expect(panel).toHaveTextContent("33.33%");
    expect(panel).not.toHaveTextContent("Exact value");
    expect(panel).not.toHaveTextContent("1 / 3 exact");
    expect(panel).not.toHaveTextContent("Coverage");
    expect(panel).not.toHaveTextContent("Metric explanation");
    expect(within(panel).getByRole("heading")).toHaveClass(
      "dashboard-panel-title",
    );
    const evidence = within(panel).getByRole("button", {
      name: "View evidence",
    });
    expect(evidence).toHaveAttribute("data-icon-button", "true");
    expect(evidence.querySelector("svg")).toBeNull();
    expect(evidence.querySelector(".dashboard-evidence-icon")).toHaveClass(
      "icon-[tabler--file-search]",
    );
    const available = within(panel)
      .getByText("Available")
      .closest(".status-label")!;
    expect(available.querySelector(".status-label-marker")).toHaveTextContent(
      "✓",
    );
    expect(available.querySelector(".status-label-text")).toHaveTextContent(
      "Available",
    );
  });

  it("renders a MEDIUM dashboard ratio as one chart and one evidence action", () => {
    render(
      <DashboardMetricPanel
        onEvidence={vi.fn()}
        result={result}
        size="MEDIUM"
        visualizer="ratio-bar@1"
      />,
    );

    expect(screen.getByRole("img", { name: /33.33%/i })).toBeVisible();
    expect(screen.queryByRole("table", { name: /ratio bar data/i })).toBeNull();
    expect(screen.getByRole("button", { name: "View evidence" })).toBeVisible();
  });

  it("hides exact numerator detail when a ratio card is SMALL", () => {
    render(
      <DashboardMetricPanel
        result={result}
        size="SMALL"
        visualizer="ratio-bar@1"
      />,
    );

    const panel = screen.getByRole("article", {
      name: "Delivery terminal outcome rate",
    });
    expect(panel).toHaveTextContent("33.33%");
    expect(panel).not.toHaveTextContent("1 / 3 exact");
  });

  it("renders a WIDE dashboard table as a focused three-column preview", () => {
    render(
      <DashboardMetricPanel
        result={{
          ...result,
          slices: [ratio, { ...ratio, slice_key: { outcome: "failed" } }],
        }}
        size="WIDE"
        visualizer="table@1"
      />,
    );

    const table = screen.getByRole("table", {
      name: /dashboard result preview/i,
    });
    expect(table).toHaveTextContent("Slice");
    expect(table).toHaveTextContent("State");
    expect(table).toHaveTextContent("Exact value");
    expect(table).not.toHaveTextContent("Coverage");
    expect(table).not.toHaveTextContent("Compatibility");
    expect(table).not.toHaveTextContent("Provenance");
  });

  it("renders a boolean badge with text and symbol redundancy", () => {
    render(
      <MetricPanel
        result={{
          ...result,
          slices: [
            {
              ...ratio,
              value: { kind: "BOOLEAN", value: true, unit: "boolean" },
            },
          ],
        }}
        visualizer="badge@1"
      />,
    );

    expect(
      screen.getByRole("status", { name: "Boolean result" }),
    ).toHaveTextContent("✓ True");
  });

  it("renders a D3 ratio bar with a semantic table fallback", () => {
    render(<MetricPanel result={result} visualizer="ratio-bar@1" />);

    expect(screen.getByRole("img", { name: /ratio bar/i })).toBeVisible();
    expect(
      screen.getByRole("table", { name: /ratio bar data/i }),
    ).toHaveTextContent("1/3");
    expect(screen.getAllByText("33.33%")[0]).toBeVisible();
  });

  it.each(["-1/3", "4/3"])(
    "fails a ratio bar outside its declared unit domain closed: %s",
    (value) => {
      render(
        <MetricPanel
          result={{
            ...result,
            slices: [
              {
                ...ratio,
                value: { kind: "RATIO", value, unit: "ratio" },
              },
            ],
          }}
          visualizer="ratio-bar@1"
        />,
      );

      expect(screen.queryByRole("img", { name: /ratio bar/i })).toBeNull();
      expect(screen.getByText("Visualizer binding incompatible")).toBeVisible();
      expect(screen.getByRole("table")).toHaveTextContent(value);
    },
  );

  it("keeps every published Result field in the table grammar", () => {
    render(
      <MetricPanel
        result={{
          ...result,
          slices: [
            {
              ...ratio,
              contributing_count: "3",
              measures: { observed: "3" },
              compatibility: { unit: "ratio" },
              exclusions: ["expired:delivery-old"],
              missing_inputs: ["outcome:delivery-missing"],
              reading: "Descriptive result only.",
            },
          ],
        }}
        visualizer="table@1"
      />,
    );

    const table = screen.getByRole("table", { name: /result data/i });
    expect(table).toHaveTextContent("1 / 3");
    expect(table).toHaveTextContent("Contributing: 3");
    expect(table).toHaveTextContent('"observed":"3"');
    expect(table).toHaveTextContent("PARTIAL · 3 / 4 · 3/4");
    expect(table).toHaveTextContent('"unit":"ratio"');
    expect(table).toHaveTextContent("expired:delivery-old");
    expect(table).toHaveTextContent("outcome:delivery-missing");
    expect(table).toHaveTextContent("Descriptive result only.");
    expect(table).toHaveTextContent("fact:one");
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

  it("preserves a bound panel when its current Result has a data hole", () => {
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
        visualizer="ratio-bar@1"
      />,
    );

    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.queryByText("Visualizer binding incompatible")).toBeNull();
    expect(screen.queryByRole("img", { name: /ratio bar/i })).toBeNull();
  });

  it("fails one incompatible panel closed without inventing a domain", () => {
    render(<MetricPanel result={result} visualizer="badge@1" />);

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
