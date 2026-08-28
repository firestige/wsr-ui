import type { ReactNode } from "react";

import type { MetricSlice, TruthState } from "../domain/evolution/types";
import { presentExactValue } from "../domain/visualization/presentation";
import { CoverageLabel, MetricTruthLabel, ScopedError } from "./status";

type MetricFrameContent =
  | { tag: "LOADING" }
  | { tag: "RESULT"; slice: MetricSlice }
  | { tag: "ERROR"; detail: string; retryable: boolean; onRetry?: () => void };

function ExactMetricValue({ slice }: { slice: MetricSlice }) {
  if (slice.value === undefined) return null;
  const presented = presentExactValue(slice.value);
  const unitSuffix = ` ${slice.value.unit}`;
  const displayValue = presented.display.endsWith(unitSuffix)
    ? presented.display.slice(0, -unitSuffix.length)
    : presented.display;
  return (
    <div className="metric-value">
      <span className="metric-number">{displayValue}</span>
      <span className="metric-unit">{slice.value.unit}</span>
      <span className="numeric-exact">Exact value: {presented.exact}</span>
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

function CompatibilityCoordinates({ slice }: { slice: MetricSlice }) {
  const coordinates = Object.entries(slice.compatibility);
  if (slice.state !== "INCOMPATIBLE" || coordinates.length === 0) return null;
  return (
    <section aria-label="Incompatible coordinates" className="status-reading">
      <span>Mismatch coordinates</span>
      <ul>
        {coordinates.map(([name, value]) => (
          <li key={name}>
            <code className="text-code">
              {name}={value}
            </code>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function MetricResultFrame({
  coordinate,
  content,
  visualization,
  onExplain,
  onEvidence,
  onRecover,
  recoveryLabel = "Recover result",
}: {
  coordinate: string;
  content: MetricFrameContent;
  visualization?: ReactNode;
  onExplain?: (trigger: HTMLButtonElement) => void;
  onEvidence?: (trigger: HTMLButtonElement) => void;
  onRecover?: () => void;
  recoveryLabel?: string;
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
          <CompatibilityCoordinates slice={content.slice} />
          <CoverageLabel coverage={content.slice.coverage} />
          {content.slice.missing_inputs.length === 0 ? null : (
            <p className="status-reading">
              Missing inputs: {content.slice.missing_inputs.join(", ")}
            </p>
          )}
          <footer className="metric-actions">
            {content.slice.value !== undefined ||
            onRecover === undefined ? null : (
              <button
                className="action-control"
                onClick={onRecover}
                type="button"
              >
                {recoveryLabel}
              </button>
            )}
            {onExplain === undefined ? null : (
              <button
                className="action-control"
                onClick={(event) => onExplain(event.currentTarget)}
                type="button"
              >
                Metric explanation
              </button>
            )}
            {onEvidence === undefined ? null : (
              <button
                className="action-control"
                onClick={(event) => onEvidence(event.currentTarget)}
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
  beforeState?: TruthState;
  afterState?: TruthState;
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
              {mode === "single" ? (
                <span>Result: {humanize(item.resultState)}</span>
              ) : (
                <>
                  <span>
                    Before: {humanize(item.beforeState ?? "UNRESOLVED")}
                  </span>
                  <span>
                    After: {humanize(item.afterState ?? "UNRESOLVED")}
                  </span>
                  {item.deltaState === undefined ? null : (
                    <span>Delta: {humanize(item.deltaState)}</span>
                  )}
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
