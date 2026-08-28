import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CATALOG_COORDINATES } from "./domain/evolution/client";
import type { EvolutionResult, SingleResponse } from "./domain/evolution/types";
import { EvaluationWorkspace } from "./evaluation-workspace";
import { previewReceipt, previewSlice } from "./preview-fixtures";

function singleResponse(): SingleResponse {
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
  return {
    api_version: 1,
    mode: "SINGLE",
    result: {
      tag: "SIDE_RESULT",
      receipt: previewReceipt,
      metric_results: CATALOG_COORDINATES.map((coordinate, index) => ({
        metric_id: coordinate.slice(0, coordinate.lastIndexOf("@")),
        metric_version: "2.0.0",
        slices: [
          index === 0
            ? {
                ...previewSlice,
                value: { kind: "RATIO", value: "1/3", unit: "ratio" },
                coverage: {
                  numerator: "2",
                  denominator: "3",
                  raw_ratio: "2/3",
                  state: "PARTIAL",
                  alert: null,
                },
              }
            : unavailable,
        ],
      })),
    },
  };
}

describe("Evaluation workspace", () => {
  it("submits the URL selection and renders authoritative single results", async () => {
    const computeSingle = vi.fn(async (): Promise<EvolutionResult> => ({
      ok: true,
      value: singleResponse(),
    }));
    render(
      <EvaluationWorkspace
        evolution={{ computeSingle, computeCompare: vi.fn() }}
        route={{ tag: "SINGLE", taskIds: ["task-preview"] }}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Resolving evaluation",
    );
    expect(await screen.findByText("33.33%")).toBeVisible();
    expect(computeSingle).toHaveBeenCalledWith(["task-preview"]);
    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.getAllByText("0 / 0").length).toBeGreaterThan(0);
  });

  it("opens the receipt without moving authority into route state", async () => {
    const user = userEvent.setup();
    render(
      <EvaluationWorkspace
        evolution={{
          computeSingle: vi.fn(async () => ({
            ok: true as const,
            value: singleResponse(),
          })),
          computeCompare: vi.fn(),
        }}
        route={{ tag: "SINGLE", taskIds: ["task-preview"] }}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "View receipt" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Evaluation receipt" }),
    ).toBeVisible();
    expect(screen.getByText("Preview task")).toBeVisible();
  });

  it("keeps a failed request scoped and retryable", async () => {
    const computeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: "ERROR", reason: "NETWORK" },
      })
      .mockResolvedValueOnce({ ok: true, value: singleResponse() });
    const user = userEvent.setup();
    render(
      <EvaluationWorkspace
        evolution={{ computeSingle, computeCompare: vi.fn() }}
        route={{ tag: "SINGLE", taskIds: ["task-preview"] }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("NETWORK");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("33.33%")).toBeVisible();
    expect(computeSingle).toHaveBeenCalledTimes(2);
  });
});
