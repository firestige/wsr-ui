import { scaleLinear } from "d3";

import { METRIC_COPY } from "../domain/catalog/metric-copy";
import type { MetricResult, MetricSlice } from "../domain/evolution/types";
import { isMetricResult } from "../domain/evolution/validation";
import {
  compatibleVisualizerIds,
  selectDefaultVisualizer,
  type VisualizerId,
} from "../domain/visualization/registry";
import { presentExactValue } from "../domain/visualization/presentation";
import { MetricResultFrame } from "./metric-result";
import { Button } from "./design-system";
import { MetricTruthLabel, ScopedError } from "./status";

function PanelActions({
  onExplain,
  onEvidence,
  focusEvidenceAction = false,
}: {
  onExplain?: (trigger: HTMLButtonElement) => void;
  onEvidence?: (trigger: HTMLButtonElement) => void;
  focusEvidenceAction?: boolean;
}) {
  if (onExplain === undefined && onEvidence === undefined) return null;
  return (
    <footer className="metric-actions">
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
          autoFocus={focusEvidenceAction}
          className="action-control"
          onClick={(event) => onEvidence(event.currentTarget)}
          type="button"
        >
          View evidence
        </button>
      )}
    </footer>
  );
}

function ResultTable({
  coordinate,
  slices,
  label = "Result data",
}: {
  coordinate: string;
  slices: MetricSlice[];
  label?: string;
}) {
  return (
    <div className="bounded-table">
      <table
        aria-label={`${label}: ${coordinate}`}
        className="visual-data-table"
      >
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Slice</th>
            <th scope="col">State</th>
            <th scope="col">Exact value</th>
            <th scope="col">Result population</th>
            <th scope="col">Measures</th>
            <th scope="col">Coverage</th>
            <th scope="col">Compatibility</th>
            <th scope="col">Limitations</th>
            <th scope="col">Provenance</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr key={JSON.stringify(slice.slice_key)}>
              <td className="numeric-exact">
                {JSON.stringify(slice.slice_key)}
              </td>
              <td>{slice.state}</td>
              <td className="numeric-exact">
                {slice.value === undefined
                  ? slice.withholding_reason
                  : presentExactValue(slice.value).exact}
              </td>
              <td className="numeric-exact">
                {slice.numerator === undefined ||
                slice.denominator === undefined
                  ? "Not published"
                  : `${slice.numerator} / ${slice.denominator}`}
                {slice.contributing_count === undefined
                  ? null
                  : ` · Contributing: ${slice.contributing_count}`}
              </td>
              <td className="numeric-exact">
                {Object.keys(slice.measures).length === 0
                  ? "None"
                  : JSON.stringify(slice.measures)}
              </td>
              <td className="numeric-exact">
                {slice.coverage === null
                  ? "Unavailable"
                  : `${slice.coverage.state} · ${slice.coverage.numerator} / ${slice.coverage.denominator} · ${slice.coverage.raw_ratio ?? "not applicable"}${slice.coverage.alert === null ? "" : ` · ${slice.coverage.alert}`}`}
              </td>
              <td className="numeric-exact">
                {Object.keys(slice.compatibility).length === 0
                  ? "None"
                  : JSON.stringify(slice.compatibility)}
              </td>
              <td>
                {[
                  ...slice.exclusions.map((item) => `Excluded: ${item}`),
                  ...slice.missing_inputs.map((item) => `Missing: ${item}`),
                  ...(slice.reading === undefined ? [] : [slice.reading]),
                ].join(" · ") || "None"}
              </td>
              <td className="numeric-exact">
                {slice.provenance_refs.join(", ") || "None"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ratioInUnitDomain(value: string): boolean {
  const [numeratorText, denominatorText = "1"] = value.split("/");
  try {
    const numerator = BigInt(numeratorText!);
    const denominator = BigInt(denominatorText);
    return denominator > 0n && numerator >= 0n && numerator <= denominator;
  } catch {
    return false;
  }
}

function RatioBar({ slice }: { slice: MetricSlice }) {
  if (slice.value?.kind !== "RATIO") return null;
  const [numerator, denominatorText] = slice.value.value.split("/");
  const denominator = BigInt(denominatorText ?? "1");
  const basisPoints = Number((BigInt(numerator!) * 10_000n) / denominator);
  const end = scaleLinear().domain([0, 10_000]).range([8, 198])(basisPoints);
  const presented = presentExactValue(slice.value);
  return (
    <div className="visual-with-fallback">
      <svg
        aria-label="Ratio bar"
        className="visual-preview text-data-series-1"
        role="img"
        viewBox="0 0 206 70"
      >
        <title>{`${presented.display}; exact ${presented.exact}`}</title>
        <path className="stroke-border-default" d="M8 35 H198" fill="none" />
        <rect
          className="fill-current"
          height="18"
          width={Math.max(0, end - 8)}
          x="8"
          y="26"
        />
      </svg>
      <table aria-label="Ratio bar data" className="visual-data-table">
        <caption>Ratio bar data</caption>
        <tbody>
          <tr>
            <th scope="row">Exact ratio</th>
            <td className="numeric-exact">{slice.value.value}</td>
          </tr>
          <tr>
            <th scope="row">Display percent</th>
            <td>{presented.display}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BooleanBadge({ slice }: { slice: MetricSlice }) {
  if (slice.value?.kind !== "BOOLEAN") return null;
  return (
    <span aria-label="Boolean result" className="status-label" role="status">
      <span aria-hidden="true">{slice.value.value ? "✓" : "○"}</span>{" "}
      {slice.value.value ? "True" : "False"}
    </span>
  );
}

function DashboardResultTable({
  coordinate,
  slices,
}: {
  coordinate: string;
  slices: MetricSlice[];
}) {
  return (
    <div className="bounded-table">
      <table
        aria-label={`Dashboard result preview: ${coordinate}`}
        className="visual-data-table dashboard-result-table"
      >
        <thead>
          <tr>
            <th scope="col">Slice</th>
            <th scope="col">State</th>
            <th scope="col">Exact value</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr key={JSON.stringify(slice.slice_key)}>
              <td className="numeric-exact">
                {JSON.stringify(slice.slice_key)}
              </td>
              <td>{slice.state}</td>
              <td className="numeric-exact">
                {slice.value === undefined
                  ? slice.withholding_reason
                  : presentExactValue(slice.value).exact}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DashboardMetricPanel({
  result,
  visualizer,
  size,
  onEvidence,
}: {
  result: MetricResult;
  visualizer?: VisualizerId;
  size: "SMALL" | "MEDIUM" | "WIDE";
  onEvidence?: (trigger: HTMLButtonElement) => void;
}) {
  if (!isMetricResult(result))
    return (
      <section className="panel-card" data-presentation="dashboard">
        <ScopedError
          announce="assertive"
          detail="The supplied value does not satisfy the formal Metric Result 2.0.0 contract."
          retryable={false}
          title="Metric Result incompatible"
        />
      </section>
    );
  const coordinate = `${result.metric_id}@${result.metric_version}`;
  const title = Object.hasOwn(METRIC_COPY, coordinate)
    ? METRIC_COPY[coordinate as keyof typeof METRIC_COPY].definition
    : coordinate;
  const resolvedVisualizer = visualizer ?? selectDefaultVisualizer(result);
  const slice = result.slices[0];
  if (resolvedVisualizer === "table@1" || result.slices.length !== 1)
    return (
      <article
        aria-label={title}
        className="dashboard-metric-panel"
        data-metric-coordinate={coordinate}
        data-panel-size={size}
        data-presentation="dashboard"
        data-visualizer={resolvedVisualizer}
      >
        <header className="dashboard-panel-head">
          <h3>{title}</h3>
        </header>
        <DashboardResultTable coordinate={coordinate} slices={result.slices} />
        {onEvidence === undefined ? null : (
          <footer className="dashboard-panel-actions">
            <Button
              onClick={(event) => onEvidence(event.currentTarget)}
              type="button"
            >
              View evidence
            </Button>
          </footer>
        )}
      </article>
    );
  if (slice === undefined) return null;
  const presented =
    slice.value === undefined ? undefined : presentExactValue(slice.value);
  const ratioPercent =
    slice.value?.kind === "RATIO" && ratioInUnitDomain(slice.value.value)
      ? Number(
          (BigInt(slice.value.value.split("/")[0]!) * 10_000n) /
            BigInt(slice.value.value.split("/")[1] ?? "1"),
        ) / 100
      : undefined;
  return (
    <article
      aria-label={title}
      className="dashboard-metric-panel"
      data-metric-coordinate={coordinate}
      data-panel-size={size}
      data-presentation="dashboard"
      data-visualizer={resolvedVisualizer}
    >
      <header className="dashboard-panel-head">
        <h3>{title}</h3>
        <MetricTruthLabel
          detail="label"
          reading={slice.reading}
          state={slice.state}
          withholdingReason={slice.withholding_reason}
        />
      </header>
      {slice.value === undefined ? (
        slice.coverage === null ? null : (
          <p className="dashboard-panel-meta">
            {slice.coverage.state === "NO_POPULATION"
              ? "No applicable population"
              : slice.coverage.state.toLowerCase().replaceAll("_", " ")}{" "}
            · {slice.coverage.numerator} / {slice.coverage.denominator}
          </p>
        )
      ) : resolvedVisualizer === "badge@1" ? (
        <BooleanBadge slice={slice} />
      ) : (
        <div className="metric-value">
          <span className="metric-number">{presented?.display}</span>
          {resolvedVisualizer === "ratio-bar@1" ? null : (
            <span className="numeric-exact">
              Exact value: {presented?.exact}
            </span>
          )}
        </div>
      )}
      {resolvedVisualizer === "ratio-bar@1" && ratioPercent !== undefined ? (
        <div
          aria-label={`${title}: ${presented?.display}; exact ${presented?.exact}`}
          className="dashboard-ratio"
          role="img"
        >
          <i style={{ width: `${ratioPercent}%` }} />
        </div>
      ) : null}
      {slice.numerator === undefined ||
      slice.denominator === undefined ? null : (
        <p className="dashboard-panel-meta">
          {slice.numerator} / {slice.denominator} exact
        </p>
      )}
      {size === "SMALL" || onEvidence === undefined ? null : (
        <footer className="dashboard-panel-actions">
          <Button
            onClick={(event) => onEvidence(event.currentTarget)}
            type="button"
          >
            View evidence
          </Button>
        </footer>
      )}
    </article>
  );
}

export function MetricPanel({
  result,
  visualizer,
  onExplain,
  onEvidence,
  focusEvidenceAction = false,
}: {
  result: MetricResult;
  visualizer?: VisualizerId;
  onExplain?: (trigger: HTMLButtonElement) => void;
  onEvidence?: (trigger: HTMLButtonElement) => void;
  focusEvidenceAction?: boolean;
}) {
  if (!isMetricResult(result))
    return (
      <section className="panel-card">
        <ScopedError
          announce="assertive"
          detail="The supplied value does not satisfy the formal Metric Result 2.0.0 contract."
          retryable={false}
          title="Metric Result incompatible"
        />
      </section>
    );
  const resolvedVisualizer = visualizer ?? selectDefaultVisualizer(result);
  const coordinate = `${result.metric_id}@${result.metric_version}`;
  const compatible = result.slices.every((slice) =>
    slice.value === undefined
      ? true
      : compatibleVisualizerIds(slice).includes(resolvedVisualizer) &&
        (resolvedVisualizer !== "ratio-bar@1" ||
          (slice.value.kind === "RATIO" &&
            ratioInUnitDomain(slice.value.value))),
  );
  if (!compatible)
    return (
      <section className="panel-card">
        <ScopedError
          announce="polite"
          detail={`${resolvedVisualizer} cannot consume the published Result shape without inventing a domain or value.`}
          retryable={false}
          title="Visualizer binding incompatible"
        />
        <ResultTable
          coordinate={coordinate}
          label="Fallback result data"
          slices={result.slices}
        />
        <PanelActions
          focusEvidenceAction={focusEvidenceAction}
          onEvidence={onEvidence}
          onExplain={onExplain}
        />
      </section>
    );
  if (resolvedVisualizer === "table@1")
    return (
      <section className="panel-card">
        <ResultTable coordinate={coordinate} slices={result.slices} />
        <PanelActions
          focusEvidenceAction={focusEvidenceAction}
          onEvidence={onEvidence}
          onExplain={onExplain}
        />
      </section>
    );
  return result.slices.map((slice) => (
    <MetricResultFrame
      content={{ tag: "RESULT", slice }}
      coordinate={coordinate}
      key={JSON.stringify(slice.slice_key)}
      onEvidence={onEvidence}
      onExplain={onExplain}
      focusEvidenceAction={focusEvidenceAction}
      visualization={
        resolvedVisualizer === "ratio-bar@1" ? (
          <RatioBar slice={slice} />
        ) : resolvedVisualizer === "badge@1" ? (
          <BooleanBadge slice={slice} />
        ) : undefined
      }
    />
  ));
}
