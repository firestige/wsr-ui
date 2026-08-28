import type { ReactNode } from "react";

import type { MetricSlice, TruthState } from "../domain/evolution/types";
import { CoverageLabel, MetricTruthLabel, ScopedError } from "./status";

type MetricFrameContent =
  | { tag: "LOADING" }
  | { tag: "RESULT"; slice: MetricSlice }
  | { tag: "ERROR"; detail: string; retryable: boolean; onRetry?: () => void };

function ExactMetricValue({ slice }: { slice: MetricSlice }) {
  if (slice.value === undefined) return null;
  return (
    <div className="metric-value">
      <span className="metric-number">
        {typeof slice.value.value === "boolean"
          ? String(slice.value.value)
          : slice.value.value}
      </span>
      <span className="metric-unit">{slice.value.unit}</span>
    </div>
  );
}

function PublishedMeasures({ slice }: { slice: MetricSlice }) {
  const measures = Object.entries(slice.measures);
  const counts = [
    ["Numerator", slice.numerator],
    ["Denominator", slice.denominator],
    ["Contributing", slice.contributing_count],
  ].filter((item): item is [string, string] => item[1] !== undefined);
  if (measures.length === 0 && counts.length === 0) return null;
  return (
    <dl className="metric-measures">
      {measures.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd className="numeric-exact">{value}</dd>
        </div>
      ))}
      {counts.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd className="numeric-exact">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MetricResultFrame({
  coordinate,
  content,
  visualization,
  onExplain,
  onEvidence,
}: {
  coordinate: string;
  content: MetricFrameContent;
  visualization?: ReactNode;
  onExplain?: () => void;
  onEvidence?: () => void;
}) {
  return (
    <article aria-label={coordinate} className="metric-frame">
      <header className="metric-frame-header">
        <h3 className="text-heading metric-coordinate">{coordinate}</h3>
        {content.tag === "RESULT" ? (
          <MetricTruthLabel
            reading={content.slice.reading}
            state={content.slice.state}
            withholdingReason={content.slice.withholding_reason}
          />
        ) : null}
      </header>
      {content.tag === "LOADING" ? (
        <div aria-live="polite" className="loading-state" role="status">
          Loading metric…
        </div>
      ) : content.tag === "ERROR" ? (
        <ScopedError
          announce="assertive"
          detail={content.detail}
          onRetry={content.onRetry}
          retryable={content.retryable}
          title="Metric request failed"
        />
      ) : (
        <>
          <ExactMetricValue slice={content.slice} />
          {content.slice.value === undefined ? null : visualization}
          <PublishedMeasures slice={content.slice} />
          <CoverageLabel coverage={content.slice.coverage} />
          {content.slice.missing_inputs.length === 0 ? null : (
            <p className="status-reading">
              Missing inputs: {content.slice.missing_inputs.join(", ")}
            </p>
          )}
          <footer className="metric-actions">
            {onExplain === undefined ? null : (
              <button
                className="action-control"
                onClick={onExplain}
                type="button"
              >
                Metric explanation
              </button>
            )}
            {onEvidence === undefined ? null : (
              <button
                className="action-control"
                onClick={onEvidence}
                type="button"
              >
                View evidence
              </button>
            )}
          </footer>
        </>
      )}
    </article>
  );
}

export interface MetricNavigatorItem {
  coordinate: string;
  resultState: TruthState;
  deltaState?: "AVAILABLE" | "WITHHELD" | "SIDE_UNRESOLVED";
}

const humanize = (value: string) => value.toLowerCase().replaceAll("_", " ");

export function MetricNavigator({
  items,
  selectedCoordinate,
  mode,
  onSelect,
}: {
  items: MetricNavigatorItem[];
  selectedCoordinate?: string;
  mode: "single" | "compare";
  onSelect: (coordinate: string) => void;
}) {
  return (
    <nav aria-label="Metric results" className="metric-navigator">
      <ul>
        {items.map((item) => (
          <li key={item.coordinate}>
            <button
              aria-current={
                item.coordinate === selectedCoordinate ? "true" : undefined
              }
              className="metric-nav-item"
              onClick={() => onSelect(item.coordinate)}
              type="button"
            >
              <span className="metric-coordinate">{item.coordinate}</span>
              <span>Result: {humanize(item.resultState)}</span>
              {mode === "compare" && item.deltaState !== undefined ? (
                <span>Delta: {humanize(item.deltaState)}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
