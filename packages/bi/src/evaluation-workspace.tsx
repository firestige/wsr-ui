import { useCallback, useEffect, useRef, useState } from "react";

import { MetricExplanationView, ReceiptView } from "./components/details";
import { CompareResultFrame } from "./components/compare-result";
import { OwnedInspector } from "./components/inspector";
import { MetricPanel } from "./components/result-visualizer";
import { MetricNavigator } from "./components/metric-result";
import { ScopedError } from "./components/status";
import { METRIC_COPY } from "./domain/catalog/metric-copy";
import { PRESET_LAYOUTS, type DashboardLayout } from "./domain/layout/layout";
import type { EvaluationRoute } from "./domain/navigation/evaluation-route";
import type {
  CompareResponse,
  DeltaEntry,
  EvolutionResult,
  MetricSlice,
  SideResult,
  SingleResponse,
} from "./domain/evolution/types";

export interface EvolutionPort {
  computeSingle(taskIds: readonly string[]): Promise<EvolutionResult>;
  computeCompare(
    leftTaskIds: readonly string[],
    rightTaskIds: readonly string[],
  ): Promise<EvolutionResult>;
}

export type WorkspaceRoute = Extract<
  EvaluationRoute,
  { tag: "SELECT" | "SINGLE" | "COMPARE" | "INVALID" }
>;

type WorkspaceState =
  | { tag: "LOADING" }
  | { tag: "RESULT"; response: SingleResponse | CompareResponse }
  | { tag: "ERROR"; detail: string; retryable: boolean };

function errorPresentation(error: EvolutionResult & { ok: false }): {
  detail: string;
  retryable: boolean;
} {
  if (error.error.kind === "UPSTREAM")
    return {
      detail: `${error.error.code}: ${error.error.detail}`,
      retryable: error.error.retryable,
    };
  if (error.error.kind === "ERROR")
    return { detail: error.error.reason, retryable: true };
  if (error.error.kind === "RESPONSE_BOUND_EXCEEDED")
    return {
      detail: `Response exceeded ${error.error.maximumBytes} bytes`,
      retryable: false,
    };
  return { detail: error.error.reason, retryable: false };
}

function SingleResults({
  response,
  layout,
  onExplain,
  onEvidence,
}: {
  response: SingleResponse;
  layout: DashboardLayout;
  onExplain: (
    coordinate: keyof typeof METRIC_COPY,
    trigger: HTMLButtonElement,
  ) => void;
  onEvidence: (
    coordinate: keyof typeof METRIC_COPY,
    trigger: HTMLButtonElement,
  ) => void;
}) {
  return (
    <section aria-label="Metric Results" className="evaluation-results">
      {layout.panels.map((panel) => {
        const result = response.result.metric_results.find(
          (metric) =>
            `${metric.metric_id}@${metric.metric_version}` ===
            panel.metric_coordinate,
        );
        return (
          <section
            className="dashboard-panel"
            data-size={panel.size}
            key={panel.panel_id}
          >
            {result === undefined ? (
              <ScopedError
                announce="polite"
                detail={panel.metric_coordinate}
                retryable={false}
                title="Metric Result missing"
              />
            ) : (
              <MetricPanel
                onEvidence={(trigger) =>
                  onEvidence(panel.metric_coordinate, trigger)
                }
                onExplain={(trigger) =>
                  onExplain(panel.metric_coordinate, trigger)
                }
                result={result}
                visualizer={panel.visualizer}
              />
            )}
          </section>
        );
      })}
    </section>
  );
}

function sliceKey(value: Record<string, string>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ),
  );
}

function findSlice(
  side: SideResult,
  delta: DeltaEntry,
): MetricSlice | undefined {
  const split = delta.metric_coordinate.lastIndexOf("@");
  const metric = side.metric_results.find(
    (candidate) =>
      candidate.metric_id === delta.metric_coordinate.slice(0, split) &&
      candidate.metric_version === delta.metric_coordinate.slice(split + 1),
  );
  const key = sliceKey(delta.slice_key);
  return metric?.slices.find((slice) => sliceKey(slice.slice_key) === key);
}

function CompareResults({
  response,
  onRetry,
  onEvidence,
  onExplain,
  onSelectMetric,
  selectedCoordinate,
}: {
  response: CompareResponse;
  onRetry: () => void;
  onEvidence: (
    coordinate: keyof typeof METRIC_COPY,
    side: "left" | "right",
    trigger: HTMLButtonElement,
  ) => void;
  onExplain: (
    coordinate: keyof typeof METRIC_COPY,
    trigger: HTMLButtonElement,
  ) => void;
  onSelectMetric: (coordinate: keyof typeof METRIC_COPY) => void;
  selectedCoordinate?: string;
}) {
  const before =
    response.left.tag === "SIDE_RESULT" ? response.left : undefined;
  const after =
    response.right.tag === "SIDE_RESULT" ? response.right : undefined;
  const failed =
    response.left.tag === "SIDE_ERROR"
      ? response.left
      : response.right.tag === "SIDE_ERROR"
        ? response.right
        : undefined;
  const failedLabel = response.left.tag === "SIDE_ERROR" ? "Before" : "After";
  return (
    <section aria-label="Compared Metric Results" className="compare-results">
      <MetricNavigator
        items={response.deltas.map((delta) => ({
          coordinate: delta.metric_coordinate,
          resultState:
            (before === undefined ? undefined : findSlice(before, delta))
              ?.state ??
            (after === undefined ? undefined : findSlice(after, delta))
              ?.state ??
            "UNAVAILABLE",
          deltaState: delta.state,
        }))}
        mode="compare"
        onSelect={(coordinate) =>
          onSelectMetric(coordinate as keyof typeof METRIC_COPY)
        }
        selectedCoordinate={selectedCoordinate}
      />
      {failed === undefined ? null : (
        <ScopedError
          announce="assertive"
          detail={`${failed.code}: ${failed.detail}`}
          onRetry={onRetry}
          retryable={failed.retryable}
          title={`${failedLabel} unavailable`}
        />
      )}
      {response.deltas.map((delta) => (
        <CompareResultFrame
          after={after === undefined ? undefined : findSlice(after, delta)}
          before={before === undefined ? undefined : findSlice(before, delta)}
          coordinate={delta.metric_coordinate}
          delta={delta}
          key={`${delta.metric_coordinate}:${sliceKey(delta.slice_key)}`}
          onEvidence={(side, trigger) =>
            onEvidence(
              delta.metric_coordinate as keyof typeof METRIC_COPY,
              side,
              trigger,
            )
          }
          onExplain={(_, trigger) =>
            onExplain(
              delta.metric_coordinate as keyof typeof METRIC_COPY,
              trigger,
            )
          }
        />
      ))}
    </section>
  );
}

export function EvaluationWorkspace({
  route,
  evolution,
  onNavigate,
}: {
  route: WorkspaceRoute;
  evolution: EvolutionPort;
  onNavigate?: (route: EvaluationRoute) => void;
}) {
  const [state, setState] = useState<WorkspaceState>({ tag: "LOADING" });
  const [detail, setDetail] = useState<
    | { kind: "receipt"; side: "single" | "left" | "right" }
    | { kind: "explanation"; coordinate: keyof typeof METRIC_COPY }
    | null
  >(null);
  const [presetId, setPresetId] =
    useState<keyof typeof PRESET_LAYOUTS>("default-overview@1");
  const detailInvoker = useRef<HTMLButtonElement>(null);

  const run = useCallback(async () => {
    if (route.tag !== "SINGLE" && route.tag !== "COMPARE") return;
    setState({ tag: "LOADING" });
    const result =
      route.tag === "SINGLE"
        ? await evolution.computeSingle(route.taskIds)
        : await evolution.computeCompare(route.leftTaskIds, route.rightTaskIds);
    setState(
      result.ok
        ? { tag: "RESULT", response: result.value }
        : { tag: "ERROR", ...errorPresentation(result) },
    );
  }, [evolution, route]);

  useEffect(() => {
    const timer = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(timer);
  }, [run]);

  if (route.tag === "SELECT")
    return <p className="empty-state">Choose one or more Tasks to evaluate.</p>;
  if (route.tag === "INVALID")
    return (
      <ScopedError
        announce="assertive"
        detail={route.reason}
        retryable={false}
        title="Invalid evaluation link"
      />
    );

  const receipts =
    state.tag !== "RESULT"
      ? {}
      : state.response.mode === "SINGLE"
        ? { single: state.response.result.receipt }
        : {
            left:
              state.response.left.tag === "SIDE_RESULT"
                ? state.response.left.receipt
                : undefined,
            right:
              state.response.right.tag === "SIDE_RESULT"
                ? state.response.right.receipt
                : undefined,
          };

  return (
    <main className="evaluation-shell">
      <a className="skip-link" href="#evaluation-results">
        Skip to Metric Results
      </a>
      <header className="evaluation-header">
        <div>
          <p className="text-label">Business intelligence</p>
          <h1 className="text-title">Evaluation</h1>
        </div>
        <div aria-label="Evaluation context" className="context-bar">
          <span>{route.tag === "SINGLE" ? "Single" : "Compare"}</span>
          <code className="text-code">
            {route.tag === "SINGLE"
              ? route.taskIds.join(", ")
              : `${route.leftTaskIds.join(", ")} → ${route.rightTaskIds.join(", ")}`}
          </code>
          {receipts.single === undefined ? null : (
            <button
              className="action-control"
              onClick={(event) => {
                detailInvoker.current = event.currentTarget;
                setDetail({ kind: "receipt", side: "single" });
              }}
              type="button"
            >
              View receipt
            </button>
          )}
          {(["left", "right"] as const).map((side) =>
            receipts[side] === undefined ? null : (
              <button
                className="action-control"
                key={side}
                onClick={(event) => {
                  detailInvoker.current = event.currentTarget;
                  setDetail({ kind: "receipt", side });
                }}
                type="button"
              >
                View {side === "left" ? "Before" : "After"} receipt
              </button>
            ),
          )}
          {state.tag === "RESULT" && state.response.mode === "SINGLE" ? (
            <label className="control-label">
              Layout preset
              <select
                className="control-field"
                onChange={(event) =>
                  setPresetId(event.target.value as keyof typeof PRESET_LAYOUTS)
                }
                value={presetId}
              >
                {Object.entries(PRESET_LAYOUTS).map(([id, layout]) => (
                  <option key={id} value={id}>
                    {layout.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </header>

      <div id="evaluation-results">
        {state.tag === "LOADING" ? (
          <p aria-live="polite" className="loading-state" role="status">
            Resolving evaluation…
          </p>
        ) : state.tag === "ERROR" ? (
          <ScopedError
            announce="assertive"
            detail={state.detail}
            onRetry={run}
            retryable={state.retryable}
            title="Evaluation request failed"
          />
        ) : state.response.mode === "SINGLE" ? (
          <SingleResults
            layout={PRESET_LAYOUTS[presetId]}
            onEvidence={(coordinate) => {
              if (route.tag === "SINGLE")
                onNavigate?.({
                  tag: "EVIDENCE",
                  selection: { tag: "SINGLE", taskIds: route.taskIds },
                  metric: coordinate,
                  side: "single",
                  scope: "result",
                });
            }}
            onExplain={(coordinate, trigger) => {
              detailInvoker.current = trigger;
              setDetail({ kind: "explanation", coordinate });
            }}
            response={state.response}
          />
        ) : (
          <CompareResults
            onEvidence={(coordinate, side) => {
              if (route.tag === "COMPARE")
                onNavigate?.({
                  tag: "EVIDENCE",
                  selection: {
                    tag: "COMPARE",
                    leftTaskIds: route.leftTaskIds,
                    rightTaskIds: route.rightTaskIds,
                  },
                  metric: coordinate,
                  side,
                  scope: "result",
                });
            }}
            onExplain={(coordinate, trigger) => {
              detailInvoker.current = trigger;
              setDetail({ kind: "explanation", coordinate });
            }}
            onRetry={run}
            onSelectMetric={(metric) => {
              if (route.tag === "COMPARE")
                onNavigate?.({
                  ...route,
                  focus: {
                    metric,
                    side: route.focus?.side ?? "left",
                  },
                });
            }}
            response={state.response}
            selectedCoordinate={route.focus?.metric}
          />
        )}
      </div>

      {detail === null ||
      (detail.kind === "receipt" &&
        receipts[detail.side] === undefined) ? null : (
        <OwnedInspector
          invokerRef={detailInvoker}
          kind={detail.kind}
          modal
          onClose={() => setDetail(null)}
          open
          title={
            detail.kind === "receipt"
              ? "Evaluation receipt"
              : "Metric explanation"
          }
        >
          {detail.kind === "receipt" ? (
            <ReceiptView receipt={receipts[detail.side]!} side={detail.side} />
          ) : (
            <MetricExplanationView
              {...METRIC_COPY[detail.coordinate]}
              metricCoordinate={detail.coordinate}
            />
          )}
        </OwnedInspector>
      )}
    </main>
  );
}
