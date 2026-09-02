import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ActiveScenario } from "./scenario";
import { TestHarness } from "./test-harness";

describe("WSR UI test SPA", () => {
  it("mounts the dashboard inspection scenario in the reusable shell", async () => {
    const user = userEvent.setup();
    render(
      <TestHarness>
        <ActiveScenario />
      </TestHarness>,
    );

    expect(
      screen.getByRole("main", { name: "WSR UI component test harness" }),
    ).toBeVisible();
    const dashboard = screen.getByRole("region", {
      name: "Dashboard inspection",
    });
    expect(screen.getByTestId("dashboard-scenario")).toBe(dashboard);
    expect(
      screen.getByRole("heading", { name: "Agent Operations Dashboard" }),
    ).toBeVisible();
    const header = dashboard.querySelector<HTMLElement>(
      ":scope > .trace-view-header",
    )!;
    expect(
      [...header.querySelectorAll(".trace-view-header-copy > *")].map((item) =>
        item.getAttribute("data-variant"),
      ),
    ).toEqual(["overline", "h2", "caption"]);
    expect(header.querySelector(".trace-view-header-spacer")).not.toBeNull();
    expect(header.querySelector("dl")).toBeNull();
    expect(
      within(header).getByRole("button", { name: "Import dashboard" }),
    ).toHaveAttribute("data-icon-button", "true");
    const edit = screen.getByRole("button", { name: "Edit dashboard" });
    expect(edit).toHaveAttribute("data-icon-button", "true");
    expect(edit).toHaveAttribute("data-testid", "dashboard-edit");
    await user.click(edit);
    expect(
      within(header).getByRole("button", { name: "Save dashboard" }),
    ).toHaveAttribute("data-icon-button", "true");
    expect(screen.getByTestId("dashboard-grid")).toHaveAttribute(
      "data-editing",
      "true",
    );

    const panels = screen.getAllByTestId("dashboard-panel");
    expect(panels).toHaveLength(6);
    expect(
      panels.filter((panel) => panel.dataset.size === "SMALL"),
    ).toHaveLength(2);
    expect(
      panels.filter((panel) => panel.dataset.size === "MEDIUM"),
    ).toHaveLength(2);
    expect(
      panels.filter((panel) => panel.dataset.size === "WIDE"),
    ).toHaveLength(2);
    expect(
      dashboard.querySelectorAll('[data-visualizer="ratio-bar@1"]'),
    ).toHaveLength(3);
    expect(
      dashboard.querySelectorAll('[data-visualizer="numeric-card@1"]'),
    ).toHaveLength(1);
    expect(
      dashboard.querySelectorAll('[data-visualizer="table@1"]'),
    ).toHaveLength(2);
  });
});
