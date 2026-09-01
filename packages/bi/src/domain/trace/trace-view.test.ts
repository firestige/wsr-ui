import { describe, expect, it } from "vitest";

import type { TraceItem, Truth } from "../evidence/types";
import { compileTraceView } from "./trace-view";

const truth: Truth = {
  availability: "AVAILABLE",
  completeness: "FINAL",
  expiry: "ACTIVE",
  expires_at: null,
};

function node(
  id: string,
  start: string,
  end: string,
  recordedAt: string,
): TraceItem {
  return {
    id: `node-${id}`,
    kind: "NODE",
    trace_id: "trace-1",
    source: { kind: "SPAN", trace_id: "trace-1", span_id: id },
    recorded_at: recordedAt,
    truth,
    edge: null,
    node: {
      span_id: id,
      span_name: id === "root" ? "workflow.run" : "tool.execute",
      span_kind: id === "root" ? "INTERNAL" : "CLIENT",
      start_time_unix_nano: start,
      end_time_unix_nano: end,
      span_status: "OK",
      span_flags: id === "root" ? 1 : 257,
      trace_state: id === "root" ? null : "vendor=value",
      fields: [{ field: "wsr.role", value: id }],
    },
  };
}

const parentEdge: TraceItem = {
  id: "parent-child-root",
  kind: "PARENT_EDGE",
  trace_id: "trace-1",
  source: { kind: "SPAN", trace_id: "trace-1", span_id: "child" },
  recorded_at: "2026-09-01T05:26:15.000Z",
  truth,
  node: null,
  edge: {
    from: { trace_id: "trace-1", span_id: "child" },
    to: { trace_id: "trace-1", span_id: "root" },
  },
};

const link: TraceItem = {
  id: "link-child-external",
  kind: "LINK",
  trace_id: "trace-1",
  source: { kind: "SPAN", trace_id: "trace-1", span_id: "child" },
  recorded_at: "2026-09-01T05:26:16.000Z",
  truth,
  node: null,
  edge: {
    from: { trace_id: "trace-1", span_id: "child" },
    to: { trace_id: "trace-2", span_id: "remote" },
    flags: 1,
    trace_state: "linked=yes",
  },
};

describe("recorded Trace view compiler", () => {
  it("compiles a lossless deterministic IR for waterfall and call tree", () => {
    const items = [
      node(
        "child",
        "1000000000000000010",
        "1000000000000000040",
        "2026-09-01T05:26:14.000Z",
      ),
      link,
      parentEdge,
      node(
        "root",
        "1000000000000000000",
        "1000000000000000100",
        "2026-09-01T05:26:13.000Z",
      ),
    ];

    const view = compileTraceView(items);

    expect(view.schemaVersion).toBe("wsr.trace-view@1");
    expect(view.status).toBe("READY");
    expect(view.traceId).toBe("trace-1");
    expect(view.durationNano).toBe("100");
    expect(view.nodes.map(({ id, depth }) => [id, depth])).toEqual([
      ["root", 0],
      ["child", 1],
    ]);
    expect(view.nodes[1]).toMatchObject({
      startTimeUnixNano: "1000000000000000010",
      endTimeUnixNano: "1000000000000000040",
      durationNano: "30",
      startOffsetNano: "10",
      flags: 257,
      traceState: "vendor=value",
      fields: [{ field: "wsr.role", value: "child" }],
      truth,
      parentId: "root",
    });
    expect(view.parentEdges).toEqual([
      expect.objectContaining({ id: "parent-child-root" }),
    ]);
    expect(view.links).toEqual([
      expect.objectContaining({
        id: "link-child-external",
        flags: 1,
        traceState: "linked=yes",
      }),
    ]);

    expect(compileTraceView([...items].reverse())).toEqual(view);
  });

  it.each([
    [
      "negative duration",
      [node("root", "20", "10", "2026-09-01T05:26:13.000Z")],
    ],
    [
      "multiple parents",
      [
        node("root", "0", "100", "2026-09-01T05:26:13.000Z"),
        node("other", "0", "100", "2026-09-01T05:26:14.000Z"),
        node("child", "10", "20", "2026-09-01T05:26:15.000Z"),
        parentEdge,
        {
          ...parentEdge,
          id: "parent-child-other",
          edge: {
            from: { trace_id: "trace-1", span_id: "child" },
            to: { trace_id: "trace-1", span_id: "other" },
          },
        },
      ],
    ],
  ])("fails closed for %s", (_label, items) => {
    const view = compileTraceView(items as TraceItem[]);

    expect(view.status).toBe("INVALID");
    expect(view.nodes).toEqual([]);
    expect(view.errors.length).toBeGreaterThan(0);
  });
});
