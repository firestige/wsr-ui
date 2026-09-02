import type {
  EvidenceSource,
  FieldValue,
  TraceEndpoint,
  TraceItem,
  Truth,
} from "../evidence/types";

export interface TraceViewNode {
  id: string;
  endpoint: TraceEndpoint;
  label: string;
  kind: "INTERNAL" | "CLIENT";
  status: "UNSET" | "OK" | "ERROR";
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  durationNano: string;
  startOffsetNano: string;
  flags: number;
  traceState: string | null;
  fields: FieldValue[];
  truth: Truth;
  depth: number;
  parentId?: string;
  evidenceId?: string;
  recordedAt?: string;
  source?: EvidenceSource;
}

export interface TraceViewParentEdge {
  id: string;
  from: TraceEndpoint;
  to: TraceEndpoint;
  truth: Truth;
  recordedAt?: string;
  source?: EvidenceSource;
}

export interface TraceViewLink extends TraceViewParentEdge {
  flags?: number;
  traceState?: string;
}

export interface TraceView {
  schemaVersion: "wsr.trace-view@1";
  status: "READY" | "INVALID";
  traceId?: string;
  startTimeUnixNano?: string;
  endTimeUnixNano?: string;
  durationNano?: string;
  nodes: TraceViewNode[];
  parentEdges: TraceViewParentEdge[];
  links: TraceViewLink[];
  errors: string[];
}

const endpointKey = ({ trace_id, span_id }: TraceEndpoint) =>
  `${trace_id}:${span_id}`;
const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

function invalid(errors: string[]): TraceView {
  return {
    schemaVersion: "wsr.trace-view@1",
    status: "INVALID",
    nodes: [],
    parentEdges: [],
    links: [],
    errors: [...new Set(errors)].sort(compareText),
  };
}

export function compileTraceView(items: readonly TraceItem[]): TraceView {
  const errors: string[] = [];
  const nodeItems = new Map<string, Extract<TraceItem, { kind: "NODE" }>>();
  const parents = new Map<string, string>();
  const parentEdges: TraceViewParentEdge[] = [];
  const links: TraceViewLink[] = [];
  const traceIds = new Set<string>();

  for (const item of items) {
    if (item.kind === "NODE") {
      const key = endpointKey({
        trace_id: item.trace_id,
        span_id: item.node.span_id,
      });
      traceIds.add(item.trace_id);
      if (nodeItems.has(key)) errors.push(`duplicate NODE ${key}`);
      else nodeItems.set(key, item);
      try {
        if (
          BigInt(item.node.end_time_unix_nano) <
          BigInt(item.node.start_time_unix_nano)
        )
          errors.push(`negative recorded duration for ${key}`);
      } catch {
        errors.push(`invalid recorded time for ${key}`);
      }
      continue;
    }

    if (item.kind === "PARENT_EDGE") {
      const child = endpointKey(item.edge.from);
      const parent = endpointKey(item.edge.to);
      const existing = parents.get(child);
      if (existing !== undefined && existing !== parent)
        errors.push(`multiple recorded parents for ${child}`);
      else parents.set(child, parent);
      parentEdges.push({
        id: item.id,
        from: { ...item.edge.from },
        to: { ...item.edge.to },
        truth: { ...item.truth },
        recordedAt: item.recorded_at,
        source: { ...item.source },
      });
      continue;
    }

    links.push({
      id: item.id,
      from: { ...item.edge.from },
      to: { ...item.edge.to },
      flags: item.edge.flags,
      traceState: item.edge.trace_state,
      truth: { ...item.truth },
      recordedAt: item.recorded_at,
      source: { ...item.source },
    });
  }

  if (traceIds.size > 1) errors.push("multiple NODE trace identities");
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const resolveDepth = (key: string): number | undefined => {
    const settled = depth.get(key);
    if (settled !== undefined) return settled;
    if (visiting.has(key)) {
      errors.push(`recorded parent cycle at ${key}`);
      return undefined;
    }
    const parent = parents.get(key);
    if (parent === undefined) {
      depth.set(key, 0);
      return 0;
    }
    if (!nodeItems.has(parent)) {
      errors.push(`missing recorded parent ${parent} for ${key}`);
      return undefined;
    }
    visiting.add(key);
    const parentDepth = resolveDepth(parent);
    visiting.delete(key);
    if (parentDepth === undefined) return undefined;
    depth.set(key, parentDepth + 1);
    return parentDepth + 1;
  };
  for (const key of [...nodeItems.keys()].sort(compareText)) resolveDepth(key);
  if (errors.length > 0) return invalid(errors);

  const orderedItems = [...nodeItems.values()].sort((left, right) => {
    const byStart =
      BigInt(left.node.start_time_unix_nano) -
      BigInt(right.node.start_time_unix_nano);
    if (byStart !== 0n) return byStart < 0n ? -1 : 1;
    const byRecorded = compareText(left.recorded_at, right.recorded_at);
    return byRecorded || compareText(left.id, right.id);
  });
  if (orderedItems.length === 0) return invalid(["recorded trace has no NODE"]);
  const traceStart = orderedItems.reduce(
    (minimum, item) =>
      BigInt(item.node.start_time_unix_nano) < minimum
        ? BigInt(item.node.start_time_unix_nano)
        : minimum,
    BigInt(orderedItems[0]!.node.start_time_unix_nano),
  );
  const traceEnd = orderedItems.reduce(
    (maximum, item) =>
      BigInt(item.node.end_time_unix_nano) > maximum
        ? BigInt(item.node.end_time_unix_nano)
        : maximum,
    BigInt(orderedItems[0]!.node.end_time_unix_nano),
  );

  return {
    schemaVersion: "wsr.trace-view@1",
    status: "READY",
    traceId: [...traceIds][0],
    startTimeUnixNano: traceStart.toString(),
    endTimeUnixNano: traceEnd.toString(),
    durationNano: (traceEnd - traceStart).toString(),
    nodes: orderedItems.map((item) => {
      const endpoint = {
        trace_id: item.trace_id,
        span_id: item.node.span_id,
      };
      const parent = parents.get(endpointKey(endpoint));
      return {
        id: item.node.span_id,
        endpoint,
        label: item.node.span_name,
        kind: item.node.span_kind,
        status: item.node.span_status,
        startTimeUnixNano: item.node.start_time_unix_nano,
        endTimeUnixNano: item.node.end_time_unix_nano,
        durationNano: (
          BigInt(item.node.end_time_unix_nano) -
          BigInt(item.node.start_time_unix_nano)
        ).toString(),
        startOffsetNano: (
          BigInt(item.node.start_time_unix_nano) - traceStart
        ).toString(),
        flags: item.node.span_flags,
        traceState: item.node.trace_state,
        fields: item.node.fields.map((field) => ({ ...field })),
        truth: { ...item.truth },
        depth: depth.get(endpointKey(endpoint))!,
        ...(parent === undefined
          ? {}
          : { parentId: nodeItems.get(parent)!.node.span_id }),
        evidenceId: item.id,
        recordedAt: item.recorded_at,
        source: { ...item.source },
      };
    }),
    parentEdges: parentEdges.sort((left, right) =>
      compareText(left.id, right.id),
    ),
    links: links.sort((left, right) => compareText(left.id, right.id)),
    errors: [],
  };
}
