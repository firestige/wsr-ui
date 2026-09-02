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
            className={`trace-passport-sigil trace-kind-${node.kind.toLowerCase()}${node.status === "ERROR" ? " trace-status-error" : ""}`}
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
    <ul
      aria-label="Recorded span links"
      className="trace-link-list trace-sr-only"
    >
      {links.map((link) => (
        <li className="text-code" key={link.id}>
          {`Recorded LINK → ${link.to.trace_id}:${link.to.span_id}`}
        </li>
      ))}
    </ul>
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
  column: number;
  x: number;
  y: number;
}

function treeGeometry(trace: TraceView): GeometryNode[] {
  const byId = new Map(trace.nodes.map((node) => [node.id, node]));
  const columns = new Map<string, number>();
  const resolveColumn = (
    node: TraceViewNode,
    visiting = new Set<string>(),
  ): number => {
    const settled = columns.get(node.id);
    if (settled !== undefined) return settled;
    if (node.parentId === undefined || visiting.has(node.id)) return 0;
    const parent = byId.get(node.parentId);
    if (parent === undefined) return 0;
    const nextVisiting = new Set(visiting).add(node.id);
    const column = resolveColumn(parent, nextVisiting) + 1;
    columns.set(node.id, column);
    return column;
  };
  const byColumn = new Map<number, TraceViewNode[]>();
  for (const node of trace.nodes) {
    const column = resolveColumn(node);
    const row = byColumn.get(column) ?? [];
    row.push(node);
    byColumn.set(column, row);
  }
  return [...byColumn.entries()].flatMap(([column, nodes]) =>
    [...nodes]
      .sort(
        (left, right) =>
          compareText(left.startTimeUnixNano, right.startTimeUnixNano) ||
          compareText(left.id, right.id),
      )
      .map((node, index) => ({
        node,
        column,
        x: 60 + column * 330,
        y:
          nodes.length === 1
            ? 240
            : nodes.length === 2
              ? 110 + index * 245
              : 47 + index * (368 / (nodes.length - 1)),
      })),
  );
}

const treeWorldWidth = 980;
const treeWorldHeight = 560;
const treeNodeWidth = 190;
const treeNodeHeight = 70;

interface TreeCamera {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TreeCurve {
  startX: number;
  startY: number;
  middleX: number;
  endX: number;
  endY: number;
  kind: "parent" | "link";
  focused: boolean;
}

const treeFitCamera: TreeCamera = {
  x: 0,
  y: 0,
  width: treeWorldWidth,
  height: treeWorldHeight,
};

function normalizedTreeCamera(camera: TreeCamera): TreeCamera {
  const width = Math.min(treeWorldWidth, Math.max(392, camera.width));
  const height = Math.min(treeWorldHeight, Math.max(224, camera.height));
  return {
    x:
      Math.round(
        Math.max(0, Math.min(treeWorldWidth - width, camera.x)) * 1000,
      ) / 1000,
    y:
      Math.round(
        Math.max(0, Math.min(treeWorldHeight - height, camera.y)) * 1000,
      ) / 1000,
    width: Math.round(width * 1000) / 1000,
    height: Math.round(height * 1000) / 1000,
  };
}

function zoomTreeCamera(camera: TreeCamera, factor: number): TreeCamera {
  const width = camera.width * factor;
  const height = camera.height * factor;
  return normalizedTreeCamera({
    x: camera.x + (camera.width - width) / 2,
    y: camera.y + (camera.height - height) / 2,
    width,
    height,
  });
}

function formatTreeCamera(camera: TreeCamera): string {
  return `${camera.x} ${camera.y} ${camera.width} ${camera.height}`;
}

function treeCanvasProjection(
  width: number,
  height: number,
  camera: TreeCamera,
) {
  const scale = Math.min(width / camera.width, height / camera.height);
  return {
    scale,
    offsetX: (width - camera.width * scale) / 2,
    offsetY: (height - camera.height * scale) / 2,
  };
}

function treeCurve(
  from: GeometryNode,
  to: GeometryNode | undefined,
  kind: TreeCurve["kind"],
  focused: boolean,
): TreeCurve {
  const startX = from.x + treeNodeWidth;
  const startY = from.y + treeNodeHeight / 2;
  const endX = to?.x ?? treeWorldWidth - 30;
  const endY =
    to === undefined
      ? Math.min(treeWorldHeight - 40, startY + 80)
      : to.y + treeNodeHeight / 2;
  const middle = (startX + endX) / 2;
  return {
    startX,
    startY,
    middleX: middle,
    endX,
    endY,
    kind,
    focused,
  };
}

function pointOnTreeCurve(curve: TreeCurve, progress: number) {
  const firstLength = Math.abs(curve.middleX - curve.startX);
  const verticalLength = Math.abs(curve.endY - curve.startY);
  const lastLength = Math.abs(curve.endX - curve.middleX);
  const totalLength = firstLength + verticalLength + lastLength;
  let distance = progress * totalLength;
  const interpolate = (from: number, to: number, ratio: number) =>
    from + (to - from) * ratio;
  if (distance <= firstLength)
    return {
      x: interpolate(
        curve.startX,
        curve.middleX,
        firstLength === 0 ? 1 : distance / firstLength,
      ),
      y: curve.startY,
    };
  distance -= firstLength;
  if (distance <= verticalLength)
    return {
      x: curve.middleX,
      y: interpolate(
        curve.startY,
        curve.endY,
        verticalLength === 0 ? 1 : distance / verticalLength,
      ),
    };
  distance -= verticalLength;
  return {
    x: interpolate(
      curve.middleX,
      curve.endX,
      lastLength === 0 ? 1 : distance / lastLength,
    ),
    y: curve.endY,
  };
}

function treeCanvasColor(
  canvas: HTMLCanvasElement,
  token: string,
  fallback: string,
): string {
  const value = getComputedStyle(canvas).getPropertyValue(token).trim();
  return value === "" ? fallback : value;
}

const TreeOutlineRow = memo(function TreeOutlineRow({
  node,
  trace,
  onSelect,
  layout,
  showLinks = true,
}: {
  node: TraceViewNode;
  trace: TraceView;
  onSelect(id: string): void;
  layout?: GeometryNode;
  showLinks?: boolean;
}) {
  return (
    <div style={{ paddingInlineStart: `${node.depth * 1.5}rem` }}>
      <button
        aria-level={(layout?.column ?? node.depth) + 1}
        data-tree-x={layout?.x}
        data-tree-y={layout?.y}
        data-testid="trace-tree-node"
        data-trace-node-id={node.id}
        onClick={() => onSelect(node.id)}
        role="treeitem"
        type="button"
      >
        <span>{node.label}</span>
        <span>{displayNano(node.durationNano)}</span>
      </button>
      {showLinks ? <RecordedLinks node={node} trace={trace} /> : null}
    </div>
  );
});

export const TraceTree = memo(function TraceTree({
  trace,
  reducedMotion = false,
  viewNavigation,
}: {
  trace: TraceView;
  reducedMotion?: boolean;
  viewNavigation?: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [lens, setLens] = useState<"none" | "ancestors" | "descendants">(
    "none",
  );
  const [camera, setCamera] = useState<TreeCamera>(treeFitCamera);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const minimapDragging = useRef(false);
  const selectNode = useCallback((id: string) => setSelectedId(id), []);
  const narrow = useNarrowTraceView();
  const geometry = useMemo(
    () => (trace.status === "READY" ? treeGeometry(trace) : []),
    [trace],
  );
  const byId = useMemo(
    () => new Map(geometry.map((item) => [item.node.id, item])),
    [geometry],
  );
  const selected =
    trace.nodes.find((node) => node.id === selectedId) ?? trace.nodes[0];
  const lensIds = useMemo(() => {
    if (selected === undefined) return new Set<string>();
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
  }, [lens, selected, trace.nodes]);
  const parentCurves = useMemo(
    () =>
      geometry.flatMap((child) => {
        if (child.node.parentId === undefined) return [];
        const parent = byId.get(child.node.parentId);
        if (parent === undefined) return [];
        return [
          treeCurve(
            parent,
            child,
            "parent",
            lens === "none" ||
              (lensIds.has(parent.node.id) && lensIds.has(child.node.id)),
          ),
        ];
      }),
    [byId, geometry, lens, lensIds],
  );
  const linkCurves = useMemo(
    () =>
      trace.links.flatMap((link) => {
        const from = byId.get(link.from.span_id);
        if (from === undefined) return [];
        return [
          treeCurve(from, byId.get(link.to.span_id), "link", lens === "none"),
        ];
      }),
    [byId, lens, trace.links],
  );
  const curves = useMemo(
    () => [...parentCurves, ...linkCurves],
    [linkCurves, parentCurves],
  );
  const coalescedParentGeometry = parentCurves.length > 128;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      canvas === null ||
      typeof window.CanvasRenderingContext2D === "undefined"
    )
      return undefined;
    const context = canvas.getContext("2d");
    if (context === null) return undefined;
    let surface = "";
    let border = "";
    let primary = "";
    let secondary = "";
    let series1 = "";
    let series2 = "";
    let error = "";
    let selectedColor = "";
    let parentEdge = "";
    let linkEdge = "";
    const refreshPalette = () => {
      surface = treeCanvasColor(canvas, "--wsr-tree-node-surface", "#17212d");
      border = treeCanvasColor(canvas, "--wsr-tree-node-border", "#607084");
      primary = treeCanvasColor(canvas, "--content-primary", "#f1f5f9");
      secondary = treeCanvasColor(canvas, "--content-secondary", "#a9b4c2");
      series1 = treeCanvasColor(canvas, "--wsr-tree-internal-color", "#38bdf8");
      series2 = treeCanvasColor(canvas, "--wsr-tree-client-color", "#2dd4bf");
      error = treeCanvasColor(canvas, "--wsr-tree-error-color", "#fb7185");
      selectedColor = treeCanvasColor(
        canvas,
        "--wsr-tree-selected-color",
        "#38bdf8",
      );
      parentEdge = treeCanvasColor(
        canvas,
        "--wsr-tree-parent-edge-color",
        "#607084",
      );
      linkEdge = treeCanvasColor(
        canvas,
        "--wsr-tree-link-edge-color",
        "#fbbf24",
      );
    };
    refreshPalette();
    const duration = trace.durationNano ?? "0";
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let themeObserver: MutationObserver | undefined;

    const drawCurve = (curve: TreeCurve) => {
      context.save();
      context.globalAlpha = curve.focused ? 1 : 0.2;
      context.strokeStyle = curve.kind === "link" ? linkEdge : parentEdge;
      context.lineWidth = 2;
      context.setLineDash(curve.kind === "link" ? [7, 6] : []);
      context.beginPath();
      context.moveTo(curve.startX, curve.startY);
      context.lineTo(curve.middleX, curve.startY);
      context.lineTo(curve.middleX, curve.endY);
      context.lineTo(curve.endX, curve.endY);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = curve.kind === "link" ? linkEdge : parentEdge;
      const direction = curve.endX >= curve.startX ? 1 : -1;
      context.beginPath();
      context.moveTo(curve.endX, curve.endY);
      context.lineTo(curve.endX - direction * 9, curve.endY - 5);
      context.lineTo(curve.endX - direction * 9, curve.endY + 5);
      context.closePath();
      context.fill();
      context.restore();
    };

    const draw = (timestamp: number) => {
      const bounds = canvas.getBoundingClientRect();
      const cssWidth = bounds.width || treeWorldWidth;
      const cssHeight = bounds.height || treeWorldHeight;
      const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
      const backingWidth = Math.round(cssWidth * pixelRatio);
      const backingHeight = Math.round(cssHeight * pixelRatio);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      canvas.dataset.pixelRatio = String(pixelRatio);
      canvas.dataset.backingSize = `${backingWidth}x${backingHeight}`;
      context.resetTransform();
      context.clearRect(0, 0, backingWidth, backingHeight);
      const projection = treeCanvasProjection(cssWidth, cssHeight, camera);
      context.setTransform(
        projection.scale * pixelRatio,
        0,
        0,
        projection.scale * pixelRatio,
        (projection.offsetX - camera.x * projection.scale) * pixelRatio,
        (projection.offsetY - camera.y * projection.scale) * pixelRatio,
      );

      curves.forEach(drawCurve);
      if (!reducedMotion) {
        curves.forEach((curve, index) => {
          if (!curve.focused) return;
          const point = pointOnTreeCurve(
            curve,
            (((timestamp / 1600 + index * 0.17) % 1) + 1) % 1,
          );
          context.save();
          context.fillStyle = curve.kind === "link" ? linkEdge : selectedColor;
          context.shadowBlur = 10;
          context.shadowColor = context.fillStyle;
          context.beginPath();
          context.arc(point.x, point.y, 4, 0, Math.PI * 2);
          context.fill();
          context.restore();
        });
      }

      geometry.forEach(({ node, x, y }) => {
        const lensHit = lens === "none" || lensIds.has(node.id);
        context.save();
        context.globalAlpha = lensHit ? 1 : 0.28;
        context.fillStyle = surface;
        context.strokeStyle =
          node.status === "ERROR"
            ? error
            : selected?.id === node.id
              ? selectedColor
              : border;
        context.lineWidth = selected?.id === node.id ? 2.5 : 1.2;
        const rightRadius = 9;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + treeNodeWidth - rightRadius, y);
        context.quadraticCurveTo(
          x + treeNodeWidth,
          y,
          x + treeNodeWidth,
          y + rightRadius,
        );
        context.lineTo(x + treeNodeWidth, y + treeNodeHeight - rightRadius);
        context.quadraticCurveTo(
          x + treeNodeWidth,
          y + treeNodeHeight,
          x + treeNodeWidth - rightRadius,
          y + treeNodeHeight,
        );
        context.lineTo(x, y + treeNodeHeight);
        context.closePath();
        context.fill();
        context.stroke();
        context.save();
        context.clip();
        context.fillStyle = node.kind === "CLIENT" ? series2 : series1;
        context.fillRect(x, y, 4, treeNodeHeight);
        context.restore();
        context.fillStyle = secondary;
        context.font = "10px ui-monospace, monospace";
        context.fillText(node.kind, x + 14, y + 17);
        context.textAlign = "right";
        context.fillText(node.status, x + 176, y + 17);
        context.textAlign = "left";
        context.fillStyle = primary;
        context.font = "650 12px system-ui";
        context.fillText(node.label, x + 14, y + 37, 160);
        if (!coalescedParentGeometry) {
          context.fillStyle = secondary;
          context.font = "10px ui-monospace, monospace";
          context.fillText(
            `+${displayNano(node.startOffsetNano)} · ${compactIdentity(node.id)}`,
            x + 14,
            y + 53,
            120,
          );
          context.textAlign = "right";
          context.fillText(displayNano(node.durationNano), x + 176, y + 53);
          context.textAlign = "left";
          context.fillStyle = border;
          context.fillRect(x + 14, y + 61, 160, 3);
          context.fillStyle = node.kind === "CLIENT" ? series2 : series1;
          context.fillRect(
            x + 14 + percentage(node.startOffsetNano, duration) * 1.6,
            y + 61,
            Math.max(2, percentage(node.durationNano, duration) * 1.6),
            3,
          );
        } else {
          context.fillStyle = secondary;
          context.font = "10px ui-monospace, monospace";
          context.textAlign = "right";
          context.fillText(displayNano(node.durationNano), x + 176, y + 54);
          context.textAlign = "left";
        }
        context.restore();
      });
      context.resetTransform();
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    draw(performance.now());
    if (reducedMotion && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => draw(performance.now()));
      resizeObserver.observe(canvas);
    }
    if (typeof MutationObserver !== "undefined") {
      themeObserver = new MutationObserver(() => {
        refreshPalette();
        if (reducedMotion) draw(performance.now());
      });
      themeObserver.observe(canvas.closest(".wsr-bi") ?? canvas, {
        attributeFilter: ["class", "data-theme", "style"],
        attributes: true,
        subtree: true,
      });
    }
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
    };
  }, [
    camera,
    coalescedParentGeometry,
    curves,
    geometry,
    lens,
    lensIds,
    reducedMotion,
    selected,
    trace.durationNano,
  ]);

  useEffect(() => {
    const canvas = minimapRef.current;
    if (
      canvas === null ||
      typeof window.CanvasRenderingContext2D === "undefined"
    )
      return;
    const context = canvas.getContext("2d");
    if (context === null) return;
    let internal = "";
    let client = "";
    let error = "";
    let parentEdge = "";
    let linkEdge = "";
    const refreshPalette = () => {
      internal = treeCanvasColor(
        canvas,
        "--wsr-tree-internal-color",
        "#38bdf8",
      );
      client = treeCanvasColor(canvas, "--wsr-tree-client-color", "#2dd4bf");
      error = treeCanvasColor(canvas, "--wsr-tree-error-color", "#fb7185");
      parentEdge = treeCanvasColor(
        canvas,
        "--wsr-tree-parent-edge-color",
        "#607084",
      );
      linkEdge = treeCanvasColor(
        canvas,
        "--wsr-tree-link-edge-color",
        "#fbbf24",
      );
    };
    refreshPalette();
    const draw = () => {
      const bounds = canvas.getBoundingClientRect();
      const cssWidth = bounds.width || 140;
      const cssHeight = bounds.height || 80;
      const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
      const backingWidth = Math.round(cssWidth * pixelRatio);
      const backingHeight = Math.round(cssHeight * pixelRatio);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      context.resetTransform();
      context.clearRect(0, 0, backingWidth, backingHeight);
      context.setTransform(
        backingWidth / treeWorldWidth,
        0,
        0,
        backingHeight / treeWorldHeight,
        0,
        0,
      );
      context.lineWidth = 5;
      curves.forEach((curve) => {
        context.strokeStyle = curve.kind === "link" ? linkEdge : parentEdge;
        context.setLineDash(curve.kind === "link" ? [14, 12] : []);
        context.beginPath();
        context.moveTo(curve.startX, curve.startY);
        context.lineTo(curve.middleX, curve.startY);
        context.lineTo(curve.middleX, curve.endY);
        context.lineTo(curve.endX, curve.endY);
        context.stroke();
      });
      context.setLineDash([]);
      geometry.forEach(({ node, x, y }) => {
        context.fillStyle =
          node.status === "ERROR"
            ? error
            : node.kind === "CLIENT"
              ? client
              : internal;
        context.fillRect(x, y, treeNodeWidth, treeNodeHeight);
      });
      context.resetTransform();
    };
    draw();
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(draw);
    resizeObserver?.observe(canvas);
    const themeObserver =
      typeof MutationObserver === "undefined"
        ? undefined
        : new MutationObserver(() => {
            refreshPalette();
            draw();
          });
    themeObserver?.observe(canvas.closest(".wsr-bi") ?? canvas, {
      attributeFilter: ["class", "data-theme", "style"],
      attributes: true,
      subtree: true,
    });
    return () => {
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
    };
  }, [curves, geometry]);

  if (trace.status !== "READY" || selected === undefined)
    return <InvalidTrace trace={trace} />;
  const lensReceipt =
    lens === "none"
      ? "Focus receipt · exact PARENT_EDGE identity; choose a lens to inspect."
      : `${lens === "ancestors" ? "Ancestors" : "Descendants"} receipt · ${lensIds.size} exact Span ${lensIds.size === 1 ? "identity" : "identities"} · recorded PARENT_EDGE only.`;
  const moveCameraFromMinimap = (event: React.PointerEvent<HTMLElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const centerX =
      ((event.clientX - bounds.left) / bounds.width) * treeWorldWidth;
    const centerY =
      ((event.clientY - bounds.top) / bounds.height) * treeWorldHeight;
    setCamera((current) =>
      normalizedTreeCamera({
        ...current,
        x: centerX - current.width / 2,
        y: centerY - current.height / 2,
      }),
    );
  };
  const selectCanvasNode = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const projection = treeCanvasProjection(
      bounds.width,
      bounds.height,
      camera,
    );
    const x =
      camera.x +
      (event.clientX - bounds.left - projection.offsetX) / projection.scale;
    const y =
      camera.y +
      (event.clientY - bounds.top - projection.offsetY) / projection.scale;
    const hit = [...geometry]
      .reverse()
      .find(
        (item) =>
          x >= item.x &&
          x <= item.x + treeNodeWidth &&
          y >= item.y &&
          y <= item.y + treeNodeHeight,
      );
    if (hit !== undefined) selectNode(hit.node.id);
  };
  return (
    <section
      aria-label="Recorded trace tree"
      className="trace-view trace-tree-graph"
      data-lens={lens}
      data-motion={reducedMotion ? "off" : "edge-flow"}
      data-testid="trace-tree"
      data-trace-renderer="tree"
    >
      <header className="trace-summary trace-summary-dense trace-tree-context">
        <div className="trace-summary-identity">
          <Typography as="strong" variant="sectionTitle">
            {trace.nodes[0]?.label ?? trace.traceId}
          </Typography>
          <Typography as="code" variant="code">
            {trace.traceId}
          </Typography>
        </div>
        <div className="trace-summary-metrics">
          {[
            ["Exact spans", trace.nodes.length],
            ["PARENT_EDGE", trace.parentEdges.length],
            ["LINK", trace.links.length],
          ].map(([label, value]) => (
            <span className="trace-summary-stat" key={label}>
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
      {viewNavigation}
      <div className="trace-workbench">
        <section className="trace-tree-canvas-shell">
          <header className="trace-tree-canvas-head">
            <div>
              <Typography as="h2" variant="sectionTitle">
                Span call tree
              </Typography>
              <Typography as="p" variant="caption">
                Click a Span or exact relationship · deterministic geometry
              </Typography>
            </div>
            <ButtonGroup
              aria-label="Tree camera controls"
              className="trace-tree-actions"
              role="group"
            >
              <IconButton
                appearance="ghost"
                aria-label="Fit tree"
                onClick={() => setCamera(treeFitCamera)}
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
                </svg>
              </IconButton>
              <IconButton
                appearance="ghost"
                aria-label="Zoom out"
                disabled={camera.width === treeWorldWidth}
                onClick={() =>
                  setCamera((current) => zoomTreeCamera(current, 1.25))
                }
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="M3 8h10" />
                </svg>
              </IconButton>
              <IconButton
                appearance="ghost"
                aria-label="Zoom in"
                disabled={camera.width <= 392}
                onClick={() =>
                  setCamera((current) => zoomTreeCamera(current, 0.8))
                }
                type="button"
              >
                <svg aria-hidden="true" viewBox="0 0 16 16">
                  <path d="M3 8h10M8 3v10" />
                </svg>
              </IconButton>
            </ButtonGroup>
          </header>
          <ul aria-label="Trace tree legend" className="trace-tree-legend">
            {[
              ["internal", "INTERNAL"],
              ["client", "CLIENT"],
              ["error", "ERROR"],
              ["parent", "PARENT_EDGE"],
              ["link", "LINK"],
              ["flow", "Request flow"],
            ].map(([kind, label]) => (
              <li key={kind}>
                <i aria-hidden="true" data-legend-kind={kind} />
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <div className="trace-tree-canvas" data-narrow={narrow}>
            <canvas
              aria-label="Recorded span call tree graph"
              className="trace-tree-canvas-surface"
              data-camera-view={formatTreeCamera(camera)}
              data-edge-flow-count={reducedMotion ? 0 : curves.length}
              data-edge-routing="orthogonal"
              data-link-count={linkCurves.length}
              data-layout="call-graph"
              data-node-shape="flat-left-rounded-right"
              data-parent-edge-count={parentCurves.length}
              data-resolution-mode="device-pixel-ratio"
              data-render-detail={
                coalescedParentGeometry ? "summary" : "complete"
              }
              data-testid="trace-tree-canvas"
              height={treeWorldHeight}
              onPointerDown={selectCanvasNode}
              onWheel={(event) => {
                event.preventDefault();
                setCamera((current) =>
                  zoomTreeCamera(current, event.deltaY > 0 ? 1.25 : 0.8),
                );
              }}
              ref={canvasRef}
              role="img"
              width={treeWorldWidth}
            />
            <div
              aria-label="Recorded trace call tree"
              className="trace-tree-outline"
              role="tree"
            >
              {trace.nodes.map((node) => (
                <TreeOutlineRow
                  key={node.id}
                  layout={byId.get(node.id)}
                  node={node}
                  onSelect={selectNode}
                  showLinks={false}
                  trace={trace}
                />
              ))}
            </div>
            <aside
              aria-label="Tree minimap navigation"
              className="trace-camera-map"
              onPointerCancel={() => {
                minimapDragging.current = false;
              }}
              onPointerDown={(event) => {
                minimapDragging.current = true;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                moveCameraFromMinimap(event);
              }}
              onPointerMove={(event) => {
                if (minimapDragging.current) moveCameraFromMinimap(event);
              }}
              onPointerUp={(event) => {
                if (minimapDragging.current) moveCameraFromMinimap(event);
                minimapDragging.current = false;
                event.currentTarget.releasePointerCapture?.(event.pointerId);
              }}
              role="region"
            >
              <Typography as="strong" variant="caption">
                Tree minimap
              </Typography>
              <div className="trace-camera-map-viewport">
                <canvas
                  aria-hidden="true"
                  height={80}
                  ref={minimapRef}
                  width={140}
                />
                <span
                  aria-hidden="true"
                  data-camera-width={camera.width}
                  data-testid="trace-tree-minimap-viewport"
                  style={{
                    height: `${(camera.height / treeWorldHeight) * 100}%`,
                    insetInlineStart: `${(camera.x / treeWorldWidth) * 100}%`,
                    insetBlockStart: `${(camera.y / treeWorldHeight) * 100}%`,
                    width: `${(camera.width / treeWorldWidth) * 100}%`,
                  }}
                />
              </div>
            </aside>
          </div>
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
