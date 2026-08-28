import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EvolutionResult } from "./domain/evolution/types";
import type { TaskPage, TaskResult } from "./domain/evidence/task-client";
import { ProductApp } from "./product-app";

const taskPage: TaskPage = {
  contract: { name: "evidence.query", revision: "1.0.0" },
  observation_profile: "2.0.0",
  read_model_revision: "2.0.0",
  snapshot: "task-list-snapshot",
  items: [
    {
      task_id: "task-a",
      display_name: "Baseline run",
      provenance: {
        accepted_digest: "a".repeat(64),
        profile_version: "2.0.0",
        source: { kind: "EVENT", event_id: "event-a" },
      },
    },
    {
      task_id: "task-b",
      display_name: null,
      provenance: {
        accepted_digest: "b".repeat(64),
        profile_version: "2.0.0",
        source: { kind: "EVENT", event_id: "event-b" },
      },
    },
  ],
  next_cursor: null,
};

afterEach(() => window.history.replaceState(null, "", "/preview"));

describe("BI product route", () => {
  it("uses display name for reading and Task ID for navigation identity", async () => {
    const getPage = vi.fn(async (): Promise<TaskResult> => ({
      ok: true,
      value: taskPage,
    }));
    const computeSingle = vi.fn(async (): Promise<EvolutionResult> => ({
      ok: false,
      error: { kind: "ERROR", reason: "NETWORK" },
    }));
    const user = userEvent.setup();
    render(
      <ProductApp
        evolution={{ computeSingle, computeCompare: vi.fn() }}
        initialRelativeUrl="/evaluate"
        tasks={{ getPage }}
      />,
    );

    expect(await screen.findByText("Baseline run")).toBeVisible();
    expect(screen.getAllByText("task-a").length).toBeGreaterThan(0);
    expect(screen.getByText("task-b")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: /Baseline run/ }));
    await user.click(
      screen.getByRole("button", { name: "Evaluate selection" }),
    );

    expect(window.location.pathname + window.location.search).toBe(
      "/evaluate?v=1&task=task-a",
    );
    expect(computeSingle).toHaveBeenCalledWith(["task-a"]);
  });

  it("builds independent left and right compare selections", async () => {
    const computeCompare = vi.fn(async (): Promise<EvolutionResult> => ({
      ok: false,
      error: { kind: "ERROR", reason: "NETWORK" },
    }));
    const user = userEvent.setup();
    render(
      <ProductApp
        evolution={{ computeSingle: vi.fn(), computeCompare }}
        initialRelativeUrl="/evaluate"
        tasks={{
          getPage: vi.fn(async () => ({ ok: true as const, value: taskPage })),
        }}
      />,
    );

    await user.click(await screen.findByRole("radio", { name: "Compare" }));
    await user.click(
      screen.getByRole("checkbox", { name: /Before.*Baseline run/ }),
    );
    await user.click(screen.getByRole("checkbox", { name: /After.*task-b/ }));
    await user.click(
      screen.getByRole("button", { name: "Compare selections" }),
    );

    expect(window.location.search).toBe(
      "?v=1&mode=compare&left_task=task-a&right_task=task-b",
    );
    expect(computeCompare).toHaveBeenCalledWith(["task-a"], ["task-b"]);
  });

  it("fails closed without querying services for an invalid deep link", () => {
    const getPage = vi.fn();
    const computeSingle = vi.fn();
    render(
      <ProductApp
        evolution={{ computeSingle, computeCompare: vi.fn() }}
        initialRelativeUrl="/evaluate?v=9&task=task-a"
        tasks={{ getPage }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Invalid evaluation link",
    );
    expect(getPage).not.toHaveBeenCalled();
    expect(computeSingle).not.toHaveBeenCalled();
  });
});
