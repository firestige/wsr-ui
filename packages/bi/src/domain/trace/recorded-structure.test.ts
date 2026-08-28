import { describe, expect, it } from "vitest";

import type { TraceItem } from "../evidence/types";
import { projectRecordedStructure } from "./recorded-structure";

const traceId = "a".repeat(32);
const truth = {
  completeness: "FINAL" as const,
  availability: "AVAILABLE" as const,
  expiry: "ACTIVE" as const,
  expires_at: null,
};
const source = (span_id: string) => ({
  kind: "SPAN" as const,
  trace_id: traceId,
  span_id,
});
const endpoint = (span_id: string, id = traceId) => ({ trace_id: id, span_id });
const node = (
  span_id: string,
  span_name: string,
  recorded_at: string,
): TraceItem => ({
  id: `node-${span_id}`,
  trace_id: traceId,
  kind: "NODE",
  source: source(span_id),
  recorded_at,
  truth,
  node: {
    span_id,
    span_name,
    span_kind: "INTERNAL",
    start_time_unix_nano: "999",
    end_time_unix_nano: "1000",
    span_status: "OK",
    span_flags: 0,
    trace_state: null,
    fields: [],
  },
  edge: null,
});
const edge = (
  child: string,
  parent: string,
  recorded_at: string,
): TraceItem => ({
  id: `parent-${child}-${parent}`,
  trace_id: traceId,
  kind: "PARENT_EDGE",
  source: source(child),
  recorded_at,
  truth,
  node: null,
  edge: { from: endpoint(child), to: endpoint(parent) },
});

describe("recorded Trace projection", () => {
  it("derives parent depth and sibling order only from stable identities", () => {
    const root = "1".repeat(16);
    const childA = "2".repeat(16);
    const childB = "3".repeat(16);
    const items = [
      edge(childB, root, "2026-08-28T10:00:09Z"),
      node(childB, "Reviewer", "2026-08-28T10:00:08Z"),
      node(root, "Root", "2026-08-28T10:00:07Z"),
      edge(childA, root, "2026-08-28T10:00:06Z"),
      node(childA, "Writer", "2026-08-28T10:00:05Z"),
    ];

    const first = projectRecordedStructure(items);
    const withoutTimeOrder = projectRecordedStructure(
      items.toReversed().map((item, index) => ({
        ...item,
        recorded_at: `2000-01-01T00:00:0${index}Z`,
      })),
    );

    expect(first).toEqual(withoutTimeOrder);
    expect(
      first.depthGroups.map((group) => group.nodes.map((item) => item.id)),
    ).toEqual([[root], [childA, childB]]);
  });

  it("keeps LINK and missing endpoints outside parent depth", () => {
    const root = "1".repeat(16);
    const missingParent = "9".repeat(16);
    const externalTrace = "b".repeat(32);
    const externalSpan = "8".repeat(16);
    const items: TraceItem[] = [
      node(root, "Root", "2026-08-28T10:00:00Z"),
      edge(root, missingParent, "2026-08-28T10:00:01Z"),
      {
        id: "link-root-external",
        trace_id: traceId,
        kind: "LINK",
        source: source(root),
        recorded_at: "2026-08-28T10:00:02Z",
        truth,
        node: null,
        edge: {
          from: endpoint(root),
          to: endpoint(externalSpan, externalTrace),
        },
      },
    ];

    const result = projectRecordedStructure(items);

    expect(result.depthGroups).toEqual([]);
    expect(result.links).toHaveLength(1);
    expect(result.orphans.map((item) => item.id)).toEqual([
      `${traceId}:${missingParent}`,
      `${externalTrace}:${externalSpan}`,
    ]);
    expect(result.unresolvedNodes.map((item) => item.id)).toEqual([root]);
  });

  it("fails visibly for multiple parents or a recorded parent cycle", () => {
    const first = "1".repeat(16);
    const second = "2".repeat(16);
    const third = "3".repeat(16);
    const result = projectRecordedStructure([
      node(first, "First", "2026-08-28T10:00:00Z"),
      node(second, "Second", "2026-08-28T10:00:01Z"),
      node(third, "Third", "2026-08-28T10:00:02Z"),
      edge(first, second, "2026-08-28T10:00:03Z"),
      edge(first, third, "2026-08-28T10:00:04Z"),
      edge(second, first, "2026-08-28T10:00:05Z"),
    ]);

    expect(result.status).toBe("INVALID");
    expect(result.depthGroups).toEqual([]);
    expect(result.errors).toEqual([
      `multiple recorded parents for ${traceId}:${first}`,
      `recorded parent cycle at ${traceId}:${first}`,
    ]);
  });
});
