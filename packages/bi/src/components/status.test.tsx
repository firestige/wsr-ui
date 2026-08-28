import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  CoverageLabel,
  EvidenceLifecycleLabel,
  MetricTruthLabel,
  ScopedError,
} from "./status";

describe("semantic status components", () => {
  it.each([
    ["AVAILABLE", "Available"],
    ["LOWER_BOUND", "Lower bound"],
    ["NOT_APPLICABLE", "Not applicable"],
    ["UNAVAILABLE", "Unavailable"],
    ["EXPIRED", "Expired"],
    ["INCOMPATIBLE", "Incompatible"],
  ] as const)("renders Metric truth %s as text", (state, label) => {
    render(<MetricTruthLabel state={state} />);

    expect(screen.getByText(label)).toBeVisible();
  });

  it("keeps a lower-bound limitation prominent and readable", () => {
    render(
      <MetricTruthLabel
        reading="At least three matching Deliveries were recorded."
        state="LOWER_BOUND"
      />,
    );

    expect(screen.getByText("Lower bound")).toBeVisible();
    expect(
      screen.getByText("At least three matching Deliveries were recorded."),
    ).toBeVisible();
  });

  it("does not turn null no-population coverage into zero percent", () => {
    render(
      <CoverageLabel
        coverage={{
          numerator: "0",
          denominator: "0",
          raw_ratio: null,
          state: "NO_POPULATION",
          alert: null,
        }}
      />,
    );

    expect(screen.getByText("No applicable population")).toBeVisible();
    expect(screen.getByText("0 / 0")).toBeVisible();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
  });

  it("preserves exact large coverage counts and low-coverage alert text", () => {
    render(
      <CoverageLabel
        coverage={{
          numerator: "9007199254740993",
          denominator: "90071992547409930",
          raw_ratio: "1/10",
          state: "PARTIAL",
          alert: "LOW_COVERAGE",
        }}
      />,
    );

    expect(
      screen.getByText("9007199254740993 / 90071992547409930"),
    ).toBeVisible();
    expect(screen.getByText("Low coverage")).toBeVisible();
  });

  it("keeps Evidence completeness, availability and expiry as separate axes", () => {
    render(
      <EvidenceLifecycleLabel
        truth={{
          completeness: "LOWER_BOUND",
          availability: "AVAILABLE",
          expiry: "EXPIRED",
          expires_at: "2026-08-28T00:00:00Z",
        }}
      />,
    );

    expect(screen.getByText("Completeness: lower bound")).toBeVisible();
    expect(screen.getByText("Availability: available")).toBeVisible();
    expect(screen.getByText("Expiry: expired")).toBeVisible();
  });

  it("labels Trace partial as recorded-data incompleteness", () => {
    render(<EvidenceLifecycleLabel traceState="PARTIAL" />);

    expect(screen.getByText("Trace: partial recorded data")).toBeVisible();
  });

  it("offers retry only for a retryable scoped error", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(
      <ScopedError
        announce="assertive"
        detail="Evolution did not respond. Selection is preserved."
        onRetry={retry}
        retryable
        title="Right side unavailable"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Selection is preserved",
    );

    rerender(
      <ScopedError
        announce="polite"
        detail="The response contract is incompatible."
        retryable={false}
        title="Cannot display response"
      />,
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("status")).toBeVisible();
  });
});
