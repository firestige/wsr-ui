import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "./app";

describe("BI component preview", () => {
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
      expect(within(matrix).getByText(label)).toBeVisible();
    }
    expect(within(matrix).queryByText(/^Partial$/)).toBeNull();
  });

  it("previews semantic D3 and recorded-structure foundations", () => {
    render(<App />);

    expect(
      screen.getByRole("img", { name: "Factual trend preview" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Recorded trace preview" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Recorded structure" }),
    ).toBeVisible();
    expect(screen.getByText("Mode: Still")).toBeVisible();
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
