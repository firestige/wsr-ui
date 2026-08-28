import { render, screen } from "@testing-library/react";
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

function response(): SingleResponse {
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
                delivery_id: "delivery-a",
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
    expect(screen.getByText(digest)).toBeVisible();
  });
});
