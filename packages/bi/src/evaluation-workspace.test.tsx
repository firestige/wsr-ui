import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CATALOG_COORDINATES } from "./domain/evolution/client";
import type {
  CompareResponse,
  EvolutionResult,
  SingleResponse,
} from "./domain/evolution/types";
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

function compareResponse(partial = false): CompareResponse {
  const left = singleResponse().result;
  const right = partial
    ? ({
        tag: "SIDE_ERROR",
        code: "QUERY_UNAVAILABLE",
        retryable: true,
        detail: "Evidence unavailable",
      } as const)
    : singleResponse().result;
  return {
    api_version: 1,
    mode: "COMPARE",
    status: partial ? "PARTIAL_COMPARE" : "FULL_COMPARE",
    left,
    right,
    deltas: CATALOG_COORDINATES.map((metric_coordinate, index) =>
      partial
        ? { metric_coordinate, slice_key: {}, state: "SIDE_UNRESOLVED" }
        : index === 0
          ? {
              metric_coordinate,
              slice_key: {},
              state: "AVAILABLE",
              value: { kind: "RATIO", value: "1/3", unit: "ratio" },
              direction: "INCREASE",
            }
          : {
              metric_coordinate,
              slice_key: {},
              state: "WITHHELD",
              withholding_reason: "MISSING_INPUT",
            },
    ),
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
    expect((await screen.findAllByText("33.33%"))[0]).toBeVisible();
    expect(computeSingle).toHaveBeenCalledWith(["task-preview"]);
    expect(screen.getAllByText("0 / 0").length).toBeGreaterThan(0);
  });

  it("switches presets without recomputing the evaluation", async () => {
    const computeSingle = vi.fn(async (): Promise<EvolutionResult> => ({
      ok: true,
      value: singleResponse(),
    }));
    const user = userEvent.setup();
    render(
      <EvaluationWorkspace
        evolution={{ computeSingle, computeCompare: vi.fn() }}
        route={{ tag: "SINGLE", taskIds: ["task-preview"] }}
      />,
    );

    await screen.findAllByText("33.33%");
    await user.selectOptions(
      screen.getByLabelText("Layout preset"),
      "detail-table@1",
    );
    expect(
      screen.getAllByRole("table", { name: /Fallback result data/ }),
    ).toHaveLength(CATALOG_COORDINATES.length);
    expect(computeSingle).toHaveBeenCalledTimes(1);
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
    expect((await screen.findAllByText("33.33%"))[0]).toBeVisible();
    expect(computeSingle).toHaveBeenCalledTimes(2);
  });

  it("renders full compare from Evolution sides and Deltas", async () => {
    const computeCompare = vi.fn(async () => ({
      ok: true as const,
      value: compareResponse(),
    }));
    render(
      <EvaluationWorkspace
        evolution={{ computeSingle: vi.fn(), computeCompare }}
        route={{
          tag: "COMPARE",
          leftTaskIds: ["task-before"],
          rightTaskIds: ["task-after"],
        }}
      />,
    );

    expect(await screen.findAllByText("Before")).toHaveLength(12);
    expect(screen.getAllByText("After")).toHaveLength(12);
    expect(screen.getAllByText("Delta")).toHaveLength(12);
    expect(computeCompare).toHaveBeenCalledWith(
      ["task-before"],
      ["task-after"],
    );
  });

  it("retains a successful compare side when the other side fails", async () => {
    const computeCompare = vi.fn(async () => ({
      ok: true as const,
      value: compareResponse(true),
    }));
    render(
      <EvaluationWorkspace
        evolution={{ computeSingle: vi.fn(), computeCompare }}
        route={{
          tag: "COMPARE",
          leftTaskIds: ["task-before"],
          rightTaskIds: ["task-after"],
        }}
      />,
    );

    expect(await screen.findAllByText("Available")).not.toHaveLength(0);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "After unavailable",
    );
    expect(
      screen.getAllByText("Delta unavailable until both sides resolve"),
    ).toHaveLength(12);
  });
});
