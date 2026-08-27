import { render, screen } from "@testing-library/react";
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

  it("renders named truth states and accessible D3 previews", () => {
    render(<App />);

    expect(screen.getByText("Available")).toBeVisible();
    expect(screen.getByText("Partial")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Factual trend preview" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Recorded trace preview" }),
    ).toBeVisible();
  });
});
