import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CATALOG_COORDINATES } from "./domain/evolution/client";
import type {
  CompareResponse,
  EvolutionResult,
  SingleResponse,
} from "./domain/evolution/types";
import { EvaluationWorkspace } from "./evaluation-workspace";
import { previewReceipt, previewSlice } from "./preview-fixtures";

afterEach(() => window.localStorage.clear());

function singleResponse(ratio = "1/3"): SingleResponse {
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
                value: { kind: "RATIO", value: ratio, unit: "ratio" },
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
  it("keeps an invalid deep link visible and offers explicit reselection", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <EvaluationWorkspace
        evolution={{ computeSingle: vi.fn(), computeCompare: vi.fn() }}
        onNavigate={onNavigate}
        route={{ tag: "INVALID", reason: "INVALID_PARAMETERS" }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid evaluation link",
    );
    await user.click(screen.getByRole("button", { name: "Re-select Tasks" }));
    expect(onNavigate).toHaveBeenCalledWith({ tag: "SELECT" });
  });

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
    expect(
      within(screen.getByLabelText("Evaluation context")).getByText(
        "Preview task (task-preview)",
      ),
    ).toBeVisible();
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

  it("saves a custom layout locally without changing the selection", async () => {
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

    await user.click(
      await screen.findByRole("button", { name: "Edit dashboard" }),
    );
    await user.click(screen.getByRole("button", { name: "Save local layout" }));
    expect(window.localStorage.getItem("wsr.bi.dashboard-layout@1")).toContain(
      '"layout_version":1',
    );
    expect(screen.getByLabelText("Layout preset")).toHaveValue("local@1");
    expect(computeSingle).toHaveBeenCalledTimes(1);
  });

  it("marks an exact single metric focus without hiding the dashboard", async () => {
    render(
      <EvaluationWorkspace
        evolution={{
          computeSingle: vi.fn(async () => ({
            ok: true as const,
            value: singleResponse(),
          })),
          computeCompare: vi.fn(),
        }}
        route={{
          tag: "SINGLE",
          taskIds: ["task-preview"],
          focus: {
            metric: "role-template-rework-rate@2.0.0",
            side: "single",
          },
        }}
      />,
    );

    const focused = await screen.findByRole("article", {
      name: "role-template-rework-rate@2.0.0",
    });
    expect(focused.closest(".dashboard-panel")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByRole("region", { name: "Metric Results" }),
    ).toBeVisible();
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

  it("opens Catalog-backed metric explanation and restores its trigger", async () => {
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

    const trigger = (
      await screen.findAllByRole("button", {
        name: "Metric explanation",
      })
    )[0]!;
    await user.click(trigger);
    expect(
      screen.getByRole("dialog", { name: "Metric explanation" }),
    ).toHaveTextContent("Do not infer template, reviewer, or writer causality");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("navigates from a Result to exact Evidence scope identity", async () => {
    const onNavigate = vi.fn();
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
        onNavigate={onNavigate}
        route={{ tag: "SINGLE", taskIds: ["task-preview"] }}
      />,
    );

    await user.click(
      (await screen.findAllByRole("button", { name: "View evidence" }))[0]!,
    );
    expect(onNavigate).toHaveBeenCalledWith({
      tag: "EVIDENCE",
      selection: { tag: "SINGLE", taskIds: ["task-preview"] },
      metric: "role-template-rework-rate@2.0.0",
      side: "single",
      scope: "result",
    });
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

  it("does not let an older route request overwrite the current result", async () => {
    let resolveOld: ((result: EvolutionResult) => void) | undefined;
    const oldRequest = new Promise<EvolutionResult>((resolve) => {
      resolveOld = resolve;
    });
    const computeSingle = vi.fn((taskIds: readonly string[]) =>
      taskIds[0] === "task-old"
        ? oldRequest
        : Promise.resolve({ ok: true as const, value: singleResponse("2/3") }),
    );
    const evolution = { computeSingle, computeCompare: vi.fn() };
    const { rerender } = render(
      <EvaluationWorkspace
        evolution={evolution}
        route={{ tag: "SINGLE", taskIds: ["task-old"] }}
      />,
    );
    await vi.waitFor(() => expect(computeSingle).toHaveBeenCalledOnce());

    rerender(
      <EvaluationWorkspace
        evolution={evolution}
        route={{ tag: "SINGLE", taskIds: ["task-current"] }}
      />,
    );
    expect((await screen.findAllByText("66.67%"))[0]).toBeVisible();
    await act(async () => {
      resolveOld?.({ ok: true, value: singleResponse("1/3") });
      await oldRequest;
    });
    await vi.waitFor(() => expect(computeSingle).toHaveBeenCalledTimes(2));

    expect(screen.queryByText("33.33%")).toBeNull();
    expect(screen.getAllByText("66.67%")[0]).toBeVisible();
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

  it("exposes each compare receipt and side-specific Evidence identity", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <EvaluationWorkspace
        evolution={{
          computeSingle: vi.fn(),
          computeCompare: vi.fn(async () => ({
            ok: true as const,
            value: compareResponse(),
          })),
        }}
        onNavigate={onNavigate}
        route={{
          tag: "COMPARE",
          leftTaskIds: ["task-before"],
          rightTaskIds: ["task-after"],
        }}
      />,
    );

    expect(
      await screen.findByRole("button", { name: "View Before receipt" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "View After receipt" }),
    ).toBeVisible();
    const before = screen.getAllByRole("region", { name: "Before result" })[0]!;
    await user.click(
      within(before).getByRole("button", { name: "View evidence" }),
    );
    expect(onNavigate).toHaveBeenCalledWith({
      tag: "EVIDENCE",
      selection: {
        tag: "COMPARE",
        leftTaskIds: ["task-before"],
        rightTaskIds: ["task-after"],
      },
      metric: "role-template-rework-rate@2.0.0",
      side: "left",
      scope: "result",
    });
  });

  it("navigates an exact compare metric without ranking it", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <EvaluationWorkspace
        evolution={{
          computeSingle: vi.fn(),
          computeCompare: vi.fn(async () => ({
            ok: true as const,
            value: compareResponse(),
          })),
        }}
        onNavigate={onNavigate}
        route={{
          tag: "COMPARE",
          leftTaskIds: ["task-before"],
          rightTaskIds: ["task-after"],
        }}
      />,
    );

    await user.click(
      await screen.findByRole("button", {
        name: /delivery-cycle-time-ms@2.0.0/,
      }),
    );
    expect(onNavigate).toHaveBeenCalledWith({
      tag: "COMPARE",
      leftTaskIds: ["task-before"],
      rightTaskIds: ["task-after"],
      focus: {
        metric: "delivery-cycle-time-ms@2.0.0",
        side: "left",
      },
    });
    expect(screen.queryByText(/winner|rank/i)).toBeNull();
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
