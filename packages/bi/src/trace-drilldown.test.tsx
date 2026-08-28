import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EvaluationRoute } from "./domain/navigation/evaluation-route";
import type { EvidenceResult, TracesPage } from "./domain/evidence/types";
import { TraceDrilldown } from "./trace-drilldown";

const route = (
  traceId: string,
): Extract<EvaluationRoute, { tag: "TRACE" }> => ({
  tag: "TRACE",
  selection: { tag: "SINGLE", taskIds: ["task-a"] },
  traceId,
  side: "single",
  metric: "delivery-cycle-time-ms@2.0.0",
  scope: "result",
});

const page = (traceId: string, label: string): TracesPage => ({
  contract: { name: "evidence.query", revision: "0.1.0" },
  observation_profile: "1.0.0",
  read_model_revision: "1.0.0",
  snapshot: `snapshot-${label}`,
  next_cursor: null,
  trace_state: "AVAILABLE",
  trace_summaries: [{ trace_id: traceId, state: "AVAILABLE" }],
  items: [
    {
      id: `node-${label}`,
      trace_id: traceId,
      kind: "NODE",
      source: { kind: "SPAN", trace_id: traceId, span_id: "b".repeat(16) },
      recorded_at: "2026-08-28T00:00:00Z",
      truth: {
        completeness: "FINAL",
        availability: "AVAILABLE",
        expiry: "ACTIVE",
        expires_at: null,
      },
      node: {
        span_id: "b".repeat(16),
        span_name: label,
        span_kind: "INTERNAL",
        start_time_unix_nano: "1",
        end_time_unix_nano: "2",
        span_status: "OK",
        span_flags: 1,
        trace_state: null,
        fields: [],
      },
      edge: null,
    },
  ],
});

describe("Trace drill-down request ownership", () => {
  it("does not let an older Trace response replace the current route", async () => {
    const traceA = "a".repeat(32);
    const traceC = "c".repeat(32);
    let resolveA!: (value: EvidenceResult<TracesPage>) => void;
    let resolveC!: (value: EvidenceResult<TracesPage>) => void;
    const getTracesPage = vi.fn(
      ({ trace_id }: { trace_id: string }) =>
        new Promise<EvidenceResult<TracesPage>>((resolve) => {
          if (trace_id === traceA) resolveA = resolve;
          else resolveC = resolve;
        }),
    );
    const { rerender } = render(
      <TraceDrilldown
        evidence={{ getTracesPage }}
        onNavigate={vi.fn()}
        route={route(traceA)}
      />,
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    rerender(
      <TraceDrilldown
        evidence={{ getTracesPage }}
        onNavigate={vi.fn()}
        route={route(traceC)}
      />,
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    await act(async () =>
      resolveC({ ok: true, value: page(traceC, "current") }),
    );
    expect(
      await screen.findByRole("button", { name: /current/ }),
    ).toBeVisible();
    await act(async () => resolveA({ ok: true, value: page(traceA, "stale") }));
    expect(
      screen.queryByRole("button", { name: /stale/ }),
    ).not.toBeInTheDocument();
  });
});
