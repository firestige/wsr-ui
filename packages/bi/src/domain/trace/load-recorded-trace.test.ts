import { describe, expect, it, vi } from "vitest";

import type { EvidenceResult, TracesPage } from "../evidence/types";
import { loadRecordedTrace } from "./load-recorded-trace";

const page = (
  snapshot: string,
  next_cursor: string | null,
  items: TracesPage["items"] = [],
): TracesPage => ({
  contract: { name: "evidence.query", revision: "0.1.0" },
  observation_profile: "1.0.0",
  read_model_revision: "1.0.0",
  snapshot,
  next_cursor,
  trace_state: "AVAILABLE",
  trace_summaries: [],
  items,
});

describe("recorded Trace bounded loading", () => {
  it("does not project until every page from the same snapshot is loaded", async () => {
    const getTracesPage = vi
      .fn<
        (filters: {
          trace_id: string;
          limit: number;
          cursor?: string;
        }) => Promise<EvidenceResult<TracesPage>>
      >()
      .mockResolvedValueOnce({
        ok: true,
        value: page("snapshot-a", "cursor-2"),
      })
      .mockResolvedValueOnce({ ok: true, value: page("snapshot-a", null) });

    const result = await loadRecordedTrace({ getTracesPage }, "a".repeat(32));

    expect(result).toMatchObject({ ok: true, state: "AVAILABLE", pages: 2 });
    expect(getTracesPage).toHaveBeenNthCalledWith(2, {
      trace_id: "a".repeat(32),
      limit: 200,
      cursor: "cursor-2",
    });
  });

  it("fails closed on snapshot drift, duplicate identity, or configured bounds", async () => {
    const drift = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: page("snapshot-a", "cursor-2"),
      })
      .mockResolvedValueOnce({ ok: true, value: page("snapshot-b", null) });
    expect(
      await loadRecordedTrace({ getTracesPage: drift }, "a".repeat(32)),
    ).toEqual({
      ok: false,
      reason: "TRACE_SNAPSHOT_DRIFT",
    });

    const bounded = vi.fn().mockResolvedValue({
      ok: true,
      value: page("snapshot-a", "another-cursor"),
    });
    expect(
      await loadRecordedTrace({ getTracesPage: bounded }, "a".repeat(32), {
        maximumPages: 1,
      }),
    ).toEqual({ ok: false, reason: "TRACE_PAGE_BOUND_EXCEEDED" });
  });

  it("maps physically deleted or historical expired detail to absent without items", async () => {
    const deleted = page("snapshot-a", null);
    deleted.trace_state = "EXPIRED";
    const result = await loadRecordedTrace(
      {
        getTracesPage: vi.fn().mockResolvedValue({ ok: true, value: deleted }),
      },
      "a".repeat(32),
    );
    expect(result).toEqual({
      ok: true,
      state: "ABSENT",
      pages: 1,
      snapshot: "snapshot-a",
    });
  });
});
