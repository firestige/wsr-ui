import type { TraceView, TraceViewNode, Truth } from "../public";

const traceId = "17017017017017017017017017017017";
const base = 1_788_302_400_000_000_000n;
const truth: Truth = {
  availability: "AVAILABLE",
  completeness: "FINAL",
  expiry: "ACTIVE",
  expires_at: null,
};

const specifications = [
  ["statistics-root", "workflow.statistics", 0, 1790, "INTERNAL", "OK", 0],
  ["request-parse", "request.parse", 30, 120, "INTERNAL", "OK", 1],
  ["policy-check", "policy.check", 170, 210, "INTERNAL", "OK", 1],
  ["database-query", "database.query", 410, 460, "CLIENT", "ERROR", 1],
  ["cache-read", "cache.read", 440, 85, "CLIENT", "OK", 2],
  ["cache-refresh", "cache.refresh", 540, 180, "CLIENT", "ERROR", 2],
  ["result-shape", "result.shape", 890, 140, "INTERNAL", "OK", 1],
  ["metric-count", "metric.count", 920, 55, "INTERNAL", "UNSET", 2],
  ["metric-group", "metric.group", 990, 110, "INTERNAL", "OK", 2],
  ["response-write", "response.write", 1120, 205, "CLIENT", "OK", 1],
  ["audit-record", "audit.record", 1190, 95, "INTERNAL", "UNSET", 2],
  ["telemetry-export", "telemetry.export", 1330, 130, "CLIENT", "ERROR", 1],
] as const satisfies readonly (readonly [
  string,
  string,
  number,
  number,
  TraceViewNode["kind"],
  TraceViewNode["status"],
  number,
])[];

const statisticsTopics: Record<string, string> = {
  "request-parse": "Request & policy",
  "policy-check": "Request & policy",
  "database-query": "Data access",
  "cache-read": "Data access",
  "cache-refresh": "Data access",
  "result-shape": "Result metrics",
  "metric-count": "Result metrics",
  "metric-group": "Result metrics",
  "response-write": "Response & telemetry",
  "audit-record": "Response & telemetry",
  "telemetry-export": "Response & telemetry",
};

const nodes: TraceViewNode[] = specifications.map(
  ([id, label, offsetMs, durationMs, kind, status, depth]) => {
    const start = base + BigInt(offsetMs) * 1_000_000n;
    const duration = BigInt(durationMs) * 1_000_000n;
    const parentId =
      depth === 0
        ? undefined
        : depth === 1
          ? "statistics-root"
          : id.startsWith("cache-")
            ? "database-query"
            : id.startsWith("metric-")
              ? "result-shape"
              : "response-write";
    return {
      id,
      endpoint: { trace_id: traceId, span_id: id },
      label,
      kind,
      status,
      startTimeUnixNano: String(start),
      endTimeUnixNano: String(start + duration),
      durationNano: String(duration),
      startOffsetNano: String(BigInt(offsetMs) * 1_000_000n),
      flags: 1,
      traceState: "fixture=statistics-inspection",
      fields: [
        { field: "wsr.fixture", value: "statistics-inspection" },
        ...(statisticsTopics[id] === undefined
          ? []
          : [
              {
                field: "wsr.statistics.topic",
                value: statisticsTopics[id],
              },
            ]),
      ],
      truth,
      depth,
      ...(parentId === undefined ? {} : { parentId }),
    };
  },
);

export const statisticsTrace: TraceView = {
  schemaVersion: "wsr.trace-view@1",
  status: "READY",
  traceId,
  startTimeUnixNano: String(base),
  endTimeUnixNano: String(base + 1_790_000_000n),
  durationNano: "1790000000",
  nodes,
  parentEdges: nodes.flatMap((node) =>
    node.parentId === undefined
      ? []
      : [
          {
            id: `parent-${node.id}`,
            from: node.endpoint,
            to: { trace_id: traceId, span_id: node.parentId },
            truth,
          },
        ],
  ),
  links: [
    {
      id: "link-database-cache",
      from: { trace_id: traceId, span_id: "database-query" },
      to: { trace_id: traceId, span_id: "cache-refresh" },
      truth,
    },
    {
      id: "link-export-remote",
      from: { trace_id: traceId, span_id: "telemetry-export" },
      to: { trace_id: "remote-observability", span_id: "collector-ingest" },
      truth,
    },
  ],
  errors: [],
};
