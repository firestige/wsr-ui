import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_MOTION_MODE,
  MotionControl,
  RecordedStructureFoundation,
  type RecordedStructureViewModel,
} from "./recorded-structure";

const structure: RecordedStructureViewModel = {
  depthGroups: [
    {
      depth: 0,
      nodes: [{ id: "root", label: "Root span", state: "AVAILABLE" }],
    },
    {
      depth: 1,
      nodes: [
        { id: "child-a", label: "Writer", state: "AVAILABLE" },
        { id: "child-b", label: "Reviewer", state: "AVAILABLE" },
      ],
    },
  ],
  parentEdges: [
    {
      id: "parent-child-a-root",
      sourceId: "trace-a:child-a",
      targetId: "trace-a:root",
    },
  ],
  links: [
    {
      id: "link-child-a-child-b",
      sourceId: "trace-a:child-a",
      targetId: "trace-b:child-b",
      state: "AVAILABLE",
    },
  ],
  orphans: [{ id: "orphan-a", label: "Missing parent", state: "UNRESOLVED" }],
  selectedId: "child-a",
};

describe("recorded-structure foundations", () => {
  it("defers exact relation and node lists behind a native disclosure", async () => {
    const user = userEvent.setup();
    render(
      <RecordedStructureFoundation model={structure} onSelect={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: /recorded parent relation/i }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByText("Recorded structure exact details", {
        selector: "summary",
      }),
    );
    expect(
      screen.getByRole("button", { name: /recorded parent relation/i }),
    ).toBeVisible();
  });

  it("renders supplied depth siblings together, LINK separately and orphan lane", async () => {
    const user = userEvent.setup();
    render(
      <RecordedStructureFoundation model={structure} onSelect={vi.fn()} />,
    );
    await user.click(
      screen.getByText("Recorded structure exact details", {
        selector: "summary",
      }),
    );

    const depth = screen.getByRole("group", { name: "Recorded depth 1" });
    expect(depth).toHaveTextContent("Writer");
    expect(depth).toHaveTextContent("Reviewer");
    expect(
      screen.getByText("LINK — independent recorded relation"),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Recorded parent structure graph" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: /recorded parent relation trace-a:child-a to trace-a:root/i,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("group", { name: "Orphan endpoints" }),
    ).toHaveTextContent("Missing parent");
    expect(screen.getByText("Unresolved recorded endpoint")).toBeVisible();
    expect(
      screen.queryByText("Expired recorded detail"),
    ).not.toBeInTheDocument();
  });

  it("keeps stable supplied order and keyboard selection", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const { rerender } = render(
      <RecordedStructureFoundation model={structure} onSelect={select} />,
    );
    await user.click(
      screen.getByText("Recorded structure exact details", {
        selector: "summary",
      }),
    );
    const before = screen
      .getAllByRole("button")
      .map((button) => button.textContent);
    rerender(
      <RecordedStructureFoundation model={structure} onSelect={select} />,
    );
    expect(
      screen.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(before);
    await user.click(screen.getByRole("button", { name: /Reviewer/ }));
    expect(select).toHaveBeenCalledWith("child-b");
    await user.click(
      screen.getByRole("button", {
        name: /independent LINK trace-a:child-a to trace-b:child-b/i,
      }),
    );
    expect(select).toHaveBeenCalledWith("link-child-a-child-b");
  });

  it("defaults to Still and exposes no timer or wall-clock input", () => {
    expect(DEFAULT_MOTION_MODE).toBe("STILL");
    expect(Object.keys(structure)).not.toContain("timestamp");
    expect(Object.keys(structure)).not.toContain("arrivalOrder");
  });

  it("supports explicit start, stop and reset controls", async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    const stop = vi.fn();
    const reset = vi.fn();
    const { rerender } = render(
      <MotionControl
        canStart
        mode="STILL"
        onReset={reset}
        onStart={start}
        onStop={stop}
        reducedMotion={false}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Start Live reading" }),
    );
    expect(start).toHaveBeenCalledOnce();

    rerender(
      <MotionControl
        canStart
        mode="LIVE"
        onReset={reset}
        onStart={start}
        onStop={stop}
        reducedMotion={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Stop Live reading" }));
    expect(stop).toHaveBeenCalledOnce();

    rerender(
      <MotionControl
        canStart
        mode="COMPLETE"
        onReset={reset}
        onStart={start}
        onStop={stop}
        reducedMotion={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Reset reading" }));
    expect(reset).toHaveBeenCalledOnce();
  });

  it("forces Still under reduced motion and gives the disabled reason", () => {
    render(
      <MotionControl
        canStart
        mode="STILL"
        onReset={vi.fn()}
        onStart={vi.fn()}
        onStop={vi.fn()}
        reducedMotion
      />,
    );
    expect(
      screen.getByRole("button", { name: "Start Live reading" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/reduced motion keeps the complete structure still/i),
    ).toBeVisible();
  });
});
