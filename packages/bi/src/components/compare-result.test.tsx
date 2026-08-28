import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  DeltaEntry,
  MetricSlice,
  SideError,
} from "../domain/evolution/types";
import { CompareResultFrame } from "./compare-result";

const slice = (value: string): MetricSlice => ({
  slice_key: {},
  state: "AVAILABLE",
  value: { kind: "COUNT", value, unit: "deliveries" },
  measures: {},
  numerator: value,
  denominator: "10",
  contributing_count: "10",
  coverage: {
    numerator: "10",
    denominator: "10",
    raw_ratio: "1",
    state: "FULL",
    alert: null,
  },
  compatibility: {},
  exclusions: [],
  missing_inputs: [],
  provenance_refs: [],
});

describe("Before Delta After", () => {
  it("keeps Before and After symmetric and renders Evolution Delta last", () => {
    const delta: DeltaEntry = {
      metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
      slice_key: {},
      state: "AVAILABLE",
      value: { kind: "COUNT", value: "9007199254740993", unit: "deliveries" },
      direction: "INCREASE",
    };
    const { container } = render(
      <CompareResultFrame
        after={slice("9")}
        before={slice("2")}
        coordinate={delta.metric_coordinate}
        delta={delta}
      />,
    );

    const text = container.textContent!;
    expect(text.indexOf("Before")).toBeLessThan(text.indexOf("After"));
    expect(text.indexOf("After")).toBeLessThan(text.indexOf("Delta"));
    expect(screen.getByText("Increase")).toBeVisible();
    expect(screen.getByText("9,007,199,254,740,993 deliveries")).toBeVisible();
  });

  it("keeps the successful side and scopes retry to the failed side", async () => {
    const retry = vi.fn();
    const failure: SideError = {
      tag: "SIDE_ERROR",
      code: "UPSTREAM_UNAVAILABLE",
      retryable: true,
      detail: "Evidence is temporarily unavailable",
    };
    render(
      <CompareResultFrame
        afterError={failure}
        before={slice("2")}
        coordinate="delivery-terminal-outcome-rate@2.0.0"
        delta={{
          metric_coordinate: "delivery-terminal-outcome-rate@2.0.0",
          slice_key: {},
          state: "SIDE_UNRESOLVED",
        }}
        onRetryFailedSide={retry}
      />,
    );

    expect(
      within(
        screen.getByRole("region", { name: "Before result" }),
      ).getAllByText("2")[0],
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("After unavailable");
    expect(
      screen.getByText("Delta unavailable until both sides resolve"),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
