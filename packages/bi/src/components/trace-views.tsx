import { scaleLinear } from "d3";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { TraceView, TraceViewNode } from "../domain/trace/trace-view";
import {
  ButtonGroup,
  IconButton,
  TextInput,
  Typography,
} from "./design-system";
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

function nanoAtPercent(durationNano: string, percent: number): string {
  return String(
    (BigInt(durationNano) * BigInt(Math.round(percent * 100))) / 10_000n,
  );
}

function displayRecordedStart(value: string): string {
  const milliseconds = BigInt(value) / 1_000_000n;
  if (milliseconds < 86_400_000n) return displayNano(value);
  return new Date(Number(milliseconds)).toISOString().slice(11, 23);
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

const waterfallAxisHeight = 32;
const waterfallRowHeight = 48;
const waterfallFallbackWidth = 800;
const waterfallViewportHeight = 384;
const waterfallVirtualOverscan = 3;
const waterfallAxisLabelGap = 6;
const waterfallAxisLabelCharacterWidth = 7;
const waterfallTimelineLabelPadding = 6;
const waterfallTimelineLabelCharacterWidth = 7;
const waterfallTimelineMotionDuration = 280;

type TimelineMotionDirection = "left" | "right";
type TimelineMotion = {
  direction: TimelineMotionDirection;
  phase: "enter" | "exit";
  width: number;
  x: number;
};

function waterfallAxisLabelFits(
  label: string,
  tickX: number,
  availableUntilX: number,
) {
  return (
    availableUntilX - tickX >=
    waterfallAxisLabelGap + label.length * waterfallAxisLabelCharacterWidth
  );
}

function truncateWaterfallTimelineLabel(label: string, width: number) {
  const available = Math.max(0, width - waterfallTimelineLabelPadding * 2);
  const visibleCharacters = Math.floor(
    available / waterfallTimelineLabelCharacterWidth,
  );
  if (label.length <= visibleCharacters) return label;
  if (visibleCharacters <= 0) return "";
  if (visibleCharacters === 1) return "…";
  return `${label.slice(0, visibleCharacters - 1)}…`;
}

function timelineGeometryAtZoom(
  node: TraceViewNode,
  durationNano: number,
  zoom: [number, number],
  chartWidth: number,
) {
  const domainStart = (durationNano * zoom[0]) / 100;
  const domainEnd = (durationNano * zoom[1]) / 100;
  const nodeStart = Number(node.startOffsetNano);
  const nodeEnd = nodeStart + Number(node.durationNano);
  const clippedStart = Math.max(nodeStart, domainStart);
  const clippedEnd = Math.min(nodeEnd, domainEnd);
  const visible = clippedEnd > clippedStart && domainEnd > domainStart;
  const scale = scaleLinear([domainStart, domainEnd], [0, chartWidth]);
  const x = visible ? scale(clippedStart) : 0;
  return {
    visible,
    width: visible ? Math.max(1, scale(clippedEnd) - x) : 0,
    x,
  };
}

function minimapStrokeWidth(spanCount: number) {
  if (spanCount > 32) return 0.5;
  if (spanCount > 16) return 1;
  return 2;
}

function useMeasuredWidth<T extends Element>(fallback: number) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const update = () => {
      const measured = element.getBoundingClientRect().width;
      if (measured > 0) setWidth(measured);
    };
    update();
    if (typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
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
    <section
      aria-label="Span passport"
      className="span-passport"
      data-testid="span-passport"
    >
      <header className="trace-passport-head">
        <strong>Span Passport</strong>
        <span>Exact focus</span>
      </header>
      <div className="trace-passport-body">
        <div className="trace-passport-title">
          <span
            aria-hidden="true"
            className={`trace-passport-sigil trace-kind-${node.kind.toLowerCase()}`}
          >
            {node.kind === "CLIENT" ? "↗" : "◆"}
          </span>
          <div>
            <strong className="trace-passport-name">{node.label}</strong>
            <small>{`${node.kind} · depth ${node.depth}`}</small>
          </div>
        </div>
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
      </div>
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

const WaterfallLabelRow = memo(function WaterfallLabelRow({
  node,
  selected,
  hasChildren,
  collapsed,
  onToggle,
  onSelect,
  positionInSet,
  setSize,
}: {
  node: TraceViewNode;
  selected: boolean;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle(id: string): void;
  onSelect(id: string): void;
  positionInSet: number;
  setSize: number;
}) {
  return (
    <div
      aria-level={node.depth + 1}
      aria-posinset={positionInSet}
      aria-selected={selected}
      aria-setsize={setSize}
      className={`trace-waterfall-row${selected ? " is-selected" : ""}`}
      data-testid="trace-waterfall-row"
      data-timeline-span-id={node.id}
      data-trace-node-id={node.id}
      data-virtual-row={positionInSet - 1}
      onClick={() => onSelect(node.id)}
      role="treeitem"
    >
      <div className="trace-node-label">
        {hasChildren ? (
          <button
            aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.label} descendants`}
            className="trace-collapse-control"
            data-testid="trace-waterfall-collapse"
            data-trace-node-id={node.id}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.id);
              onToggle(node.id);
            }}
            type="button"
          >
            {collapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span aria-hidden="true" className="trace-collapse-placeholder" />
        )}
        <span
          aria-hidden="true"
          className="trace-indent-items"
          data-indent-depth={node.depth}
        >
          {Array.from({ length: node.depth }, (_, depth) => (
            <i
              className="trace-indent-item"
              data-guide-depth={depth % 4}
              data-guide-owner-id={node.id}
              data-testid="trace-waterfall-indent-guide"
              data-trace-depth={depth}
              key={`${node.id}:indent:${depth}`}
            />
          ))}
        </span>
        <button
          aria-label={`${node.label}, ${node.durationNano} nanoseconds`}
          className="recorded-node trace-node-main"
          data-testid="trace-waterfall-node"
          data-trace-node-id={node.id}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(node.id);
          }}
          type="button"
        >
          <span className="trace-node-title-line">
            <span
              className={`trace-glyph trace-kind-${node.kind.toLowerCase()}`}
            >
              {node.kind === "CLIENT" ? "↗" : "◆"}
            </span>
            <strong>{node.label}</strong>
          </span>
          <small>{`${node.kind} · ${compactIdentity(node.id)}`}</small>
        </button>
        <span
          className={node.status === "ERROR" ? "trace-error" : "numeric-exact"}
        >
          {displayNano(node.durationNano)}
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
  const [waterfallScrollTop, setWaterfallScrollTop] = useState(0);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [zoom, setZoom] = useState<[number, number]>([0, 100]);
  const zoomValue = useRef<[number, number]>([0, 100]);
  const [timelineMotions, setTimelineMotions] = useState(
    () => new Map<string, TimelineMotion>(),
  );
  const timelineMotionTimers = useRef(new Map<string, number>());
  const timelineClipPrefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const zoomDrag = useRef<
    | { mode: "select"; anchor: number }
    | {
        mode: "move";
        pointerStart: number;
        zoomStart: [number, number];
      }
    | {
        mode: "resize-left" | "resize-right";
        zoomStart: [number, number];
      }
    | undefined
  >(undefined);
  const narrow = useNarrowTraceView();
  const [chartRef, chartWidth] = useMeasuredWidth<SVGSVGElement>(
    waterfallFallbackWidth,
  );
  const selectNode = useCallback((id: string) => setSelectedId(id), []);
  useEffect(
    () => () => {
      for (const timer of timelineMotionTimers.current.values())
        window.clearTimeout(timer);
    },
    [],
  );
  if (trace.status !== "READY" || trace.durationNano === undefined)
    return <InvalidTrace trace={trace} />;
  const normalized = query.trim().toLocaleLowerCase();
  const matchingNodes = trace.nodes.filter(
    (node) =>
      normalized === "" ||
      node.label.toLocaleLowerCase().includes(normalized) ||
      node.id.toLocaleLowerCase().includes(normalized),
  );
  const nodes = matchingNodes.filter((node) => {
    if (normalized !== "") return true;
    let parentId = node.parentId;
    while (parentId !== undefined) {
      if (collapsedIds.has(parentId)) return false;
      parentId = trace.nodes.find(({ id }) => id === parentId)?.parentId;
    }
    return true;
  });
  const selected =
    trace.nodes.find((node) => node.id === selectedId) ?? trace.nodes[0]!;
  const errorCount = trace.nodes.filter(
    ({ status }) => status === "ERROR",
  ).length;
  const nodesWithChildren = new Set(
    trace.nodes
      .filter((node) => nodeChildren(trace, node).length > 0)
      .map(({ id }) => id),
  );
  const applyZoom = (next: [number, number], animateMovement: boolean) => {
    const previous = zoomValue.current;
    if (animateMovement && next[0] !== previous[0] && !reducedMotion) {
      const direction: TimelineMotionDirection =
        next[0] < previous[0] ? "right" : "left";
      const motionUpdates: Array<[string, TimelineMotion]> = [];
      trace.nodes.forEach((node, row) => {
        const before = timelineGeometryAtZoom(
          node,
          Number(trace.durationNano),
          previous,
          chartWidth,
        );
        const after = timelineGeometryAtZoom(
          node,
          Number(trace.durationNano),
          next,
          chartWidth,
        );
        if (before.visible === after.visible) return;
        const phase = after.visible ? "enter" : "exit";
        const geometry = phase === "enter" ? after : before;
        motionUpdates.push([
          node.id,
          {
            direction,
            phase,
            width: geometry.width,
            x: geometry.x,
          },
        ]);
        const activeTimer = timelineMotionTimers.current.get(node.id);
        if (activeTimer !== undefined) window.clearTimeout(activeTimer);
        const timer = window.setTimeout(
          () => {
            timelineMotionTimers.current.delete(node.id);
            setTimelineMotions((current) => {
              if (!current.has(node.id)) return current;
              const updated = new Map(current);
              updated.delete(node.id);
              return updated;
            });
          },
          waterfallTimelineMotionDuration + row * 18 + 80,
        );
        timelineMotionTimers.current.set(node.id, timer);
      });
      if (motionUpdates.length > 0)
        setTimelineMotions((current) => {
          const updated = new Map(current);
          for (const [id, motion] of motionUpdates) updated.set(id, motion);
          return updated;
        });
    }
    zoomValue.current = next;
    setZoom(next);
  };
  const updateZoom = (
    event: React.PointerEvent<HTMLDivElement>,
    commit: boolean,
  ) => {
    const drag = zoomDrag.current;
    if (drag === undefined) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const current = Math.max(
      0,
      Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100),
    );
    if (drag.mode === "move") {
      const width = drag.zoomStart[1] - drag.zoomStart[0];
      const start = Math.max(
        0,
        Math.min(100 - width, drag.zoomStart[0] + current - drag.pointerStart),
      );
      applyZoom([start, start + width], true);
    } else if (drag.mode === "resize-left") {
      applyZoom(
        [Math.min(current, drag.zoomStart[1] - 1), drag.zoomStart[1]],
        false,
      );
    } else if (drag.mode === "resize-right") {
      applyZoom(
        [drag.zoomStart[0], Math.max(current, drag.zoomStart[0] + 1)],
        false,
      );
    } else if (drag.mode === "select") {
      const next: [number, number] = [
        Math.min(drag.anchor, current),
        Math.max(drag.anchor, current),
      ];
      if (next[1] - next[0] >= 1) applyZoom(next, false);
    }
    if (commit) zoomDrag.current = undefined;
  };
  const tickPercents = [0, 25, 50, 75, 100];
  const durationNano = Number(trace.durationNano);
  const domainStart = (durationNano * zoom[0]) / 100;
  const domainEnd = (durationNano * zoom[1]) / 100;
  const timelineScale = scaleLinear([domainStart, domainEnd], [0, chartWidth]);
  const timelineTicks = timelineScale.ticks(
    Math.max(2, Math.floor(chartWidth / 96)),
  );
  const totalWaterfallHeight = nodes.length * waterfallRowHeight;
  const waterfallBodyHeight = Math.min(
    waterfallViewportHeight,
    totalWaterfallHeight,
  );
  const effectiveScrollTop = Math.min(
    waterfallScrollTop,
    Math.max(0, totalWaterfallHeight - waterfallBodyHeight),
  );
  const visibleStart = Math.max(
    0,
    Math.floor(effectiveScrollTop / waterfallRowHeight) -
      waterfallVirtualOverscan,
  );
  const visibleEnd = Math.min(
    nodes.length,
    Math.ceil((effectiveScrollTop + waterfallBodyHeight) / waterfallRowHeight) +
      waterfallVirtualOverscan,
  );
  const virtualNodes = nodes
    .slice(visibleStart, visibleEnd)
    .map((node, row) => ({
      node,
      row: visibleStart + row,
    }));
  const chartHeight = waterfallAxisHeight + waterfallBodyHeight;
  const timelineItems = virtualNodes.map(({ node, row }) => {
    const geometry = timelineGeometryAtZoom(
      node,
      durationNano,
      zoom,
      chartWidth,
    );
    const motion = timelineMotions.get(node.id);
    const displayedGeometry =
      !geometry.visible && motion?.phase === "exit" ? motion : geometry;
    return {
      ...geometry,
      displayedWidth: displayedGeometry.width,
      displayedX: displayedGeometry.x,
      label: truncateWaterfallTimelineLabel(
        node.label,
        displayedGeometry.width,
      ),
      motion,
      node,
      row,
      y: waterfallAxisHeight + row * waterfallRowHeight - effectiveScrollTop,
    };
  });
  return (
    <section
      aria-label="Recorded trace waterfall"
      className="trace-view trace-waterfall"
      data-motion={reducedMotion ? "off" : "zoom-transition"}
      data-testid="trace-waterfall"
      data-trace-renderer="waterfall"
    >
      {viewNavigation}
      <header className="trace-summary trace-summary-dense">
        <div className="trace-summary-identity">
          <Typography variant="eyebrow">Exact recorded timeline</Typography>
          <Typography as="strong" variant="sectionTitle">
            {trace.nodes[0]?.label ?? trace.traceId}
          </Typography>
          <Typography as="code" variant="code">
            {trace.traceId}
          </Typography>
        </div>
        <div className="trace-summary-metrics">
          {[
            ["Duration", displayNano(trace.durationNano), "default"],
            [
              "Start",
              displayRecordedStart(trace.startTimeUnixNano!),
              "default",
            ],
            ["Spans", String(trace.nodes.length), "default"],
            [
              "Errors",
              String(errorCount),
              errorCount > 0 ? "error" : "success",
            ],
          ].map(([label, value, tone]) => (
            <span className="trace-summary-stat" data-tone={tone} key={label}>
              <Typography as="small" variant="caption">
                {label}
              </Typography>
              <Typography
                as="strong"
                className="numeric-exact"
                variant="sectionTitle"
              >
                {value}
              </Typography>
            </span>
          ))}
        </div>
      </header>
      <section aria-label="Recorded trace minimap" className="trace-minimap">
        <div className="trace-minimap-copy">
          <Typography as="strong" variant="label">
            Trace minimap
          </Typography>
          <Typography as="small" variant="caption">
            Drag to zoom
          </Typography>
        </div>
        <div
          aria-label="Trace minimap zoom window"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuetext={`${displayNano(nanoAtPercent(trace.durationNano, zoom[0]))} to ${displayNano(nanoAtPercent(trace.durationNano, zoom[1]))}`}
          className="trace-minimap-track"
          data-testid="trace-waterfall-data-zoom"
          onPointerDown={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const pointerStart = Math.max(
              0,
              Math.min(
                100,
                ((event.clientX - bounds.left) / bounds.width) * 100,
              ),
            );
            const movingWindow =
              event.target instanceof Element &&
              event.target.closest(".trace-minimap-window") !== null;
            const resizeHandle =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>(
                    ".trace-minimap-resize-handle",
                  )
                : null;
            const resizeEdge = resizeHandle?.dataset.edge;
            zoomDrag.current =
              resizeEdge === "left" || resizeEdge === "right"
                ? { mode: `resize-${resizeEdge}`, zoomStart: zoom }
                : movingWindow
                  ? { mode: "move", pointerStart, zoomStart: zoom }
                  : { mode: "select", anchor: pointerStart };
            if (!movingWindow) applyZoom([pointerStart, pointerStart], false);
            event.currentTarget.setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => updateZoom(event, false)}
          onPointerUp={(event) => updateZoom(event, true)}
          role="slider"
          tabIndex={0}
        >
          <span
            aria-hidden="true"
            className="trace-minimap-ruler"
            data-testid="trace-waterfall-data-zoom-ruler"
          >
            {tickPercents.map((tick) => (
              <span
                data-time-percent={tick}
                key={tick}
                style={{ insetInlineStart: `${tick}%` }}
              >
                {displayNano(nanoAtPercent(trace.durationNano!, tick))}
              </span>
            ))}
          </span>
          <svg
            aria-hidden="true"
            className="trace-minimap-overview"
            data-testid="trace-waterfall-minimap-overview"
            preserveAspectRatio="none"
            viewBox={`0 0 100 ${Math.max(1, trace.nodes.length)}`}
          >
            {trace.nodes.map((node, row) => {
              const start = percentage(
                node.startOffsetNano,
                trace.durationNano!,
              );
              const end = Math.min(
                100,
                start + percentage(node.durationNano, trace.durationNano!),
              );
              const y = row + 0.5;
              return (
                <line
                  className={`trace-minimap-span trace-kind-${node.kind.toLowerCase()}${node.status === "ERROR" ? " trace-status-error" : ""}`}
                  data-color-index={node.depth % 4}
                  data-minimap-row={row}
                  data-testid="trace-waterfall-minimap-span"
                  data-trace-node-id={node.id}
                  key={node.id}
                  strokeWidth={minimapStrokeWidth(trace.nodes.length)}
                  x1={start}
                  x2={end}
                  y1={y}
                  y2={y}
                />
              );
            })}
          </svg>
          <span
            className="trace-minimap-window"
            data-full={zoom[0] === 0 && zoom[1] === 100 ? "true" : "false"}
            data-testid="trace-waterfall-data-zoom-window"
            style={{
              insetInlineStart: `${zoom[0]}%`,
              width: `${zoom[1] - zoom[0]}%`,
            }}
          >
            <span
              aria-label="Resize trace zoom start"
              className="trace-minimap-resize-handle"
              data-edge="left"
              data-testid="trace-waterfall-data-zoom-handle-left"
              role="separator"
              tabIndex={0}
            />
            <span
              aria-label="Resize trace zoom end"
              className="trace-minimap-resize-handle"
              data-edge="right"
              data-testid="trace-waterfall-data-zoom-handle-right"
              role="separator"
              tabIndex={0}
            />
          </span>
        </div>
      </section>
      <div className="trace-workbench">
        {narrow ? (
          <section className="trace-waterfall-mobile">
            <header>Span tree · exact duration</header>
            <div
              aria-label="Recorded waterfall span outline"
              data-testid="trace-waterfall-span-tree"
              role="tree"
            >
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
            <header className="trace-waterfall-toolbar">
              <div className="trace-waterfall-heading">
                <Typography as="strong" variant="label">
                  Span tree
                </Typography>
              </div>
              <TextInput
                aria-label="Search recorded spans"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search span name or exact identity"
                value={query}
              />
              <ButtonGroup
                aria-label="Span tree actions"
                className="trace-waterfall-actions"
                role="group"
              >
                <IconButton
                  appearance="ghost"
                  aria-label="Expand all spans"
                  onClick={() => setCollapsedIds(new Set())}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16">
                    <path d="M4 6 8 2l4 4M4 10l4 4 4-4" />
                  </svg>
                </IconButton>
                <IconButton
                  appearance="ghost"
                  aria-label="Collapse all spans"
                  onClick={() => setCollapsedIds(new Set(nodesWithChildren))}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16">
                    <path d="m4 2 4 4 4-4M4 14l4-4 4 4" />
                  </svg>
                </IconButton>
                <IconButton
                  appearance="ghost"
                  aria-label="Reset focus"
                  onClick={() => {
                    setSelectedId(trace.nodes[0]?.id);
                    setTimelineMotions(new Map());
                    applyZoom([0, 100], false);
                  }}
                  type="button"
                >
                  <svg aria-hidden="true" viewBox="0 0 16 16">
                    <path d="M13 5V2l-2 2A5 5 0 1 0 13 9" />
                  </svg>
                </IconButton>
              </ButtonGroup>
            </header>
            <div className="trace-waterfall-table">
              <div className="trace-waterfall-label-pane">
                <div className="trace-waterfall-column-head">
                  Span / exact identity
                </div>
                <div
                  className="trace-waterfall-scroll-viewport"
                  data-testid="trace-waterfall-scroll-viewport"
                  data-total-rows={nodes.length}
                  data-virtual-end={visibleEnd}
                  data-virtual-start={visibleStart}
                  onScroll={(event) =>
                    setWaterfallScrollTop(event.currentTarget.scrollTop)
                  }
                  style={{ height: waterfallBodyHeight }}
                >
                  <div
                    className="trace-waterfall-scroll-space"
                    style={{ height: totalWaterfallHeight }}
                  >
                    <div
                      aria-label="Recorded waterfall span outline"
                      className="trace-waterfall-label-rows"
                      data-testid="trace-waterfall-span-tree"
                      role="tree"
                      style={{
                        transform: `translateY(${visibleStart * waterfallRowHeight}px)`,
                      }}
                    >
                      {virtualNodes.map(({ node, row }) => {
                        return (
                          <WaterfallLabelRow
                            collapsed={collapsedIds.has(node.id)}
                            hasChildren={nodesWithChildren.has(node.id)}
                            key={node.id}
                            node={node}
                            onSelect={selectNode}
                            onToggle={(id) =>
                              setCollapsedIds((current) => {
                                const next = new Set(current);
                                if (next.has(id)) next.delete(id);
                                else next.add(id);
                                return next;
                              })
                            }
                            positionInSet={row + 1}
                            selected={selected.id === node.id}
                            setSize={nodes.length}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <svg
                aria-label="Recorded waterfall timeline chart"
                className="trace-waterfall-chart"
                data-total-rows={nodes.length}
                data-testid="trace-waterfall-chart"
                data-virtual-end={visibleEnd}
                data-virtual-start={visibleStart}
                height={chartHeight}
                ref={chartRef}
                role="img"
                width="100%"
              >
                <defs>
                  {timelineItems.map(
                    ({ displayedWidth, displayedX, node, row, y }) => (
                      <clipPath
                        id={`${timelineClipPrefix}-timeline-label-${row}`}
                        key={`${node.id}:label-clip`}
                      >
                        <rect
                          height={18}
                          rx={4}
                          width={displayedWidth}
                          x={displayedX}
                          y={y + 15}
                        />
                      </clipPath>
                    ),
                  )}
                </defs>
                <line
                  className="trace-waterfall-axis-line"
                  x1={0}
                  x2={chartWidth}
                  y1={waterfallAxisHeight - 1}
                  y2={waterfallAxisHeight - 1}
                />
                {timelineItems.map(
                  ({
                    displayedWidth,
                    displayedX,
                    motion,
                    node,
                    row,
                    visible,
                    y,
                  }) => {
                    const isSelected = selected.id === node.id;
                    return (
                      <g
                        aria-label={`${node.label}, ${displayNano(node.durationNano)}`}
                        aria-pressed={isSelected}
                        className="trace-waterfall-lane"
                        data-selected={isSelected}
                        data-testid="trace-waterfall-lane"
                        data-trace-node-id={node.id}
                        data-virtual-row={row}
                        key={node.id}
                        onClick={() => selectNode(node.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectNode(node.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <rect
                          className="trace-waterfall-lane-hit-target"
                          height={waterfallRowHeight}
                          width={chartWidth}
                          x={0}
                          y={y}
                        />
                        <g
                          className="trace-waterfall-timeline"
                          data-motion-direction={motion?.direction}
                          data-motion-phase={motion?.phase}
                          data-testid="trace-waterfall-timeline"
                          data-trace-node-id={node.id}
                          data-visible={visible}
                          style={{
                            animationDelay: `${(row - visibleStart) * 18}ms`,
                          }}
                        >
                          <rect
                            className={`trace-timeline-bar trace-kind-${node.kind.toLowerCase()}${node.status === "ERROR" ? " trace-status-error" : ""}`}
                            data-color-index={node.depth % 4}
                            data-testid="trace-waterfall-bar"
                            data-trace-node-id={node.id}
                            height={18}
                            rx={4}
                            width={displayedWidth}
                            x={displayedX}
                            y={y + 15}
                          >
                            <title>{node.label}</title>
                          </rect>
                        </g>
                      </g>
                    );
                  },
                )}
                {timelineTicks.map((tick, index) => {
                  const x = timelineScale(tick);
                  const label = displayNano(String(Math.round(tick)));
                  const nextTick = timelineTicks[index + 1];
                  const availableUntilX =
                    nextTick === undefined
                      ? chartWidth
                      : timelineScale(nextTick);
                  const showLabel = waterfallAxisLabelFits(
                    label,
                    x,
                    availableUntilX,
                  );
                  return (
                    <g
                      className="trace-waterfall-axis-tick"
                      data-testid="trace-waterfall-axis-tick"
                      key={tick}
                      transform={`translate(${x} 0)`}
                    >
                      <line
                        className="trace-waterfall-gridline"
                        y1={0}
                        y2={chartHeight}
                      />
                      {showLabel ? (
                        <text
                          textAnchor="start"
                          x={waterfallAxisLabelGap}
                          y={waterfallAxisHeight - 10}
                        >
                          {label}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {timelineItems.map(
                  ({
                    displayedWidth,
                    displayedX,
                    label,
                    motion,
                    node,
                    row,
                    y,
                  }) => {
                    if (displayedWidth <= 0) return null;
                    return (
                      <text
                        clipPath={`url(#${timelineClipPrefix}-timeline-label-${row})`}
                        className="trace-timeline-label"
                        data-motion-direction={motion?.direction}
                        data-motion-phase={motion?.phase}
                        data-testid="trace-waterfall-label"
                        data-trace-node-id={node.id}
                        dominantBaseline="middle"
                        key={`${node.id}:label`}
                        style={{
                          animationDelay: `${(row - visibleStart) * 18}ms`,
                        }}
                        x={displayedX + waterfallTimelineLabelPadding}
                        y={y + waterfallRowHeight / 2}
                      >
                        {label}
                      </text>
                    );
                  },
                )}
              </svg>
            </div>
            <RecordedLinks trace={trace} />
          </section>
        )}
        <SpanPassport node={selected} trace={trace} />
      </div>
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
  summary,
  traceDurationNano,
  onSelect,
}: GeometryNode & {
  selected: boolean;
  lensHit: boolean;
  current: boolean;
  playing: boolean;
  summary: boolean;
  traceDurationNano: string;
  onSelect(id: string): void;
}) {
  const select = () => onSelect(node.id);
  return (
    <g
      aria-label={`${node.label}, ${node.kind}, ${node.status}, ${displayNano(node.durationNano)}`}
      aria-level={node.depth + 1}
      className={`trace-tree-node trace-kind-${node.kind.toLowerCase()}${selected ? " is-selected" : ""}${lensHit ? " is-lens-hit" : " is-lens-muted"}${current && playing ? " is-time-current" : ""}${node.status === "ERROR" ? " trace-status-error" : ""}`}
      data-render-detail={summary ? "summary" : "complete"}
      data-testid="trace-tree-node"
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
      {summary ? (
        <>
          <text className="trace-tree-name" x="14" y="31">
            {node.label}
          </text>
          <text className="trace-tree-duration" textAnchor="end" x="176" y="50">
            {displayNano(node.durationNano)}
          </text>
        </>
      ) : (
        <>
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
        </>
      )}
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
        data-testid="trace-tree-node"
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

export const TraceTree = memo(function TraceTree({
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
      data-testid="trace-tree"
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
            <span>
              Click a Span or exact relationship · deterministic geometry
            </span>
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
              <i
                aria-hidden="true"
                className="trace-depth-divider trace-depth-divider-1"
              />
              <i
                aria-hidden="true"
                className="trace-depth-divider trace-depth-divider-2"
              />
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
                    summary={coalescedParentGeometry}
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
});

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
      data-testid="trace-statistics"
      data-trace-renderer="statistics"
    >
      <header className="trace-statistics-intro">
        <Typography as="span" className="trace-eyebrow" variant="eyebrow">
          Exact recorded inventory
        </Typography>
        <Typography as="h2" variant="sectionTitle">
          Trace statistics
        </Typography>
        <Typography as="p" variant="caption">
          Exact inventory and recorded-time aggregates only; no inferred
          causality.
        </Typography>
      </header>
      {viewNavigation}
      <dl className="trace-statistics-summary">
        {rows.map(([label, value]) => (
          <div className="panel-card" key={label}>
            <Typography as="dt" variant="label">
              {label}
            </Typography>
            <Typography as="dd" className="numeric-exact" variant="value">
              {value}
            </Typography>
          </div>
        ))}
      </dl>
      <div className="trace-statistics-grid">
        <section className="panel-card">
          <Typography as="h3" variant="sectionTitle">
            Recorded status inventory
          </Typography>
          {statusCounts.map(([label, value]) => (
            <div className="trace-stat-row" key={label}>
              <Typography variant="body">{label}</Typography>
              <Typography as="strong" variant="label">
                {value}
              </Typography>
              <i style={{ width: `${(value / trace.nodes.length) * 100}%` }} />
            </div>
          ))}
        </section>
        <section className="panel-card">
          <Typography as="h3" variant="sectionTitle">
            Recorded kind inventory
          </Typography>
          {kindCounts.map(([label, value]) => (
            <div className="trace-stat-row" key={label}>
              <Typography variant="body">{label}</Typography>
              <Typography as="strong" variant="label">
                {value}
              </Typography>
              <i style={{ width: `${(value / trace.nodes.length) * 100}%` }} />
            </div>
          ))}
        </section>
        <section className="panel-card trace-duration-distribution">
          <Typography as="h3" variant="sectionTitle">
            Recorded duration distribution
          </Typography>
          {trace.nodes.map((node) => (
            <div className="trace-duration-row" key={node.id}>
              <Typography variant="body">{node.label}</Typography>
              <i
                style={{ width: `${percentage(node.durationNano, maximum)}%` }}
              />
              <Typography as="code" variant="code">
                {displayNano(node.durationNano)}
              </Typography>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
