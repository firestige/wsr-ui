import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FactsPage } from "./domain/evidence/types";
import type { SingleResponse } from "./domain/evolution/types";
import { EvidenceDrilldown } from "./evidence-drilldown";
import { previewReceipt, previewSlice } from "./preview-fixtures";

const digest = "a".repeat(64);

const facts: FactsPage = {
  contract: { name: "evidence.query", revision: "0.1.0" },
  observation_profile: "1.0.0",
  read_model_revision: "1.0.0",
  snapshot: "facts-1",
  next_cursor: null,
  items: [
    {
      id: "fact-1",
      kind: "EVENT_CONTRIBUTION",
      source: { kind: "EVENT", event_id: "event-1" },
      recorded_at: "2026-08-28T01:00:00.000000Z",
      provenance: {
        accepted_digest: digest,
        profile_version: "1.0.0",
        family_schema: "delivery.summary@1",
        owner_key: ["delivery-a"],
      },
      compatibility: {
        family_schema: "delivery.summary@1",
        event_name: "delivery.summary",
        completeness: "FINAL",
        dimensions: [{ field: "delivery_id", value: "delivery-a" }],
      },
      truth: {
        completeness: "FINAL",
        availability: "AVAILABLE",
        expiry: "ACTIVE",
        expires_at: null,
      },
      fields: [],
      relationships: [],
    },
  ],
};

function response(deliveryId = "delivery-a"): SingleResponse {
  return {
    api_version: 1,
    mode: "SINGLE",
    result: {
      tag: "SIDE_RESULT",
      receipt: {
        ...previewReceipt,
        task_population: [
          {
            ...previewReceipt.task_population[0]!,
            memberships: [
              {
                delivery_id: deliveryId,
                manifest_digest: "b".repeat(64),
                accepted_digest: "c".repeat(64),
                profile_version: "2.0.0",
                source_identity: "event:manifest",
                recorded_at: "2026-08-28T00:00:00.000000Z",
              },
            ],
          },
        ],
      },
      metric_results: [
        {
          metric_id: "delivery-cycle-time-ms",
          metric_version: "2.0.0",
          slices: [{ ...previewSlice, provenance_refs: [digest] }],
        },
      ],
    },
  };
}

describe("Evidence drill-down", () => {
  it("re-resolves selection, queries Evidence Facts, and filters result lineage", async () => {
    const getPage = vi.fn(async () => ({ ok: true as const, value: facts }));
    render(
      <EvidenceDrilldown
        evidence={{ getFactsPage: getPage }}
        evolution={{
          computeSingle: vi.fn(async () => ({
            ok: true as const,
            value: response(),
          })),
          computeCompare: vi.fn(),
        }}
        route={{
          tag: "EVIDENCE",
          selection: { tag: "SINGLE", taskIds: ["task-preview"] },
          metric: "delivery-cycle-time-ms@2.0.0",
          side: "single",
          scope: "result",
          factId: "fact-1",
        }}
      />,
    );

    expect(await screen.findByText("fact-1")).toBeVisible();
    expect(screen.getByText("fact-1").closest("tr")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(getPage).toHaveBeenCalledWith({
      delivery_id: "delivery-a",
      limit: 200,
    });
    expect(screen.getAllByText(digest)[0]).toBeVisible();
  });

  it("keeps non-Fact result lineage visible when a Facts query cannot hydrate it", async () => {
    const value = response();
    value.result.receipt = {
      ...value.result.receipt,
      input_refs: [
        {
          kind: "TRACE_NODE",
          identity: "trace-a/span-a",
          provenance_ref: "trace-provenance-a",
        },
      ],
    };
    value.result.metric_results[0]!.slices[0] = {
      ...value.result.metric_results[0]!.slices[0]!,
      provenance_refs: ["trace-provenance-a"],
    };
    render(
      <EvidenceDrilldown
        evidence={{
          getFactsPage: vi.fn(async () => ({
            ok: true as const,
            value: { ...facts, items: [] },
          })),
        }}
        evolution={{
          computeSingle: vi.fn(async () => ({ ok: true as const, value })),
          computeCompare: vi.fn(),
        }}
        route={{
          tag: "EVIDENCE",
          selection: { tag: "SINGLE", taskIds: ["task-preview"] },
          metric: "delivery-cycle-time-ms@2.0.0",
          side: "single",
          scope: "result",
        }}
      />,
    );

    expect(await screen.findByText("TRACE_NODE")).toBeVisible();
    expect(screen.getByText("trace-a/span-a")).toBeVisible();
    expect(screen.getByText("trace-provenance-a")).toBeVisible();
    expect(
      screen.getByText("Identity retained; detail not loaded by Facts query"),
    ).toBeVisible();
    expect(screen.queryByText("No Evidence in this scope")).toBeNull();
    expect(screen.queryByText("Evidence detail expired")).toBeNull();
  });

  it("does not let an older drill-down request replace the current route", async () => {
    let resolveOld:
      ((value: { ok: true; value: SingleResponse }) => void) | undefined;
    const oldRequest = new Promise<{ ok: true; value: SingleResponse }>(
      (resolve) => {
        resolveOld = resolve;
      },
    );
    const computeSingle = vi.fn((taskIds: readonly string[]) =>
      taskIds[0] === "task-old"
        ? oldRequest
        : Promise.resolve({ ok: true as const, value: response("delivery-b") }),
    );
    const getFactsPage = vi.fn(
      async ({ delivery_id }: { delivery_id?: string }) => ({
        ok: true as const,
        value: {
          ...facts,
          items: facts.items.map((item) => ({
            ...item,
            id: delivery_id === "delivery-b" ? "fact-current" : "fact-old",
          })),
        },
      }),
    );
    const evolution = { computeSingle, computeCompare: vi.fn() };
    const evidence = { getFactsPage };
    const route = {
      tag: "EVIDENCE" as const,
      metric: "delivery-cycle-time-ms@2.0.0" as const,
      side: "single" as const,
      scope: "result" as const,
    };
    const { rerender } = render(
      <EvidenceDrilldown
        evidence={evidence}
        evolution={evolution}
        route={{
          ...route,
          selection: { tag: "SINGLE", taskIds: ["task-old"] },
        }}
      />,
    );
    await vi.waitFor(() => expect(computeSingle).toHaveBeenCalledOnce());

    rerender(
      <EvidenceDrilldown
        evidence={evidence}
        evolution={evolution}
        route={{
          ...route,
          selection: { tag: "SINGLE", taskIds: ["task-current"] },
        }}
      />,
    );
    expect(await screen.findByText("fact-current")).toBeVisible();
    await act(async () => {
      resolveOld?.({ ok: true, value: response("delivery-old") });
      await oldRequest;
    });

    expect(screen.queryByText("fact-old")).toBeNull();
    expect(screen.getByText("fact-current")).toBeVisible();
  });
});
