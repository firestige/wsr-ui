import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_MOTION_MODE,
  MotionControl,
  RecordedStructureFoundation,
  type MotionMode,
  type RecordedStructureViewModel,
} from "./components/recorded-structure";
import { ScopedError } from "./components/status";
import type { EvaluationRoute } from "./domain/navigation/evaluation-route";
import {
  loadRecordedTrace,
  type LoadedTrace,
  type TracePagePort,
} from "./domain/trace/load-recorded-trace";

type TraceRoute = Extract<EvaluationRoute, { tag: "TRACE" }>;

const endpointId = (traceId: string, spanId: string) => `${traceId}:${spanId}`;

function viewModel(
  loaded: Extract<LoadedTrace, { ok: true; state: "AVAILABLE" | "PARTIAL" }>,
  visibleDepths: number,
  selectedId?: string,
): RecordedStructureViewModel {
  const visibleGroups = loaded.structure.depthGroups.slice(0, visibleDepths);
  return {
    depthGroups: visibleGroups.map((group) => ({
      depth: group.depth,
      nodes: group.nodes.map((node) => ({
        id: node.id,
        endpointId: endpointId(node.endpoint.trace_id, node.endpoint.span_id),
        label: node.label,
        state: "AVAILABLE" as const,
      })),
    })),
    parentEdges: loaded.structure.parentEdges.map((edge) => ({
      id: edge.id,
      sourceId: endpointId(edge.from.trace_id, edge.from.span_id),
      targetId: endpointId(edge.to.trace_id, edge.to.span_id),
    })),
    links: loaded.structure.links.map((link) => ({
      id: link.id,
      sourceId: endpointId(link.from.trace_id, link.from.span_id),
      targetId: endpointId(link.to.trace_id, link.to.span_id),
      state: "AVAILABLE" as const,
    })),
    orphans: [
      ...loaded.structure.unresolvedNodes.map((node) => ({
        id: node.id,
        label: `${node.label} — unresolved parent`,
        state: "UNRESOLVED" as const,
      })),
      ...loaded.structure.orphans.map((orphan) => ({
        id: orphan.id,
        label: `Missing endpoint ${orphan.endpoint.span_id}`,
        state: "UNRESOLVED" as const,
      })),
    ],
    selectedId,
  };
}

export function TraceDrilldown({
  evidence,
  route,
  onNavigate,
}: {
  evidence: TracePagePort;
  route: TraceRoute;
  onNavigate: (route: EvaluationRoute) => void;
}) {
  const [result, setResult] = useState<LoadedTrace>();
  const [mode, setMode] = useState<MotionMode>(DEFAULT_MOTION_MODE);
  const [visibleDepths, setVisibleDepths] = useState(Number.MAX_SAFE_INTEGER);
  const [selectedId, setSelectedId] = useState(route.spanId);
  const [reducedMotion, setReducedMotion] = useState(false);
  const loadGeneration = useRef(0);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setResult(undefined);
    const next = await loadRecordedTrace(evidence, route.traceId);
    if (loadGeneration.current === generation) setResult(next);
  }, [evidence, route.traceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (window.matchMedia === undefined) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (reducedMotion && mode === "LIVE") {
      const timer = window.setTimeout(() => {
        setVisibleDepths(Number.MAX_SAFE_INTEGER);
        setMode("STILL");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (mode !== "LIVE" || result?.ok !== true || result.state === "ABSENT")
      return;
    const total = result.structure.depthGroups.length;
    if (visibleDepths >= total) {
      const timer = window.setTimeout(() => setMode("COMPLETE"), 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(
      () => setVisibleDepths((current) => current + 1),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [mode, reducedMotion, result, visibleDepths]);

  const model = useMemo(
    () =>
      result?.ok === true && result.state !== "ABSENT"
        ? viewModel(result, visibleDepths, selectedId)
        : undefined,
    [result, selectedId, visibleDepths],
  );
  const back: EvaluationRoute = {
    tag: "EVIDENCE",
    selection: route.selection,
    metric: route.metric,
    side: route.side,
    scope: route.scope,
    factId: route.factId,
  };

  return (
    <main className="evaluation-shell" id="main-content" tabIndex={-1}>
      <button
        className="link-control"
        onClick={() => onNavigate(back)}
        type="button"
      >
        Back to Evidence
      </button>
      <h1 className="text-title">Recorded Trace</h1>
      <code className="text-code">{route.traceId}</code>
      {result === undefined ? (
        <p aria-live="polite" className="loading-state" role="status">
          Loading recorded structure…
        </p>
      ) : !result.ok ? (
        <ScopedError
          announce="assertive"
          detail={result.reason}
          onRetry={() => void load()}
          retryable
          title="Recorded Trace unavailable"
        />
      ) : result.state === "ABSENT" ? (
        <ScopedError
          announce="assertive"
          detail="The Delivery is absent or was physically deleted. Select an active Delivery."
          onRetry={() => onNavigate(back)}
          retryable
          title="Recorded Trace not found"
        />
      ) : model === undefined ? null : (
        <>
          {result.structure.status === "INVALID" ? (
            <div className="status-error" role="alert">
              Invalid recorded parent structure:{" "}
              {result.structure.errors.join("; ")}
            </div>
          ) : null}
          {result.state === "PARTIAL" ? (
            <div className="status-partial" role="status">
              Partial recorded structure — Evidence reports a known data hole.
              Present records remain available; unresolved endpoints stay
              unclassified.
            </div>
          ) : null}
          <MotionControl
            canStart={result.structure.depthGroups.length > 0}
            mode={mode}
            onReset={() => {
              setMode("STILL");
              setVisibleDepths(Number.MAX_SAFE_INTEGER);
            }}
            onStart={() => {
              setVisibleDepths(1);
              setMode("LIVE");
            }}
            onStop={() => {
              setVisibleDepths(Number.MAX_SAFE_INTEGER);
              setMode("STILL");
            }}
            reducedMotion={reducedMotion}
          />
          <RecordedStructureFoundation model={model} onSelect={setSelectedId} />
        </>
      )}
    </main>
  );
}
