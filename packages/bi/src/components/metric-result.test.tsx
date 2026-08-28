import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MetricSlice } from "../domain/evolution/types";
import { MetricNavigator, MetricResultFrame } from "./metric-result";

const availableSlice: MetricSlice = {
  slice_key: {},
  state: "AVAILABLE",
  value: { kind: "COUNT", value: "9007199254740993", unit: "delivery" },
  measures: { observed: "9007199254740993" },
  numerator: "9007199254740993",
  denominator: "90071992547409930",
  contributing_count: "9007199254740993",
  coverage: {
    numerator: "9007199254740993",
    denominator: "90071992547409930",
    raw_ratio: "1/10",
    state: "PARTIAL",
    alert: "LOW_COVERAGE",
  },
  compatibility: {},
  exclusions: [],
  missing_inputs: [],
  provenance_refs: ["fact:a"],
};

describe("Metric Result foundations", () => {
  it("preserves authoritative strings and composes a visualization slot", () => {
    render(
      <MetricResultFrame
        content={{ tag: "RESULT", slice: availableSlice }}
        coordinate="delivery-count@2.0.0"
        visualization={<div aria-label="Bar presentation">bar</div>}
      />,
    );

    expect(
      screen.getByRole("article", { name: "delivery-count@2.0.0" }),
    ).toBeVisible();
    expect(screen.getAllByText("9007199254740993").length).toBeGreaterThan(0);
    expect(screen.getByText("delivery")).toBeVisible();
    expect(screen.getByLabelText("Bar presentation")).toBeVisible();
    expect(
      screen.getByText("9007199254740993 / 90071992547409930"),
    ).toBeVisible();
  });

  it("does not invent zero or a chart for a withheld result", () => {
    render(
      <MetricResultFrame
        content={{
          tag: "RESULT",
          slice: {
            ...availableSlice,
            state: "UNAVAILABLE",
            value: undefined,
            withholding_reason: "MISSING_INPUT",
            numerator: undefined,
            denominator: undefined,
            contributing_count: undefined,
          },
        }}
        coordinate="delivery-count@2.0.0"
      />,
    );

    expect(screen.getByText("Unavailable")).toBeVisible();
    expect(screen.getByText("Reason: MISSING_INPUT")).toBeVisible();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("offers an explicit recovery path for a withheld result", async () => {
    const user = userEvent.setup();
    const recover = vi.fn();
    render(
      <MetricResultFrame
        content={{
          tag: "RESULT",
          slice: {
            ...availableSlice,
            state: "EXPIRED",
            value: undefined,
            withholding_reason: "EXPIRED_INPUT",
            reading: "Choose an active Delivery population.",
          },
        }}
        coordinate="delivery-count@2.0.0"
        onRecover={recover}
        recoveryLabel="Change selection"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Change selection" }));
    expect(recover).toHaveBeenCalledOnce();
  });

  it("keeps loading and error outside the MetricSlice truth union", () => {
    const { rerender } = render(
      <MetricResultFrame
        content={{ tag: "LOADING" }}
        coordinate="delivery-count@2.0.0"
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading metric");

    rerender(
      <MetricResultFrame
        content={{
          tag: "ERROR",
          detail: "Selection is preserved.",
          retryable: false,
        }}
        coordinate="delivery-count@2.0.0"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Selection is preserved",
    );
  });

  it("exposes explanation and evidence as separate actions", async () => {
    const user = userEvent.setup();
    const explain = vi.fn();
    const evidence = vi.fn();
    render(
      <MetricResultFrame
        content={{ tag: "RESULT", slice: availableSlice }}
        coordinate="delivery-count@2.0.0"
        onEvidence={evidence}
        onExplain={explain}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Metric explanation" }),
    );
    await user.click(screen.getByRole("button", { name: "View evidence" }));
    expect(explain).toHaveBeenCalledOnce();
    expect(evidence).toHaveBeenCalledOnce();
  });

  it("navigates exact coordinates without ranking and reports Delta state", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <MetricNavigator
        items={[
          {
            coordinate: "metric-a@2.0.0",
            resultState: "AVAILABLE",
            deltaState: "AVAILABLE",
          },
          {
            coordinate: "metric-b@2.0.0",
            resultState: "UNAVAILABLE",
            deltaState: "SIDE_UNRESOLVED",
          },
        ]}
        mode="compare"
        onSelect={select}
        selectedCoordinate="metric-a@2.0.0"
      />,
    );

    expect(
      screen.getByRole("button", { name: /metric-a@2.0.0/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("Delta: side unresolved")).toBeVisible();
    expect(screen.queryByText(/winner|rank/i)).toBeNull();
    await user.click(screen.getByRole("button", { name: /metric-b@2.0.0/ }));
    expect(select).toHaveBeenCalledWith("metric-b@2.0.0");
  });
});
