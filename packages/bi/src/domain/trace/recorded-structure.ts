import type { TraceEndpoint, TraceItem, Truth } from "../evidence/types";

export interface RecordedNode {
  id: string;
  endpoint: TraceEndpoint;
  label: string;
  kind: "INTERNAL" | "CLIENT";
  status: "UNSET" | "OK" | "ERROR";
  truth: Truth;
}

export interface UnresolvedEndpoint {
  id: string;
  endpoint: TraceEndpoint;
}

export interface RecordedStructure {
  status: "READY" | "INVALID";
  depthGroups: Array<{ depth: number; nodes: RecordedNode[] }>;
  parentEdges: Array<{ id: string; from: TraceEndpoint; to: TraceEndpoint }>;
  links: Array<{ id: string; from: TraceEndpoint; to: TraceEndpoint }>;
  unresolvedNodes: RecordedNode[];
  orphans: UnresolvedEndpoint[];
  errors: string[];
}

const endpointId = (endpoint: TraceEndpoint) =>
  `${endpoint.trace_id}:${endpoint.span_id}`;
const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

function recordedNode(
  item: Extract<TraceItem, { kind: "NODE" }>,
): RecordedNode {
  return {
    id: item.node.span_id,
    endpoint: { trace_id: item.trace_id, span_id: item.node.span_id },
    label: item.node.span_name,
    kind: item.node.span_kind,
    status: item.node.span_status,
    truth: item.truth,
  };
}

export function projectRecordedStructure(
  items: readonly TraceItem[],
): RecordedStructure {
  const nodes = new Map<string, RecordedNode>();
  const parents = new Map<string, string>();
  const parentEdges: RecordedStructure["parentEdges"] = [];
  const links: RecordedStructure["links"] = [];
  const referencedEndpoints = new Map<string, TraceEndpoint>();
  const errors: string[] = [];

  for (const item of items) {
    if (item.kind === "NODE") {
      const node = recordedNode(item);
      const key = endpointId(node.endpoint);
      if (nodes.has(key)) errors.push(`duplicate NODE ${key}`);
      else nodes.set(key, node);
      continue;
    }
    const from = endpointId(item.edge.from);
    const to = endpointId(item.edge.to);
    referencedEndpoints.set(from, item.edge.from);
    referencedEndpoints.set(to, item.edge.to);
    if (item.kind === "LINK") {
      links.push({ id: item.id, from: item.edge.from, to: item.edge.to });
      continue;
    }
    const existing = parents.get(from);
    if (existing !== undefined && existing !== to) {
      errors.push(`multiple recorded parents for ${from}`);
    } else {
      parents.set(from, to);
    }
    parentEdges.push({ id: item.id, from: item.edge.from, to: item.edge.to });
  }

  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const resolveDepth = (key: string): number | null => {
    const settled = depth.get(key);
    if (settled !== undefined) return settled;
    if (visiting.has(key)) {
      if (
        !errors.some((error) => error.startsWith("recorded parent cycle at "))
      ) {
        errors.push(`recorded parent cycle at ${key}`);
      }
      return null;
    }
    const parent = parents.get(key);
    if (parent === undefined) {
      depth.set(key, 0);
      return 0;
    }
    if (!nodes.has(parent)) return null;
    visiting.add(key);
    const parentDepth = resolveDepth(parent);
    visiting.delete(key);
    if (parentDepth === null) return null;
    const resolved = parentDepth + 1;
    depth.set(key, resolved);
    return resolved;
  };

  for (const key of [...nodes.keys()].sort(compareText)) resolveDepth(key);
  const groupedNodes = [...depth.entries()].reduce<Map<number, RecordedNode[]>>(
    (groups, [key, value]) => {
      const group = groups.get(value) ?? [];
      group.push(nodes.get(key)!);
      groups.set(value, group);
      return groups;
    },
    new Map(),
  );
  const depthGroups = [...groupedNodes.entries()]
    .sort(([left], [right]) => left - right)
    .map(([groupDepth, groupNodes]) => ({
      depth: groupDepth,
      nodes: groupNodes.sort((left, right) =>
        compareText(endpointId(left.endpoint), endpointId(right.endpoint)),
      ),
    }));
  const unresolvedNodes = [...nodes.entries()]
    .filter(([key]) => !depth.has(key))
    .sort(([left], [right]) => compareText(left, right))
    .map(([, node]) => node);
  const orphans = [...referencedEndpoints.entries()]
    .filter(([key]) => !nodes.has(key))
    .sort(([left], [right]) => compareText(left, right))
    .map(([id, endpoint]) => ({ id, endpoint }));

  return {
    status: errors.length === 0 ? "READY" : "INVALID",
    depthGroups: errors.length === 0 ? depthGroups : [],
    parentEdges: parentEdges.sort((left, right) =>
      compareText(left.id, right.id),
    ),
    links: links.sort((left, right) => compareText(left.id, right.id)),
    unresolvedNodes,
    orphans,
    errors: [...new Set(errors)].sort(compareText),
  };
}
