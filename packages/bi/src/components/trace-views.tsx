import { useState } from "react";

import type { TraceView, TraceViewNode } from "../domain/trace/trace-view";
import { ScopedError } from "./status";

export function SpanPassport({ node }: { node: TraceViewNode }) {
  const fields = Object.fromEntries(
    node.fields.map(({ field, value }) => [field, value]),
  );
  return (
    <section aria-label="Span passport" className="span-passport panel-card">
      <h3 className="text-heading">Span passport</h3>
      <dl className="trace-passport-grid">
        <dt>Span</dt>
        <dd className="text-code">{node.endpoint.span_id}</dd>
        <dt>Recorded start (ns)</dt>
        <dd className="numeric-exact">{node.startTimeUnixNano}</dd>
        <dt>Recorded end (ns)</dt>
        <dd className="numeric-exact">{node.endTimeUnixNano}</dd>
        <dt>Recorded duration (ns)</dt>
        <dd className="numeric-exact">{node.durationNano}</dd>
        <dt>Status / truth</dt>
        <dd>{`${node.status} · ${node.truth.completeness ?? "UNKNOWN"} · ${node.truth.availability}`}</dd>
        <dt>Flags / trace state</dt>
        <dd className="text-code">{`${node.flags} · ${node.traceState ?? "none"}`}</dd>
        <dt>Fields</dt>
        <dd className="text-code">{JSON.stringify(fields)}</dd>
      </dl>
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

function scalePercent(value: string, total: string): string {
  const denominator = BigInt(total);
  if (denominator <= 0n) return "0%";
  const basisPoints = (BigInt(value) * 10_000n) / denominator;
  return `${Number(basisPoints) / 100}%`;
}

export function TraceWaterfall({
  trace,
  reducedMotion = false,
}: {
  trace: TraceView;
  reducedMotion?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  if (trace.status !== "READY" || trace.durationNano === undefined)
    return <InvalidTrace trace={trace} />;
  const selected = trace.nodes.find((node) => node.id === selectedId);
  return (
    <section
      aria-label="Recorded trace waterfall"
      className="trace-view trace-waterfall"
      data-motion={reducedMotion ? "off" : "finite-recorded-time"}
    >
      <div className="trace-summary">
        <span>{`${trace.durationNano} ns recorded duration`}</span>
        <span>{`Recorded links: ${trace.links.length}`}</span>
      </div>
      <div aria-label="Shared recorded timeline" className="trace-timeline">
        {trace.nodes.map((node) => (
          <div className="trace-waterfall-row" key={node.id}>
            <button
              aria-label={`${node.label}, ${node.durationNano} nanoseconds`}
              className="recorded-node trace-node-label"
              onClick={() => setSelectedId(node.id)}
              type="button"
            >
              <span>{node.label}</span>
              <span className="numeric-exact">{`${node.durationNano} ns`}</span>
            </button>
            <div aria-hidden="true" className="trace-timeline-track">
              <span
                className="trace-timeline-bar"
                style={{
                  insetInlineStart: scalePercent(
                    node.startOffsetNano,
                    trace.durationNano!,
                  ),
                  width: scalePercent(node.durationNano, trace.durationNano!),
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <RecordedLinks trace={trace} />
      {selected === undefined ? null : <SpanPassport node={selected} />}
    </section>
  );
}

export function TraceTree({ trace }: { trace: TraceView }) {
  const [selectedId, setSelectedId] = useState<string>();
  if (trace.status !== "READY") return <InvalidTrace trace={trace} />;
  const selected = trace.nodes.find((node) => node.id === selectedId);
  return (
    <section aria-label="Recorded trace tree" className="trace-view trace-tree">
      <div aria-label="Recorded trace call tree" role="tree">
        {trace.nodes.map((node) => (
          <div
            aria-level={node.depth + 1}
            className="trace-tree-row"
            key={node.id}
            role="treeitem"
            style={{ paddingInlineStart: `${node.depth * 1.5}rem` }}
          >
            <button
              className="recorded-node"
              onClick={() => setSelectedId(node.id)}
              type="button"
            >
              <span>{node.label}</span>
              <span className="numeric-exact">{`${node.durationNano} ns`}</span>
            </button>
            <RecordedLinks node={node} trace={trace} />
          </div>
        ))}
      </div>
      {selected === undefined ? null : <SpanPassport node={selected} />}
    </section>
  );
}
