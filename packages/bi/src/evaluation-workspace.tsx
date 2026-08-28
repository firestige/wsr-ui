import { useCallback, useEffect, useRef, useState } from "react";

import { MetricExplanationView, ReceiptView } from "./components/details";
import { CompareResultFrame } from "./components/compare-result";
import { DashboardComposer } from "./components/dashboard-composer";
import { OwnedInspector } from "./components/inspector";
import { MetricPanel } from "./components/result-visualizer";
import { MetricNavigator } from "./components/metric-result";
import { ScopedError } from "./components/status";
import { METRIC_COPY } from "./domain/catalog/metric-copy";
import {
  decodeLayout,
  PRESET_LAYOUTS,
  type DashboardLayout,
} from "./domain/layout/layout";
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
  | {
      tag: "RESULT";
      response: SingleResponse | CompareResponse;
      retrying: boolean;
      retryError?: { detail: string; retryable: boolean };
    }
  | { tag: "ERROR"; detail: string; retryable: boolean };

const LOCAL_LAYOUT_KEY = "wsr.bi.dashboard-layout@1";
type LayoutChoice = keyof typeof PRESET_LAYOUTS | "local@1";

function useDesktopInspector(): boolean {
  const query = "(min-width: 75rem)";
  const [desktop, setDesktop] = useState(() =>
    typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const update = () => setDesktop(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop;
}

function storedLayout(): DashboardLayout | undefined {
  try {
    const stored = window.localStorage.getItem(LOCAL_LAYOUT_KEY);
    if (stored === null) return undefined;
    const decoded = decodeLayout(JSON.parse(stored));
    return decoded.ok ? decoded.value : undefined;
  } catch {
    return undefined;
  }
}

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
  focusedCoordinate,
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
  focusedCoordinate?: string;
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
            aria-current={
              focusedCoordinate === panel.metric_coordinate ? "true" : undefined
            }
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
                focusEvidenceAction={
                  focusedCoordinate === panel.metric_coordinate
                }
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

function populationLabel(
  receipt: SideResult["receipt"] | undefined,
  fallbackTaskIds: readonly string[],
): string {
  if (receipt === undefined) return fallbackTaskIds.join(", ");
  return receipt.task_population
    .map((task) =>
      task.display_name === undefined || task.display_name.trim() === ""
        ? task.task_id
        : `${task.display_name} (${task.task_id})`,
    )
    .join(", ");
}

function CompareResults({
  response,
  layout,
  onRetry,
  retrying,
  retryError,
  onEvidence,
  onExplain,
  onSelectMetric,
  selectedCoordinate,
  selectedSide,
}: {
  response: CompareResponse;
  layout: DashboardLayout;
  onRetry: () => void;
  retrying: boolean;
  retryError?: { detail: string; retryable: boolean };
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
  selectedSide?: "left" | "right";
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
  const beforeError =
    response.left.tag === "SIDE_ERROR" ? response.left : undefined;
  const afterError =
    response.right.tag === "SIDE_ERROR" ? response.right : undefined;
  const panels = layout.panels.flatMap((panel) =>
    response.deltas
      .filter((delta) => delta.metric_coordinate === panel.metric_coordinate)
      .map((delta) => ({ delta, panel })),
  );
  if (
    selectedCoordinate !== undefined &&
    !panels.some(({ delta }) => delta.metric_coordinate === selectedCoordinate)
  ) {
    const delta = response.deltas.find(
      (candidate) => candidate.metric_coordinate === selectedCoordinate,
    );
    if (delta !== undefined)
      panels.push({
        delta,
        panel: {
          panel_id: "focused-result",
          metric_coordinate:
            delta.metric_coordinate as DashboardLayout["panels"][number]["metric_coordinate"],
          visualizer: "table@1",
          size: "WIDE",
          channels: { "published-result": "slices" },
          transforms: [
            "DISPLAY_ROUNDING",
            "RATIO_TO_PERCENT",
            "STABLE_AUTHORITATIVE_SORT",
          ],
        },
      });
  }
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
          beforeState:
            before === undefined ? undefined : findSlice(before, delta)?.state,
          afterState:
            after === undefined ? undefined : findSlice(after, delta)?.state,
          deltaState: delta.state,
        }))}
        mode="compare"
        onSelect={(coordinate) =>
          onSelectMetric(coordinate as keyof typeof METRIC_COPY)
        }
        selectedCoordinate={selectedCoordinate}
      />
      {retrying ? (
        <p aria-live="polite" className="loading-state" role="status">
          Retrying comparison… The resolved side remains visible.
        </p>
      ) : retryError === undefined ? null : (
        <ScopedError
          announce="assertive"
          detail={retryError.detail}
          onRetry={onRetry}
          retryable={retryError.retryable}
          title="Comparison retry failed"
        />
      )}
      {panels.map(({ delta, panel }, index) => (
        <CompareResultFrame
          after={after === undefined ? undefined : findSlice(after, delta)}
          afterError={afterError}
          before={before === undefined ? undefined : findSlice(before, delta)}
          beforeError={beforeError}
          coordinate={delta.metric_coordinate}
          delta={delta}
          focusEvidenceSide={
            selectedCoordinate === delta.metric_coordinate
              ? selectedSide
              : undefined
          }
          key={`${panel.panel_id}:${delta.metric_coordinate}:${sliceKey(delta.slice_key)}`}
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
          onRetryFailedSide={
            failed === undefined || retrying ? undefined : onRetry
          }
          ownsFailedSide={index === 0}
          visualizer={panel.visualizer}
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
  const [layoutState, setLayoutState] = useState<{
    choice: LayoutChoice;
    local?: DashboardLayout;
  }>(() => {
    const local = storedLayout();
    return local === undefined
      ? { choice: "default-overview@1" }
      : { choice: "local@1", local };
  });
  const detailInvoker = useRef<HTMLButtonElement>(null);
  const requestGeneration = useRef(0);
  const desktopInspector = useDesktopInspector();

  const run = useCallback(
    async (preserveCompare = false) => {
      if (route.tag !== "SINGLE" && route.tag !== "COMPARE") return;
      const generation = ++requestGeneration.current;
      setState((current) =>
        preserveCompare &&
        current.tag === "RESULT" &&
        current.response.mode === "COMPARE"
          ? { ...current, retrying: true, retryError: undefined }
          : { tag: "LOADING" },
      );
      const result =
        route.tag === "SINGLE"
          ? await evolution.computeSingle(route.taskIds)
          : await evolution.computeCompare(
              route.leftTaskIds,
              route.rightTaskIds,
            );
      if (generation !== requestGeneration.current) return;
      if (result.ok) {
        setState({ tag: "RESULT", response: result.value, retrying: false });
        return;
      }
      const error = errorPresentation(result);
      setState((current) =>
        preserveCompare && current.tag === "RESULT"
          ? { ...current, retrying: false, retryError: error }
          : { tag: "ERROR", ...error },
      );
    },
    [evolution, route],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void run(), 0);
    return () => {
      window.clearTimeout(timer);
      requestGeneration.current += 1;
    };
  }, [run]);

  if (route.tag === "SELECT")
    return <p className="empty-state">Choose one or more Tasks to evaluate.</p>;
  if (route.tag === "INVALID")
    return (
      <main className="evaluation-shell" id="main-content" tabIndex={-1}>
        <ScopedError
          announce="assertive"
          detail={route.reason}
          retryable={false}
          title="Invalid evaluation link"
        />
        <button
          className="action-control"
          onClick={() => onNavigate?.({ tag: "SELECT" })}
          type="button"
        >
          Re-select Tasks
        </button>
      </main>
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
  const activeLayout =
    layoutState.choice === "local@1"
      ? (layoutState.local ?? PRESET_LAYOUTS["default-overview@1"])
      : PRESET_LAYOUTS[layoutState.choice];

  return (
    <main className="evaluation-shell" id="main-content" tabIndex={-1}>
      <header className="evaluation-header">
        <div>
          <p className="text-label">Business intelligence</p>
          <h1 className="text-title">Evaluation</h1>
        </div>
        <div aria-label="Evaluation context" className="context-bar">
          <span>{route.tag === "SINGLE" ? "Single" : "Compare"}</span>
          <code className="text-code">
            {route.tag === "SINGLE"
              ? populationLabel(receipts.single, route.taskIds)
              : `${populationLabel(receipts.left, route.leftTaskIds)} → ${populationLabel(receipts.right, route.rightTaskIds)}`}
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
          {state.tag === "RESULT" ? (
            <label className="control-label">
              Layout preset
              <select
                className="control-field"
                onChange={(event) =>
                  setLayoutState((current) => ({
                    ...current,
                    choice: event.target.value as LayoutChoice,
                  }))
                }
                value={layoutState.choice}
              >
                {Object.entries(PRESET_LAYOUTS).map(([id, layout]) => (
                  <option key={id} value={id}>
                    {layout.name}
                  </option>
                ))}
                {layoutState.local === undefined ? null : (
                  <option value="local@1">Local custom</option>
                )}
              </select>
            </label>
          ) : null}
        </div>
      </header>

      {state.tag === "RESULT" && state.response.mode === "SINGLE" ? (
        <DashboardComposer
          layout={activeLayout}
          onApply={(layout) => {
            try {
              window.localStorage.setItem(
                LOCAL_LAYOUT_KEY,
                JSON.stringify(layout),
              );
            } catch {
              // The in-memory local layout remains usable when storage is denied.
            }
            setLayoutState({ choice: "local@1", local: layout });
          }}
          results={state.response.result.metric_results}
        />
      ) : null}

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
            focusedCoordinate={route.focus?.metric}
            layout={activeLayout}
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
            layout={activeLayout}
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
            onRetry={() => void run(true)}
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
            retryError={state.retryError}
            retrying={state.retrying}
            selectedCoordinate={route.focus?.metric}
            selectedSide={
              route.focus?.side === "left" || route.focus?.side === "right"
                ? route.focus.side
                : undefined
            }
          />
        )}
      </div>

      {detail === null ||
      (detail.kind === "receipt" &&
        receipts[detail.side] === undefined) ? null : (
        <OwnedInspector
          invokerRef={detailInvoker}
          kind={detail.kind}
          modal={!desktopInspector}
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
