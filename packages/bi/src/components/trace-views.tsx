import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { TraceView, TraceViewNode } from "../domain/trace/trace-view";
import { ScopedError } from "./status";

const compareText = (left: string, right: string) =>
  left < right ? -1 : left > right ? 1 : 0;

function percentage(value: string, total: string): number {
  const denominator = BigInt(total);
  if (denominator <= 0n) return 0;
  return Number((BigInt(value) * 10_000n) / denominator) / 100;
}

function displayNano(value: string): string {
  const nano = BigInt(value);
  if (nano >= 1_000_000_000n) return `${Number(nano / 1_000_000n) / 1000} s`;
  if (nano >= 1_000_000n) return `${Number(nano / 1_000n) / 1000} ms`;
  if (nano >= 1_000n) return `${Number(nano) / 1000} μs`;
  return `${value} ns`;
}

function compactIdentity(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function nodeChildren(trace: TraceView, node: TraceViewNode): TraceViewNode[] {
  return trace.nodes.filter((candidate) => candidate.parentId === node.id);
}

function useNarrowTraceView(): boolean {
  const query = "(max-width: 40rem)";
  const [narrow, setNarrow] = useState(
    () => typeof matchMedia === "function" && matchMedia(query).matches,
  );
  useEffect(() => {
    if (typeof matchMedia !== "function") return undefined;
    const media = matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return narrow;
}

export function SpanPassport({
  node,
  trace,
  children,
}: {
  node: TraceViewNode;
  trace?: TraceView;
  children?: ReactNode;
}) {
  const fields = Object.fromEntries(
    node.fields.map(({ field, value }) => [field, value]),
  );
  const childNodes = trace === undefined ? [] : nodeChildren(trace, node);
  const links =
    trace === undefined
      ? []
      : trace.links.filter(
          (link) =>
            link.from.span_id === node.id || link.to.span_id === node.id,
        );
  return (
    <section aria-label="Span passport" className="span-passport panel-card">
      <header className="trace-passport-head">
        <div>
          <span className="trace-eyebrow">Exact focus</span>
          <h3 className="text-heading">Span Passport</h3>
        </div>
        <span className={`trace-kind trace-kind-${node.kind.toLowerCase()}`}>
          {node.kind}
        </span>
      </header>
      <strong className="trace-passport-name">{node.label}</strong>
      <dl className="trace-passport-grid">
        <dt>Identity</dt>
        <dd className="text-code">{`${node.endpoint.trace_id} / ${node.endpoint.span_id}`}</dd>
        <dt>Recorded start / end</dt>
        <dd className="numeric-exact">{`${node.startTimeUnixNano} → ${node.endTimeUnixNano} ns`}</dd>
        <dt>Recorded duration</dt>
        <dd className="numeric-exact">{`${displayNano(node.durationNano)} · ${node.durationNano} ns exact`}</dd>
        <dt>Status / truth</dt>
        <dd>{`${node.status} · ${node.truth.completeness ?? "UNKNOWN"} · ${node.truth.availability}`}</dd>
        <dt>Parent / children</dt>
        <dd>{`${node.parentId ?? "root"} → ${childNodes.map(({ label }) => label).join(", ") || "no recorded child"}`}</dd>
        <dt>Flags / trace state</dt>
        <dd className="text-code">{`${node.flags} · ${node.traceState ?? "none"}`}</dd>
        <dt>Recorded fields</dt>
        <dd className="text-code">{JSON.stringify(fields)}</dd>
      </dl>
      {links.length === 0 ? null : (
        <p className="trace-link-receipt">
          {`${links.length} independent recorded LINK${links.length === 1 ? "" : "s"}. LINK does not change tree depth.`}
        </p>
      )}
      {children}
    </section>
  );
}

function InvalidTrace({ trace }: { trace: TraceView }) {
  return (
    <ScopedError
      announce="polite"
      detail={trace.errors.join(" · ") || "Recorded Trace IR is invalid."}
      retryable={false}
      title="Recorded Trace unavailable"
    />
  );
}

function RecordedLinks({
  trace,
  node,
}: {
  trace: TraceView;
  node?: TraceViewNode;
}) {
  const links = node
    ? trace.links.filter(
        (link) => link.from.span_id === node.id || link.to.span_id === node.id,
      )
    : trace.links;
  if (links.length === 0) return null;
  return (
    <ul aria-label="Recorded span links" className="trace-link-list">
      {links.map((link) => (
        <li className="text-code" key={link.id}>
          {`Recorded LINK → ${link.to.trace_id}:${link.to.span_id}`}
        </li>
      ))}
    </ul>
  );
}

function TraceMotion({
  durationNano,
  position,
  playing,
  reducedMotion,
  onPlayingChange,
  onPositionChange,
}: {
  durationNano: string;
  position: number;
  playing: boolean;
  reducedMotion: boolean;
  onPlayingChange(value: boolean): void;
  onPositionChange(value: number): void;
}) {
  return (
    <footer className="trace-motion">
      <div className="trace-motion-actions">
        <button
          disabled={reducedMotion}
          onClick={() => onPlayingChange(!playing)}
          type="button"
        >
          {reducedMotion
            ? "Reduced motion: Still"
            : playing
              ? "Pause"
              : "Play recorded time"}
        </button>
        <button
          onClick={() => {
            onPlayingChange(false);
            onPositionChange(0);
          }}
          type="button"
        >
          Restart
        </button>
      </div>
      <div className="trace-motion-copy">
        <strong>
          {playing ? "Playing · exact recorded time" : "Still · complete trace"}
        </strong>
        <input
          aria-label="Recorded time position"
          aria-valuemax={100}
          aria-valuemin={0}
          max={100}
          min={0}
          onChange={(event) =>
            onPositionChange(Number(event.currentTarget.value))
          }
          type="range"
          value={position}
        />
        <span>
          Finite reader-controlled visualization; not a running execution.
        </span>
      </div>
      <code>{`${Math.round(position)}% / ${displayNano(durationNano)}`}</code>
    </footer>
  );
}

const WaterfallRow = memo(function WaterfallRow({
  node,
  selected,
  current,
  playing,
  start,
  width,
  onSelect,
}: {
  node: TraceViewNode;
  selected: boolean;
  current: boolean;
  playing: boolean;
  start: number;
  width: number;
  onSelect(id: string): void;
}) {
  return (
    <div
      aria-level={node.depth + 1}
      className={`trace-waterfall-row${selected ? " is-selected" : ""}${current && playing ? " is-current" : ""}`}
      role="treeitem"
    >
      <button
        aria-label={`${node.label}, ${node.durationNano} nanoseconds`}
        className="recorded-node trace-node-label"
        data-trace-node-id={node.id}
        onClick={() => onSelect(node.id)}
        style={{ paddingInlineStart: `${0.75 + node.depth * 1.15}rem` }}
        type="button"
      >
        <span className={`trace-glyph trace-kind-${node.kind.toLowerCase()}`}>
          {node.kind === "CLIENT" ? "↗" : "◆"}
        </span>
        <span className="trace-node-copy">
          <strong>{node.label}</strong>
          <small>{`${node.kind} · ${compactIdentity(node.id)}`}</small>
        </span>
        <span
          className={node.status === "ERROR" ? "trace-error" : "numeric-exact"}
        >
          {displayNano(node.durationNano)}
        </span>
      </button>
      <div aria-hidden="true" className="trace-timeline-track">
        <span
          className={`trace-timeline-bar trace-kind-${node.kind.toLowerCase()}${node.status === "ERROR" ? " trace-status-error" : ""}`}
          style={{ insetInlineStart: `${start}%`, width: `${width}%` }}
        >
          {node.label}
        </span>
      </div>
    </div>
  );
});

export function TraceWaterfall({
  trace,
  reducedMotion = false,
  viewNavigation,
}: {
  trace: TraceView;
  reducedMotion?: boolean;
  viewNavigation?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const narrow = useNarrowTraceView();
  const selectNode = useCallback((id: string) => setSelectedId(id), []);
  useEffect(() => {
    if (!playing || reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      setPosition((current) => {
        if (current >= 100) {
          setPlaying(false);
          return 100;
        }
        return Math.min(100, current + 2);
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing, reducedMotion]);
  if (trace.status !== "READY" || trace.durationNano === undefined)
    return <InvalidTrace trace={trace} />;
  const normalized = query.trim().toLocaleLowerCase();
  const nodes = trace.nodes.filter(
    (node) =>
      normalized === "" ||
      node.label.toLocaleLowerCase().includes(normalized) ||
      node.id.toLocaleLowerCase().includes(normalized),
  );
  const selected =
    trace.nodes.find((node) => node.id === selectedId) ?? trace.nodes[0]!;
  const errorCount = trace.nodes.filter(
    ({ status }) => status === "ERROR",
  ).length;
  return (
    <section
      aria-label="Recorded trace waterfall"
      className="trace-view trace-waterfall"
      data-motion={reducedMotion ? "off" : "finite-recorded-time"}
      data-trace-renderer="waterfall"
    >
      <header className="trace-summary trace-summary-dense">
        <div>
          <span className="trace-eyebrow">Exact recorded timeline</span>
          <strong>{trace.nodes[0]?.label ?? trace.traceId}</strong>
        </div>
        <span>{`${displayNano(trace.durationNano)} recorded duration`}</span>
        <span>{`Recorded spans: ${trace.nodes.length}`}</span>
        <span>{`Recorded links: ${trace.links.length}`}</span>
        <span>{`ERROR spans: ${errorCount}`}</span>
      </header>
      <div className="trace-view-tools">
        {viewNavigation}
        <button type="button">Expand all</button>
        <button onClick={() => setSelectedId(trace.nodes[0]?.id)} type="button">
          Reset focus
        </button>
        <input
          aria-label="Search recorded spans"
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search span name or exact identity"
          type="search"
          value={query}
        />
      </div>
      <section aria-label="Recorded trace minimap" className="trace-minimap">
        <span className="trace-eyebrow">
          Trace minimap · shared recorded-time domain
        </span>
        <div className="trace-minimap-track">
          {trace.nodes.map((node) => (
            <i
              key={node.id}
              style={{
                insetInlineStart: `${percentage(node.startOffsetNano, trace.durationNano!)}%`,
                width: `${percentage(node.durationNano, trace.durationNano!)}%`,
              }}
            />
          ))}
        </div>
      </section>
      <div className="trace-workbench">
        {narrow ? (
          <section className="trace-waterfall-mobile">
            <header>Span tree · exact duration</header>
            <div aria-label="Recorded waterfall span outline" role="tree">
              {nodes.map((node) => (
                <TreeOutlineRow
                  key={node.id}
                  node={node}
                  onSelect={selectNode}
                  trace={trace}
                />
              ))}
            </div>
          </section>
        ) : (
          <section className="trace-waterfall-canvas">
          <header className="trace-timeline-head">
            <span>Span tree</span>
            <span className="trace-ruler">0 · 25% · 50% · 75% · 100%</span>
          </header>
          <div
            aria-label="Recorded waterfall span outline"
            className="trace-timeline"
            role="tree"
          >
            {nodes.map((node) => {
              const start = percentage(
                node.startOffsetNano,
                trace.durationNano!,
              );
              const end =
                start + percentage(node.durationNano, trace.durationNano!);
              return (
                <WaterfallRow
                  current={position >= start && position <= end}
                  key={node.id}
                  node={node}
                  onSelect={selectNode}
                  playing={playing}
                  selected={selected.id === node.id}
                  start={start}
                  width={percentage(node.durationNano, trace.durationNano!)}
                />
              );
            })}
          </div>
          <RecordedLinks trace={trace} />
          </section>
        )}
        <SpanPassport node={selected} trace={trace} />
      </div>
      <TraceMotion
        durationNano={trace.durationNano}
        onPlayingChange={setPlaying}
        onPositionChange={setPosition}
        playing={playing}
        position={position}
        reducedMotion={reducedMotion}
      />
    </section>
  );
}

interface GeometryNode {
  node: TraceViewNode;
  x: number;
  y: number;
}

function treeGeometry(trace: TraceView): GeometryNode[] {
  const byDepth = new Map<number, TraceViewNode[]>();
  for (const node of trace.nodes) {
    const row = byDepth.get(node.depth) ?? [];
    row.push(node);
    byDepth.set(node.depth, row);
  }
  return [...byDepth.entries()].flatMap(([depth, nodes]) =>
    [...nodes]
      .sort(
        (left, right) =>
          compareText(left.startTimeUnixNano, right.startTimeUnixNano) ||
          compareText(left.id, right.id),
      )
      .map((node, index) => ({
        node,
        x: 60 + depth * 330,
        y:
          nodes.length === 1
            ? 240
            : nodes.length === 2
              ? 110 + index * 245
              : 47 + index * (368 / (nodes.length - 1)),
      })),
  );
}

function edgePath(from: GeometryNode, to: GeometryNode): string {
  const startX = from.x + 190;
  const startY = from.y + 35;
  const endX = to.x;
  const endY = to.y + 35;
  const middle = (startX + endX) / 2;
  return `M${startX} ${startY} C${middle} ${startY} ${middle} ${endY} ${endX} ${endY}`;
}

const TreeNodeGlyph = memo(function TreeNodeGlyph({
  node,
  x,
  y,
  selected,
  lensHit,
  current,
  playing,
  traceDurationNano,
  onSelect,
}: GeometryNode & {
  selected: boolean;
  lensHit: boolean;
  current: boolean;
  playing: boolean;
  traceDurationNano: string;
  onSelect(id: string): void;
}) {
  const select = () => onSelect(node.id);
  return (
    <g
      aria-label={`${node.label}, ${node.kind}, ${node.status}, ${displayNano(node.durationNano)}`}
      aria-level={node.depth + 1}
      className={`trace-tree-node trace-kind-${node.kind.toLowerCase()}${selected ? " is-selected" : ""}${lensHit ? " is-lens-hit" : " is-lens-muted"}${current && playing ? " is-time-current" : ""}${node.status === "ERROR" ? " trace-status-error" : ""}`}
      data-trace-node-id={node.id}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          select();
        }
      }}
      role="treeitem"
      tabIndex={0}
      transform={`translate(${x} ${y})`}
    >
      <rect className="trace-tree-card" height="70" rx="9" width="190" />
      <rect className="trace-tree-kind-rail" height="70" rx="3" width="4" />
      <text className="trace-tree-kind" x="14" y="17">
        {node.kind}
      </text>
      <text className="trace-tree-status" textAnchor="end" x="176" y="17">
        {node.status}
      </text>
      <text className="trace-tree-name" x="14" y="37">
        {node.label}
      </text>
      <text
        className="trace-tree-meta"
        x="14"
        y="53"
      >{`+${displayNano(node.startOffsetNano)} · ${compactIdentity(node.id)}`}</text>
      <text className="trace-tree-duration" textAnchor="end" x="176" y="53">
        {displayNano(node.durationNano)}
      </text>
      <rect
        className="trace-tree-micro-bg"
        height="3"
        rx="2"
        width="160"
        x="14"
        y="61"
      />
      <rect
        className="trace-tree-micro"
        height="3"
        rx="2"
        width={Math.max(
          2,
          percentage(node.durationNano, traceDurationNano) * 1.6,
        )}
        x={14 + percentage(node.startOffsetNano, traceDurationNano) * 1.6}
        y="61"
      />
    </g>
  );
});

const TreeOutlineRow = memo(function TreeOutlineRow({
  node,
  trace,
  onSelect,
}: {
  node: TraceViewNode;
  trace: TraceView;
  onSelect(id: string): void;
}) {
  return (
    <div
      aria-level={node.depth + 1}
      role="treeitem"
      style={{ paddingInlineStart: `${node.depth * 1.5}rem` }}
    >
      <button
        data-trace-node-id={node.id}
        onClick={() => onSelect(node.id)}
        type="button"
      >
        <span>{node.label}</span>
        <span>{displayNano(node.durationNano)}</span>
      </button>
      <RecordedLinks node={node} trace={trace} />
    </div>
  );
});

export function TraceTree({
  trace,
  viewNavigation,
}: {
  trace: TraceView;
  viewNavigation?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [lens, setLens] = useState<"none" | "ancestors" | "descendants">(
    "none",
  );
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const selectNode = useCallback((id: string) => setSelectedId(id), []);
  const narrow = useNarrowTraceView();
  const geometry = useMemo(
    () => (trace.status === "READY" ? treeGeometry(trace) : []),
    [trace],
  );
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setPosition((current) => {
        if (current >= 100) {
          setPlaying(false);
          return 100;
        }
        return Math.min(100, current + 2);
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [playing]);
  if (trace.status !== "READY") return <InvalidTrace trace={trace} />;
  const byId = new Map(geometry.map((item) => [item.node.id, item]));
  const selected =
    trace.nodes.find((node) => node.id === selectedId) ?? trace.nodes[0]!;
  const lensIds = (() => {
    const ids = new Set<string>([selected.id]);
    if (lens === "ancestors") {
      let cursor = selected;
      while (cursor.parentId !== undefined) {
        ids.add(cursor.parentId);
        const parent = trace.nodes.find(({ id }) => id === cursor.parentId);
        if (parent === undefined) break;
        cursor = parent;
      }
    }
    if (lens === "descendants") {
      const queue = [selected.id];
      while (queue.length > 0) {
        const parentId = queue.shift()!;
        for (const child of trace.nodes.filter(
          ({ parentId: candidate }) => candidate === parentId,
        )) {
          ids.add(child.id);
          queue.push(child.id);
        }
      }
    }
    return ids;
  })();
  const lensReceipt =
    lens === "none"
      ? "Focus receipt · exact PARENT_EDGE identity; choose a lens to inspect."
      : `${lens === "ancestors" ? "Ancestors" : "Descendants"} receipt · ${lensIds.size} exact Span ${lensIds.size === 1 ? "identity" : "identities"} · recorded PARENT_EDGE only.`;
  const duration = trace.durationNano ?? "0";
  const parentGeometry = geometry.flatMap((child) => {
    if (child.node.parentId === undefined) return [];
    const parent = byId.get(child.node.parentId);
    if (parent === undefined) return [];
    return [{ child, parent, path: edgePath(parent, child) }];
  });
  const coalescedParentGeometry = parentGeometry.length > 128;
  return (
    <section
      aria-label="Recorded trace tree"
      className="trace-view trace-tree-graph"
      data-lens={lens}
      data-trace-renderer="tree"
    >
      <section className="trace-tree-context">
        <div>
          <strong>{trace.nodes[0]?.label ?? trace.traceId}</strong>
          <code>{`trace ${trace.traceId} · ${trace.nodes.length} exact Spans · ${trace.parentEdges.length} PARENT_EDGE · ${trace.links.length} LINK`}</code>
        </div>
        <div className="trace-tree-toolbar">
          <button onClick={() => setLens("none")} type="button">
            Fit tree
          </button>
          <button
            aria-pressed={playing}
            onClick={() => setPlaying((value) => !value)}
            type="button"
          >
            {playing ? "Motion: Live" : "Motion: Still"}
          </button>
        </div>
      </section>
      {viewNavigation}
      <div className="trace-workbench">
        <section className="trace-tree-canvas-shell">
          <header className="trace-timeline-head">
            <strong>Span call tree</strong>
            <span>Click a Span or exact relationship · deterministic geometry</span>
          </header>
          {narrow ? (
            <div
              aria-label="Recorded trace call tree"
              className="trace-tree-outline"
              role="tree"
            >
              {trace.nodes.map((node) => (
                <TreeOutlineRow
                  key={node.id}
                  node={node}
                  onSelect={selectNode}
                  trace={trace}
                />
              ))}
            </div>
          ) : (
            <div
              aria-label="Recorded trace call tree"
              className="trace-tree-canvas"
              role="tree"
            >
              {[0, 1, 2].map((depth) => (
                <span
                  aria-hidden="true"
                  className={`trace-depth-label trace-depth-${depth}`}
                  key={depth}
                >
                  {`Depth ${depth}${depth === 0 ? " · root" : depth === 1 ? " · calls" : " · operations"}`}
                </span>
              ))}
              <i aria-hidden="true" className="trace-depth-divider trace-depth-divider-1" />
              <i aria-hidden="true" className="trace-depth-divider trace-depth-divider-2" />
              <svg
                aria-label="Recorded span call tree graph"
                className="trace-tree-svg"
                role="img"
                viewBox="0 0 980 560"
              >
                <defs>
                  <marker
                    id="trace-parent-arrow"
                    markerHeight="7"
                    markerWidth="7"
                    orient="auto"
                    refX="7"
                    refY="4"
                    viewBox="0 0 8 8"
                  >
                    <path d="M0 0L8 4L0 8Z" />
                  </marker>
                  <marker
                    id="trace-link-arrow"
                    markerHeight="7"
                    markerWidth="7"
                    orient="auto"
                    refX="7"
                    refY="4"
                    viewBox="0 0 8 8"
                  >
                    <path d="M0 0L8 4L0 8Z" />
                  </marker>
                </defs>
                {coalescedParentGeometry
                  ? [
                      {
                        key: "default",
                        items: parentGeometry.filter(
                          ({ child, parent }) =>
                            lens === "none" ||
                            (lensIds.has(parent.node.id) &&
                              lensIds.has(child.node.id)),
                        ),
                        className: lens === "none" ? "" : " is-focused",
                      },
                      {
                        key: "muted",
                        items:
                          lens === "none"
                            ? []
                            : parentGeometry.filter(
                                ({ child, parent }) =>
                                  !(
                                    lensIds.has(parent.node.id) &&
                                    lensIds.has(child.node.id)
                                  ),
                              ),
                        className: " is-muted",
                      },
                    ].flatMap(({ key, items, className }) =>
                      items.length === 0
                        ? []
                        : [
                            <path
                              className={`trace-tree-edge${className}`}
                              d={items.map(({ path }) => path).join(" ")}
                              data-relationship="PARENT_EDGE"
                              data-relationship-count={items.length}
                              key={`parent-coalesced-${key}`}
                            />,
                          ],
                    )
                  : parentGeometry.map(({ child, parent, path }) => {
                      const focused =
                        lens !== "none" &&
                        lensIds.has(parent.node.id) &&
                        lensIds.has(child.node.id);
                      return (
                        <path
                          className={`trace-tree-edge${focused ? " is-focused" : lens === "none" ? "" : " is-muted"}`}
                          d={path}
                          data-relationship="PARENT_EDGE"
                          data-relationship-count="1"
                          data-source={parent.node.id}
                          data-target={child.node.id}
                          key={`parent-${child.node.id}`}
                        />
                      );
                    })}
                {trace.links.map((link) => {
                  const from = byId.get(link.from.span_id);
                  const to = byId.get(link.to.span_id);
                  const d =
                    from === undefined
                      ? ""
                      : to === undefined
                        ? `M${from.x + 95} ${from.y + 70} C${from.x + 150} ${from.y + 115} 900 ${from.y + 115} 950 ${from.y + 80}`
                        : edgePath(from, to);
                  return (
                    <path
                      className={`trace-tree-edge trace-tree-link${lens === "none" ? "" : " is-muted"}`}
                      d={d}
                      data-relationship="LINK"
                      data-source={link.from.span_id}
                      data-target={link.to.span_id}
                      key={`link-${link.id}`}
                    />
                  );
                })}
                {geometry.map(({ node, x, y }) => (
                  <TreeNodeGlyph
                    key={node.id}
                    current={
                      position >= percentage(node.startOffsetNano, duration) &&
                      position <=
                        percentage(node.startOffsetNano, duration) +
                          percentage(node.durationNano, duration)
                    }
                    lensHit={lens === "none" || lensIds.has(node.id)}
                    node={node}
                    onSelect={selectNode}
                    playing={playing}
                    selected={selected.id === node.id}
                    traceDurationNano={duration}
                    x={x}
                    y={y}
                  />
                ))}
              </svg>
              <aside
                aria-label="Semantic camera map"
                className="trace-camera-map"
                role="region"
              >
                <strong>Semantic camera map</strong>
                <div>
                  {geometry.map(({ node }) => (
                    <i key={node.id} />
                  ))}
                </div>
              </aside>
            </div>
          )}
          <RecordedLinks trace={trace} />
        </section>
        <SpanPassport node={selected} trace={trace}>
          <p className="trace-focus-receipt">{lensReceipt}</p>
          <div className="trace-passport-actions">
            <button onClick={() => setLens("ancestors")} type="button">
              Ancestors
            </button>
            <button onClick={() => setLens("descendants")} type="button">
              Descendants
            </button>
            <button onClick={() => setLens("none")} type="button">
              Clear lens
            </button>
          </div>
        </SpanPassport>
      </div>
      <TraceMotion
        durationNano={duration}
        onPlayingChange={setPlaying}
        onPositionChange={setPosition}
        playing={playing}
        position={position}
        reducedMotion={false}
      />
    </section>
  );
}

export function TraceStatistics({
  trace,
  viewNavigation,
}: {
  trace: TraceView;
  viewNavigation?: ReactNode;
}) {
  if (trace.status !== "READY" || trace.durationNano === undefined)
    return <InvalidTrace trace={trace} />;
  const errorCount = trace.nodes.filter(
    ({ status }) => status === "ERROR",
  ).length;
  const maximum = trace.nodes.reduce(
    (current, node) =>
      BigInt(node.durationNano) > BigInt(current) ? node.durationNano : current,
    "0",
  );
  const rows = [
    ["Recorded spans", String(trace.nodes.length)],
    ["Recorded links", String(trace.links.length)],
    ["ERROR spans", String(errorCount)],
    ["Maximum recorded duration", `${maximum} ns`],
  ];
  const statusCounts = Object.entries(
    trace.nodes.reduce<Record<string, number>>((counts, node) => {
      counts[node.status] = (counts[node.status] ?? 0) + 1;
      return counts;
    }, {}),
  );
  const kindCounts = Object.entries(
    trace.nodes.reduce<Record<string, number>>((counts, node) => {
      counts[node.kind] = (counts[node.kind] ?? 0) + 1;
      return counts;
    }, {}),
  );
  return (
    <section
      aria-label="Recorded trace statistics"
      className="trace-view trace-statistics"
      data-trace-renderer="statistics"
    >
      <header className="trace-statistics-intro">
        <span className="trace-eyebrow">Exact recorded inventory</span>
        <h2>Trace statistics</h2>
        <p>
        Exact inventory and recorded-time aggregates only; no inferred
        causality.
        </p>
      </header>
      {viewNavigation}
      <dl className="trace-statistics-summary">
        {rows.map(([label, value]) => (
          <div className="panel-card" key={label}>
            <dt>{label}</dt>
            <dd className="numeric-exact">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="trace-statistics-grid">
        <section className="panel-card">
          <h3>Recorded status inventory</h3>
          {statusCounts.map(([label, value]) => (
            <div className="trace-stat-row" key={label}>
              <span>{label}</span><strong>{value}</strong>
              <i style={{ width: `${(value / trace.nodes.length) * 100}%` }} />
            </div>
          ))}
        </section>
        <section className="panel-card">
          <h3>Recorded kind inventory</h3>
          {kindCounts.map(([label, value]) => (
            <div className="trace-stat-row" key={label}>
              <span>{label}</span><strong>{value}</strong>
              <i style={{ width: `${(value / trace.nodes.length) * 100}%` }} />
            </div>
          ))}
        </section>
        <section className="panel-card trace-duration-distribution">
          <h3>Recorded duration distribution</h3>
          {trace.nodes.map((node) => (
            <div className="trace-duration-row" key={node.id}>
              <span>{node.label}</span>
              <i style={{ width: `${percentage(node.durationNano, maximum)}%` }} />
              <code>{displayNano(node.durationNano)}</code>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
