import { useCallback, useEffect, useMemo, useState } from "react";

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

const detailState = (state: "AVAILABLE" | "PARTIAL") => state;

function viewModel(
  loaded: Extract<LoadedTrace, { ok: true; state: "AVAILABLE" | "PARTIAL" }>,
  visibleDepths: number,
  selectedId?: string,
): RecordedStructureViewModel {
  const state = detailState(loaded.state);
  return {
    depthGroups: loaded.structure.depthGroups
      .slice(0, visibleDepths)
      .map((group) => ({
        depth: group.depth,
        nodes: group.nodes.map((node) => ({
          id: node.id,
          label: node.label,
          state,
        })),
      })),
    links: loaded.structure.links.map((link) => ({
      sourceId: link.from.span_id,
      targetId: link.to.span_id,
      state,
    })),
    orphans: [
      ...loaded.structure.unresolvedNodes.map((node) => ({
        id: node.id,
        label: `${node.label} — unresolved parent`,
        state,
      })),
      ...loaded.structure.orphans.map((orphan) => ({
        id: orphan.id,
        label: `Missing endpoint ${orphan.endpoint.span_id}`,
        state,
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
  const load = useCallback(async () => {
    setResult(undefined);
    setResult(await loadRecordedTrace(evidence, route.traceId));
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
  }, [mode, result, visibleDepths]);

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
