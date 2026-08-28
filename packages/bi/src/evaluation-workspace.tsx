import { useCallback, useEffect, useRef, useState } from "react";

import { ReceiptView } from "./components/details";
import { OwnedInspector } from "./components/inspector";
import { MetricResultFrame } from "./components/metric-result";
import { ScopedError } from "./components/status";
import type { EvaluationRoute } from "./domain/navigation/evaluation-route";
import type {
  CompareResponse,
  EvolutionResult,
  SingleResponse,
} from "./domain/evolution/types";

export interface EvolutionPort {
  computeSingle(taskIds: readonly string[]): Promise<EvolutionResult>;
  computeCompare(
    leftTaskIds: readonly string[],
    rightTaskIds: readonly string[],
  ): Promise<EvolutionResult>;
}

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

function SingleResults({ response }: { response: SingleResponse }) {
  return (
    <section aria-label="Metric Results" className="evaluation-results">
      {response.result.metric_results.flatMap((metric) => {
        const coordinate = `${metric.metric_id}@${metric.metric_version}`;
        return metric.slices.map((slice) => (
          <MetricResultFrame
            content={{ tag: "RESULT", slice }}
            coordinate={coordinate}
            key={`${coordinate}:${JSON.stringify(slice.slice_key)}`}
          />
        ));
      })}
    </section>
  );
}

export function EvaluationWorkspace({
  route,
  evolution,
}: {
  route: EvaluationRoute;
  evolution: EvolutionPort;
}) {
  const [state, setState] = useState<WorkspaceState>({ tag: "LOADING" });
  const [receiptOpen, setReceiptOpen] = useState(false);
  const receiptButton = useRef<HTMLButtonElement>(null);

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
    void run();
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

  const receipt =
    state.tag === "RESULT" && state.response.mode === "SINGLE"
      ? state.response.result.receipt
      : undefined;

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
          {receipt === undefined ? null : (
            <button
              className="action-control"
              onClick={() => setReceiptOpen(true)}
              ref={receiptButton}
              type="button"
            >
              View receipt
            </button>
          )}
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
          <SingleResults response={state.response} />
        ) : (
          <p className="empty-state">Compare result composition is loading.</p>
        )}
      </div>

      {receipt === undefined ? null : (
        <OwnedInspector
          invokerRef={receiptButton}
          kind="receipt"
          modal
          onClose={() => setReceiptOpen(false)}
          open={receiptOpen}
          title="Evaluation receipt"
        >
          <ReceiptView receipt={receipt} side="single" />
        </OwnedInspector>
      )}
    </main>
  );
}
