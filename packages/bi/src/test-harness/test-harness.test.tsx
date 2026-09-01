import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActiveScenario } from "./scenario";
import { TestHarness } from "./test-harness";

describe("WSR UI test SPA", () => {
  it("mounts replaceable scenario content in the reusable shell", () => {
    render(
      <TestHarness>
        <ActiveScenario />
      </TestHarness>,
    );

    expect(
      screen.getByRole("main", { name: "WSR UI component test harness" }),
    ).toBeVisible();
    expect(screen.getByTestId("empty-test-scenario")).toBeVisible();
  });
});
