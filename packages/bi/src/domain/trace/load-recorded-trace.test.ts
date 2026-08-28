import { describe, expect, it, vi } from "vitest";

import type { EvidenceResult, TraceItem, TracesPage } from "../evidence/types";
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
  trace_summaries: [{ trace_id: "a".repeat(32), state: "AVAILABLE" }],
  items,
});

const node = (id: string, spanId: string): TraceItem => ({
  id,
  trace_id: "a".repeat(32),
  kind: "NODE",
  source: { kind: "SPAN", trace_id: "a".repeat(32), span_id: spanId },
  recorded_at: "2026-08-28T00:00:00Z",
  truth: {
    completeness: "FINAL",
    availability: "AVAILABLE",
    expiry: "ACTIVE",
    expires_at: null,
  },
  node: {
    span_id: spanId,
    span_name: id,
    span_kind: "INTERNAL",
    start_time_unix_nano: "1",
    end_time_unix_nano: "2",
    span_status: "OK",
    span_flags: 1,
    trace_state: null,
    fields: [],
  },
  edge: null,
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

  it("rejects Trace summary/state drift before projection", async () => {
    const first = page("snapshot-a", "cursor-2");
    first.trace_state = "PARTIAL";
    first.trace_summaries = [{ trace_id: "a".repeat(32), state: "PARTIAL" }];
    const second = page("snapshot-a", null);
    const getTracesPage = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, value: first })
      .mockResolvedValueOnce({ ok: true, value: second });

    expect(await loadRecordedTrace({ getTracesPage }, "a".repeat(32))).toEqual({
      ok: false,
      reason: "TRACE_SUMMARY_DRIFT",
    });
  });

  it("rejects repeated cursors and canonical identities before projection", async () => {
    const repeatedCursor = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        value: page("snapshot-a", "cursor-2"),
      })
      .mockResolvedValueOnce({
        ok: true,
        value: page("snapshot-a", "cursor-2"),
      });
    await expect(
      loadRecordedTrace({ getTracesPage: repeatedCursor }, "a".repeat(32)),
    ).resolves.toEqual({ ok: false, reason: "TRACE_CURSOR_REPEATED" });

    const duplicatedNode = vi.fn().mockResolvedValue({
      ok: true,
      value: page("snapshot-a", null, [
        node("record-a", "b".repeat(16)),
        node("record-b", "b".repeat(16)),
      ]),
    });
    await expect(
      loadRecordedTrace({ getTracesPage: duplicatedNode }, "a".repeat(32)),
    ).resolves.toEqual({
      ok: false,
      reason: "TRACE_DUPLICATE_CANONICAL_IDENTITY",
    });
  });

  it("rejects wrong Trace items and preserves cursor-expiry recovery code", async () => {
    const wrongTrace = node("record-a", "b".repeat(16));
    wrongTrace.trace_id = "c".repeat(32);
    const getWrongTrace = vi.fn().mockResolvedValue({
      ok: true,
      value: page("snapshot-a", null, [wrongTrace]),
    });
    await expect(
      loadRecordedTrace({ getTracesPage: getWrongTrace }, "a".repeat(32)),
    ).resolves.toEqual({ ok: false, reason: "TRACE_IDENTITY_MISMATCH" });

    const cursorExpired = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        kind: "UPSTREAM",
        code: "CURSOR_EXPIRED",
        message: "restart from the first page",
      },
    });
    await expect(
      loadRecordedTrace({ getTracesPage: cursorExpired }, "a".repeat(32)),
    ).resolves.toEqual({ ok: false, reason: "CURSOR_EXPIRED" });
  });

  it("maps physically deleted or historical expired detail to absent without items", async () => {
    const deleted = page("snapshot-a", null);
    deleted.trace_state = "EXPIRED";
    deleted.trace_summaries = [{ trace_id: "a".repeat(32), state: "EXPIRED" }];
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
