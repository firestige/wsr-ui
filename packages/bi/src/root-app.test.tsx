import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RootApp } from "./root-app";

describe("BI route boundary", () => {
  it("keeps the component catalog at /preview", () => {
    const getPage = vi.fn();
    render(
      <RootApp
        evidence={{ getFactsPage: vi.fn() }}
        evolution={{ computeSingle: vi.fn(), computeCompare: vi.fn() }}
        relativeUrl="/preview"
        tasks={{ getPage }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "BI visual system" }),
    ).toBeVisible();
    expect(getPage).not.toHaveBeenCalled();
  });

  it("uses the product shell for /evaluate", async () => {
    const getPage = vi.fn(async () => ({
      ok: true as const,
      value: {
        contract: {
          name: "evidence.query" as const,
          revision: "1.0.0" as const,
        },
        observation_profile: "2.0.0" as const,
        read_model_revision: "2.0.0" as const,
        snapshot: "task-snapshot",
        items: [],
        next_cursor: null,
      },
    }));
    render(
      <RootApp
        evidence={{ getFactsPage: vi.fn() }}
        evolution={{ computeSingle: vi.fn(), computeCompare: vi.fn() }}
        relativeUrl="/evaluate"
        tasks={{ getPage }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Choose Tasks" })).toBeVisible();
    expect(getPage).toHaveBeenCalledWith({ limit: 100 });
  });
});
