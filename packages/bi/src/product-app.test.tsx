import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EvolutionResult } from "./domain/evolution/types";
import type { TaskPage, TaskResult } from "./domain/evidence/task-client";
import type { TracesPage } from "./domain/evidence/types";
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
  it("keeps active records available while marking a partial Trace-level hole", async () => {
    const traceId = "a".repeat(32);
    const spanId = "b".repeat(16);
    const tracePage: TracesPage = {
      contract: { name: "evidence.query", revision: "0.1.0" },
      observation_profile: "1.0.0",
      read_model_revision: "1.0.0",
      snapshot: "trace-snapshot",
      next_cursor: null,
      trace_state: "PARTIAL",
      trace_summaries: [{ trace_id: traceId, state: "PARTIAL" }],
      items: [
        {
          id: `node-${spanId}`,
          trace_id: traceId,
          kind: "NODE",
          source: { kind: "SPAN", trace_id: traceId, span_id: spanId },
          recorded_at: "2026-08-28T10:00:00Z",
          truth: {
            completeness: "FINAL",
            availability: "AVAILABLE",
            expiry: "ACTIVE",
            expires_at: null,
          },
          node: {
            span_id: spanId,
            span_name: "Root invocation",
            span_kind: "INTERNAL",
            start_time_unix_nano: "100",
            end_time_unix_nano: "200",
            span_status: "OK",
            span_flags: 1,
            trace_state: null,
            fields: [],
          },
          edge: null,
        },
        {
          id: "parent-missing",
          trace_id: traceId,
          kind: "PARENT_EDGE",
          source: { kind: "SPAN", trace_id: traceId, span_id: spanId },
          recorded_at: "2026-08-28T10:00:00Z",
          truth: {
            completeness: "FINAL",
            availability: "AVAILABLE",
            expiry: "ACTIVE",
            expires_at: null,
          },
          node: null,
          edge: {
            from: { trace_id: traceId, span_id: spanId },
            to: { trace_id: traceId, span_id: "c".repeat(16) },
          },
        },
      ],
    };
    render(
      <ProductApp
        evidence={{
          getFactsPage: vi.fn(),
          getTracesPage: vi
            .fn()
            .mockResolvedValue({ ok: true, value: tracePage }),
        }}
        evolution={{ computeSingle: vi.fn(), computeCompare: vi.fn() }}
        initialRelativeUrl={`/evaluate/trace/${traceId}?v=1&task=task-a&span=${spanId}&metric=delivery-cycle-time-ms%402.0.0&side=single&scope=result`}
        tasks={{ getPage: vi.fn() }}
      />,
    );

    expect(
      await screen.findByRole("button", { name: /Root invocation/ }),
    ).toBeVisible();
    expect(screen.getByText("Mode: Still")).toBeVisible();
    expect(screen.getByText(/known data hole/i)).toBeVisible();
    expect(
      screen.getAllByText("Unresolved recorded endpoint"),
    ).not.toHaveLength(0);
    expect(
      screen.queryByText("Partial recorded detail"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Recorded parent relation/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Missing endpoint/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Back to Evidence" }),
    ).toBeVisible();
  });

  it("places the main-content skip link first in keyboard order", async () => {
    const user = userEvent.setup();
    render(
      <ProductApp
        evidence={{ getFactsPage: vi.fn() }}
        evolution={{ computeSingle: vi.fn(), computeCompare: vi.fn() }}
        initialRelativeUrl="/evaluate"
        tasks={{
          getPage: vi.fn(async () => ({ ok: true as const, value: taskPage })),
        }}
      />,
    );

    await user.tab();
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus();
    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main-content");
  });

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
        evidence={{ getFactsPage: vi.fn() }}
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

  it("loads bounded Task pages and searches name or exact ID", async () => {
    const getPage = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: { ...taskPage, items: [taskPage.items[0]], next_cursor: "next" },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: { ...taskPage, items: [taskPage.items[1]], next_cursor: null },
      });
    const user = userEvent.setup();
    render(
      <ProductApp
        evidence={{ getFactsPage: vi.fn() }}
        evolution={{ computeSingle: vi.fn(), computeCompare: vi.fn() }}
        initialRelativeUrl="/evaluate"
        tasks={{ getPage }}
      />,
    );

    expect(await screen.findByText("Baseline run")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Load more Tasks" }));
    expect(await screen.findByText("task-b")).toBeVisible();
    expect(getPage).toHaveBeenLastCalledWith({ limit: 100, cursor: "next" });
    await user.type(screen.getByLabelText("Search Tasks"), "Baseline");
    expect(screen.getByText("Baseline run")).toBeVisible();
    expect(screen.queryByText("task-b")).toBeNull();
  });

  it("retries a failed Task discovery without losing the route", async () => {
    window.history.replaceState(null, "", "/evaluate");
    const getPage = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: "ERROR", reason: "NETWORK" },
      })
      .mockResolvedValueOnce({ ok: true, value: taskPage });
    const user = userEvent.setup();
    render(
      <ProductApp
        evidence={{ getFactsPage: vi.fn() }}
        evolution={{ computeSingle: vi.fn(), computeCompare: vi.fn() }}
        initialRelativeUrl="/evaluate"
        tasks={{ getPage }}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("NETWORK");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Baseline run")).toBeVisible();
    expect(window.location.pathname).toBe("/evaluate");
  });

  it("builds independent left and right compare selections", async () => {
    const computeCompare = vi.fn(async (): Promise<EvolutionResult> => ({
      ok: false,
      error: { kind: "ERROR", reason: "NETWORK" },
    }));
    const user = userEvent.setup();
    render(
      <ProductApp
        evidence={{ getFactsPage: vi.fn() }}
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

  it("enforces the documented 24 Task per-side bound before navigation", async () => {
    const manyTasks: TaskPage = {
      ...taskPage,
      items: Array.from({ length: 25 }, (_, index) => ({
        task_id: `task-${String(index).padStart(2, "0")}`,
        display_name: null,
        provenance: {
          accepted_digest: index.toString(16).padStart(64, "0"),
          profile_version: "2.0.0" as const,
          source: { kind: "EVENT" as const, event_id: `event-${index}` },
        },
      })),
    };
    const user = userEvent.setup();
    render(
      <ProductApp
        evidence={{ getFactsPage: vi.fn() }}
        evolution={{ computeSingle: vi.fn(), computeCompare: vi.fn() }}
        initialRelativeUrl="/evaluate"
        tasks={{
          getPage: vi.fn(async () => ({ ok: true as const, value: manyTasks })),
        }}
      />,
    );

    const choices = await screen.findAllByRole("checkbox");
    for (const choice of choices.slice(0, 24)) await user.click(choice);
    expect(choices[24]).toBeDisabled();
    expect(screen.getByText(/24 Task limit per side/)).toBeVisible();
  });

  it("fails closed without querying services for an invalid deep link", () => {
    const getPage = vi.fn();
    const computeSingle = vi.fn();
    render(
      <ProductApp
        evidence={{ getFactsPage: vi.fn() }}
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
