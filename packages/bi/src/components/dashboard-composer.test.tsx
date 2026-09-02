import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CATALOG_COORDINATES } from "../domain/evolution/client";
import type { MetricResult } from "../domain/evolution/types";
import { PRESET_LAYOUTS, type DashboardLayout } from "../domain/layout/layout";
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

function ComposerFixture({
  onApply = vi.fn(),
}: {
  onApply?: (layout: DashboardLayout) => void;
}) {
  return (
    <DashboardComposer
      layout={PRESET_LAYOUTS["default-overview@1"]}
      onApply={onApply}
      results={results}
    >
      {({ actions, dashboard }) => (
        <section>
          <header data-testid="dashboard-actions">{actions}</header>
          {dashboard}
        </section>
      )}
    </DashboardComposer>
  );
}

describe("grid dashboard composer", () => {
  it("keeps import and edit in the header and hides editing affordances at rest", () => {
    render(<ComposerFixture />);

    const actions = screen.getByTestId("dashboard-actions");
    expect(screen.getByRole("button", { name: "Import dashboard" })).toBe(
      actions.querySelector('[aria-label="Import dashboard"]'),
    );
    expect(screen.getByRole("button", { name: "Edit dashboard" })).toBe(
      actions.querySelector('[aria-label="Edit dashboard"]'),
    );
    expect(screen.queryByLabelText("Layout name")).toBeNull();
    expect(screen.queryByLabelText("Layout JSON")).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete widget/ })).toBeNull();
    expect(document.querySelector(".react-resizable-handle")).toBeNull();
  });

  it("edits, deletes, and saves entirely through header icon actions", async () => {
    const apply = vi.fn();
    const user = userEvent.setup();
    render(<ComposerFixture onApply={apply} />);

    await user.click(screen.getByRole("button", { name: "Edit dashboard" }));
    const confirm = screen.getByRole("button", { name: "Save dashboard" });
    expect(confirm).toHaveAttribute("data-icon-button", "true");
    expect(confirm.querySelector("svg")).toBeNull();
    expect(confirm.querySelector(".dashboard-confirm-icon")).toHaveClass(
      "icon-[tabler--check]",
    );
    expect(
      screen.getByRole("button", { name: "Cancel editing" }),
    ).toHaveAttribute("data-icon-button", "true");
    const deletes = screen.getAllByRole("button", { name: /Delete widget/ });
    expect(deletes).toHaveLength(6);
    expect(deletes[0]).toHaveAttribute("data-appearance", "ghost");
    expect(deletes[0]!.querySelector("svg")).toBeNull();
    const removeIcon = deletes[0]!.querySelector(".dashboard-remove-icon");
    expect(removeIcon).toHaveClass("icon-[tabler--x]");
    expect(removeIcon).toHaveTextContent("");
    expect(screen.getAllByTestId("dashboard-panel")[0]).toHaveStyle({
      height: "160px",
    });
    await user.click(deletes[0]!);
    expect(screen.getAllByTestId("dashboard-panel")).toHaveLength(5);
    await user.click(screen.getByRole("button", { name: "Save dashboard" }));

    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({ panels: expect.any(Array) }),
    );
    expect(apply.mock.calls[0]![0].panels).toHaveLength(5);
  });

  it("imports through a hidden header file input without rendering a form", async () => {
    const user = userEvent.setup();
    render(<ComposerFixture />);

    const imported = structuredClone(PRESET_LAYOUTS["default-overview@1"]);
    imported.name = "Imported grid";
    imported.panels = imported.panels.slice(0, 2);
    await user.upload(
      screen.getByLabelText("Import dashboard file"),
      new File([JSON.stringify(imported)], "dashboard.json", {
        type: "application/json",
      }),
    );

    expect(screen.getAllByTestId("dashboard-panel")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Save dashboard" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Layout JSON")).toBeNull();
  });
});
