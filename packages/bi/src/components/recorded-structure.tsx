import { useId } from "react";

export type RecordedDetailState = "AVAILABLE" | "PARTIAL";

export interface RecordedNodeView {
  id: string;
  label: string;
  state: RecordedDetailState;
}

export interface RecordedStructureViewModel {
  depthGroups: Array<{ depth: number; nodes: RecordedNodeView[] }>;
  links: Array<{
    sourceId: string;
    targetId: string;
    state: RecordedDetailState;
  }>;
  orphans: RecordedNodeView[];
  selectedId?: string;
}

const detailStateLabels: Record<RecordedDetailState, string> = {
  AVAILABLE: "Available recorded detail",
  PARTIAL: "Partial recorded detail",
};

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
              <li key={`${link.sourceId}:${link.targetId}`}>
                <code className="text-code">
                  {link.sourceId} ⇢ {link.targetId}
                </code>
                <span>{detailStateLabels[link.state]}</span>
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
