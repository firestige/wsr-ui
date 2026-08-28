import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App, previewReceipt, previewSlice } from "./app";
import {
  CATALOG_COORDINATES,
  decodeComputeResponse,
} from "./domain/evolution/client";

describe("BI component preview", () => {
  it("builds its factual slice and receipt from client-valid fixtures", () => {
    const unavailable = {
      ...previewSlice,
      state: "UNAVAILABLE" as const,
      value: undefined,
      withholding_reason: "MISSING_INPUT" as const,
      coverage: {
        numerator: "0",
        denominator: "0",
        raw_ratio: null,
        state: "NO_POPULATION" as const,
        alert: null,
      },
    };
    const response = {
      api_version: 1,
      mode: "SINGLE",
      result: {
        tag: "SIDE_RESULT",
        receipt: previewReceipt,
        metric_results: CATALOG_COORDINATES.map((coordinate, index) => ({
          metric_id: coordinate.slice(0, coordinate.lastIndexOf("@")),
          metric_version: "2.0.0",
          slices: [index === 0 ? previewSlice : unavailable],
        })),
      },
    };

    expect(decodeComputeResponse(response)).toMatchObject({ ok: true });
  });
  it("exposes theme and density as semantic UI controls", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("Theme"), "dark");
    await user.selectOptions(screen.getByLabelText("Density"), "compact");

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.density).toBe("compact");
  });

  it("previews the complete Metric truth matrix without a generic partial truth", () => {
    render(<App />);

    const matrix = screen.getByRole("region", { name: "Metric truth states" });
    for (const label of [
      "Available",
      "Lower bound",
      "Not applicable",
      "Unavailable",
      "Expired",
      "Incompatible",
    ]) {
      expect(within(matrix).getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(within(matrix).queryByText(/^Partial$/)).toBeNull();
    for (const state of [
      "available",
      "lower-bound",
      "not-applicable",
      "unavailable",
      "expired",
      "incompatible",
    ]) {
      expect(
        within(matrix).getByRole("article", {
          name: `${state}-preview@2.0.0`,
        }),
      ).toBeVisible();
    }
  });

  it("previews semantic D3 and recorded-structure foundations", () => {
    render(<App />);

    expect(
      screen.getByRole("img", { name: "Factual ratio preview" }),
    ).toBeVisible();
    expect(
      screen.getByRole("table", { name: "Factual ratio data" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Recorded trace preview" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Recorded structure" }),
    ).toBeVisible();
    expect(screen.getByText("Mode: Still")).toBeVisible();
  });

  it("keeps the Live preview finite", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      screen.getByRole("button", { name: "Start Live reading" }),
    );
    expect(screen.getByText("Mode: COMPLETE")).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset reading" })).toBeVisible();
  });

  it("opens both detail types in the single owned inspector", async () => {
    const user = userEvent.setup();
    render(<App />);

    const explanation = screen.getByRole("button", {
      name: "Preview metric explanation",
    });
    await user.click(explanation);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("terminal-outcome-rate@2.0.0")).toBeVisible();
    await user.keyboard("{Escape}");
    expect(explanation).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Preview receipt" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText(/response audit record/i)).toBeVisible();
  });
});
