import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActiveScenario } from "./scenario";
import { TestHarness } from "./test-harness";

describe("WSR UI test SPA", () => {
  it("mounts the trace statistics inspection scenario in the reusable shell", () => {
    render(
      <TestHarness>
        <ActiveScenario />
      </TestHarness>,
    );

    expect(
      screen.getByRole("main", { name: "WSR UI component test harness" }),
    ).toBeVisible();
    const statistics = screen.getByRole("region", {
      name: "Recorded trace statistics",
    });
    expect(screen.getByTestId("trace-statistics")).toBe(statistics);
    expect(statistics).toHaveTextContent("Recorded spans12");
    expect(statistics).toHaveTextContent("Recorded links2");
    expect(statistics).toHaveTextContent("ERROR spans3");
    expect(statistics).toHaveTextContent("Maximum recorded duration1.79 s");
    expect(statistics).not.toHaveTextContent(/\b(?:ns|μs)\b/);
    expect(statistics).toHaveTextContent("Recorded status inventory");
    expect(statistics).toHaveTextContent("Recorded kind inventory");
    expect(statistics).toHaveTextContent("Recorded duration by kind");
    expect(statistics).toHaveTextContent("Recorded duration distribution");
    expect(
      screen.getByRole("img", {
        name: "Recorded kind inventory pie chart",
      }),
    ).toHaveAttribute("data-chart-type", "pie");
    expect(
      screen.getByRole("img", {
        name: "Recorded duration by kind horizontal bar chart",
      }),
    ).toHaveAttribute("data-chart-type", "horizontal-bar");
    expect(
      screen
        .getByRole("img", {
          name: "Recorded duration distribution vertical bar chart",
        })
        .querySelectorAll(".trace-duration-column"),
    ).toHaveLength(5);
    expect(
      screen
        .getByRole("img", {
          name: "Recorded duration distribution vertical bar chart",
        })
        .querySelectorAll(".trace-duration-column[data-topic]"),
    ).toHaveLength(4);
    expect(
      [...document.querySelectorAll(".trace-duration-column[data-topic]")].map(
        (segment) => segment.getAttribute("data-topic"),
      ),
    ).toEqual([
      "Request & policy",
      "Data access",
      "Result metrics",
      "Response & telemetry",
    ]);
    const breakdowns = [
      "Request & policy",
      "Data access",
      "Result metrics",
      "Response & telemetry",
    ].map((topic) =>
      screen.getByRole("img", {
        name: `Recorded duration ${topic} donut chart`,
      }),
    );
    expect(breakdowns).toHaveLength(4);
    expect(
      breakdowns.reduce(
        (count, breakdown) =>
          count +
          breakdown.querySelectorAll(".trace-statistics-donut-segment").length,
        0,
      ),
    ).toBe(11);
  });
});
