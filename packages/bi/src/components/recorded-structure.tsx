import { scalePoint } from "d3";
import { useId } from "react";

export type RecordedDetailState = "AVAILABLE" | "UNRESOLVED";

export interface RecordedNodeView {
  id: string;
  endpointId?: string;
  label: string;
  state: RecordedDetailState;
}

interface RecordedRelationView {
  id: string;
  sourceId: string;
  targetId: string;
}

export interface RecordedStructureViewModel {
  depthGroups: Array<{ depth: number; nodes: RecordedNodeView[] }>;
  parentEdges: RecordedRelationView[];
  links: Array<RecordedRelationView & { state: RecordedDetailState }>;
  orphans: RecordedNodeView[];
  selectedId?: string;
}

const detailStateLabels: Record<RecordedDetailState, string> = {
  AVAILABLE: "Available recorded detail",
  UNRESOLVED: "Unresolved recorded endpoint",
};

function RecordedGraph({ model }: { model: RecordedStructureViewModel }) {
  const width = 960;
  const rowHeight = 120;
  const positions = new Map<string, { x: number; y: number }>();
  for (const group of model.depthGroups) {
    const identities = group.nodes.map((node) => node.endpointId ?? node.id);
    const x = scalePoint<string>()
      .domain(identities)
      .range([80, width - 80]);
    for (const node of group.nodes) {
      const identity = node.endpointId ?? node.id;
      positions.set(identity, {
        x: x(identity) ?? width / 2,
        y: 60 + group.depth * rowHeight,
      });
    }
  }
  const height = Math.max(120, model.depthGroups.length * rowHeight);
  const line = (relation: RecordedRelationView, kind: "parent" | "link") => {
    const source = positions.get(relation.sourceId);
    const target = positions.get(relation.targetId);
    return source === undefined || target === undefined ? null : (
      <line
        className={`recorded-graph-${kind}`}
        data-kind={kind === "parent" ? "PARENT_EDGE" : "LINK"}
        key={`${kind}:${relation.id}`}
        x1={source.x}
        x2={target.x}
        y1={source.y}
        y2={target.y}
      />
    );
  };
  return (
    <div className="recorded-graph-frame">
      <svg
        aria-label="Recorded parent structure graph"
        className="recorded-graph"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title>Recorded parent structure graph</title>
        {model.parentEdges.map((edge) => line(edge, "parent"))}
        {model.links.map((link) => line(link, "link"))}
        {model.depthGroups.flatMap((group) =>
          group.nodes.map((node) => {
            const position = positions.get(node.endpointId ?? node.id)!;
            return (
              <g
                key={node.endpointId ?? node.id}
                transform={`translate(${position.x} ${position.y})`}
              >
                <circle className="recorded-graph-node" r="10" />
                <text
                  className="recorded-graph-label"
                  textAnchor="middle"
                  y="28"
                >
                  {node.label}
                </text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}

function NodeButton({
  node,
  selected,
  onSelect,
}: {
  node: RecordedNodeView;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      aria-current={selected ? "true" : undefined}
      className="recorded-node"
      onClick={() => onSelect(node.id)}
      type="button"
    >
      <span>{node.label}</span>
      <code className="text-code">{node.id}</code>
      <span className={`recorded-state recorded-${node.state.toLowerCase()}`}>
        {detailStateLabels[node.state]}
      </span>
    </button>
  );
}

export function RecordedStructureFoundation({
  model,
  onSelect,
}: {
  model: RecordedStructureViewModel;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="recorded-structure">
      <header>
        <h2 className="text-heading">Recorded structure</h2>
        <p className="text-body">
          Parent depth, independent LINK records, and unresolved endpoints only.
        </p>
      </header>
      <RecordedGraph model={model} />
      <section className="recorded-parent-edges">
        <h3 className="text-label">PARENT_EDGE — recorded structure</h3>
        {model.parentEdges.length === 0 ? (
          <p className="text-body">No recorded parent relations.</p>
        ) : (
          <ul>
            {model.parentEdges.map((edge) => (
              <li key={edge.id}>
                <button
                  aria-label={`Recorded parent relation ${edge.sourceId} to ${edge.targetId}`}
                  className="recorded-relation"
                  onClick={() => onSelect(edge.id)}
                  type="button"
                >
                  <code className="text-code">
                    {edge.sourceId} → {edge.targetId}
                  </code>
                  <span>PARENT_EDGE</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="recorded-depths">
        {model.depthGroups.map((group) => (
          <div
            aria-label={`Recorded depth ${group.depth}`}
            className="recorded-group"
            key={group.depth}
            role="group"
          >
            <h3 className="text-label">Depth {group.depth}</h3>
            <div className="recorded-siblings">
              {group.nodes.map((node) => (
                <NodeButton
                  key={node.id}
                  node={node}
                  onSelect={onSelect}
                  selected={model.selectedId === node.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <section className="recorded-links">
        <h3 className="text-label">LINK — independent recorded relation</h3>
        {model.links.length === 0 ? (
          <p className="text-body">No recorded LINK relations.</p>
        ) : (
          <ul>
            {model.links.map((link) => (
              <li key={link.id}>
                <button
                  aria-label={`Independent LINK ${link.sourceId} to ${link.targetId}`}
                  className="recorded-relation"
                  onClick={() => onSelect(link.id)}
                  type="button"
                >
                  <code className="text-code">
                    {link.sourceId} ⇢ {link.targetId}
                  </code>
                  <span>LINK · {detailStateLabels[link.state]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div aria-label="Orphan endpoints" className="orphan-lane" role="group">
        <h3 className="text-label">Orphan endpoints</h3>
        {model.orphans.map((node) => (
          <NodeButton
            key={node.id}
            node={node}
            onSelect={onSelect}
            selected={model.selectedId === node.id}
          />
        ))}
      </div>
    </section>
  );
}

export const DEFAULT_MOTION_MODE = "STILL" as const;
export type MotionMode = "STILL" | "LIVE" | "COMPLETE";

export function MotionControl({
  mode,
  reducedMotion,
  canStart,
  disabledReason,
  onStart,
  onStop,
  onReset,
}: {
  mode: MotionMode;
  reducedMotion: boolean;
  canStart: boolean;
  disabledReason?: string;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const reasonId = useId();
  const effectiveMode = reducedMotion ? "STILL" : mode;
  const reason = reducedMotion
    ? "Reduced motion keeps the complete structure still."
    : disabledReason;
  return (
    <section className="motion-control">
      <span aria-live="polite">
        Mode: {effectiveMode === "STILL" ? "Still" : effectiveMode}
      </span>
      {effectiveMode === "LIVE" ? (
        <button className="action-control" onClick={onStop} type="button">
          Stop Live reading
        </button>
      ) : effectiveMode === "COMPLETE" ? (
        <button className="action-control" onClick={onReset} type="button">
          Reset reading
        </button>
      ) : (
        <button
          aria-describedby={reason === undefined ? undefined : reasonId}
          className="action-control"
          disabled={reducedMotion || !canStart}
          onClick={onStart}
          type="button"
        >
          Start Live reading
        </button>
      )}
      {reason === undefined ? null : (
        <span className="status-reason" id={reasonId}>
          {reason}
        </span>
      )}
    </section>
  );
}
