import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CATALOG_COORDINATES } from "../domain/evolution/client";
import type { MetricResult } from "../domain/evolution/types";
import { PRESET_LAYOUTS } from "../domain/layout/layout";
import { previewSlice } from "../preview-fixtures";
import { DashboardComposer } from "./dashboard-composer";

const results: MetricResult[] = CATALOG_COORDINATES.map((coordinate) => ({
  metric_id: coordinate.slice(0, coordinate.lastIndexOf("@")),
  metric_version: "2.0.0",
  slices: [
    {
      ...previewSlice,
      value: { kind: "RATIO", value: "3/4", unit: "ratio" },
    },
  ],
}));

describe("bounded dashboard composer", () => {
  it("is flat at rest and saves a closed local binding", async () => {
    const apply = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardComposer
        layout={PRESET_LAYOUTS["default-overview@1"]}
        onApply={apply}
        results={results}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Edit dashboard" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Edit dashboard" }));
    const panel = screen.getByRole("group", { name: "Edit panel rework" });
    await user.selectOptions(
      within(panel).getByLabelText("Visualizer"),
      "table@1",
    );
    await user.selectOptions(
      within(panel).getByLabelText("Panel size"),
      "WIDE",
    );
    await user.clear(screen.getByLabelText("Layout name"));
    await user.type(screen.getByLabelText("Layout name"), "My local view");
    await user.click(screen.getByRole("button", { name: "Save local layout" }));

    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        layout_version: 1,
        name: "My local view",
        panels: expect.arrayContaining([
          expect.objectContaining({
            panel_id: "rework",
            visualizer: "table@1",
            size: "WIDE",
            channels: { "published-result": "slices" },
          }),
        ]),
      }),
    );
  });

  it("fails a future or open import without replacing the layout", async () => {
    const apply = vi.fn();
    const user = userEvent.setup();
    render(
      <DashboardComposer
        layout={PRESET_LAYOUTS["default-overview@1"]}
        onApply={apply}
        results={results}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit dashboard" }));
    fireEvent.change(screen.getByLabelText("Layout JSON"), {
      target: {
        value: JSON.stringify({
          layout_version: 2,
          name: "Future",
          panels: [],
        }),
      },
    });
    await user.click(screen.getByRole("button", { name: "Import JSON" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Layout does not match closed version 1",
    );
    expect(apply).not.toHaveBeenCalled();
  });
});
