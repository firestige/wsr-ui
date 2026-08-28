import { scaleLinear } from "d3";

import type { MetricResult, MetricSlice } from "../domain/evolution/types";
import {
  compatibleVisualizerIds,
  type VisualizerId,
} from "../domain/visualization/registry";
import { presentExactValue } from "../domain/visualization/presentation";
import { MetricResultFrame } from "./metric-result";
import { ScopedError } from "./status";

function PanelActions({
  onExplain,
  onEvidence,
}: {
  onExplain?: () => void;
  onEvidence?: () => void;
}) {
  if (onExplain === undefined && onEvidence === undefined) return null;
  return (
    <footer className="metric-actions">
      {onExplain === undefined ? null : (
        <button className="action-control" onClick={onExplain} type="button">
          Metric explanation
        </button>
      )}
      {onEvidence === undefined ? null : (
        <button className="action-control" onClick={onEvidence} type="button">
          View evidence
        </button>
      )}
    </footer>
  );
}

function ResultTable({
  coordinate,
  slices,
  label = "Fallback result data",
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
            <th scope="col">Coverage</th>
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
                {slice.coverage.numerator} / {slice.coverage.denominator}
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

export function MetricPanel({
  result,
  visualizer,
  onExplain,
  onEvidence,
}: {
  result: MetricResult;
  visualizer: VisualizerId;
  onExplain?: () => void;
  onEvidence?: () => void;
}) {
  const coordinate = `${result.metric_id}@${result.metric_version}`;
  const compatible = result.slices.every((slice) =>
    compatibleVisualizerIds(slice).includes(visualizer),
  );
  if (!compatible)
    return (
      <section className="panel-card">
        <ScopedError
          announce="polite"
          detail={`${visualizer} cannot consume the published Result shape without inventing a domain or value.`}
          retryable={false}
          title="Visualizer binding incompatible"
        />
        <ResultTable coordinate={coordinate} slices={result.slices} />
        <PanelActions onEvidence={onEvidence} onExplain={onExplain} />
      </section>
    );
  if (visualizer === "table@1")
    return (
      <section className="panel-card">
        <ResultTable coordinate={coordinate} slices={result.slices} />
        <PanelActions onEvidence={onEvidence} onExplain={onExplain} />
      </section>
    );
  return result.slices.map((slice) => (
    <MetricResultFrame
      content={{ tag: "RESULT", slice }}
      coordinate={coordinate}
      key={JSON.stringify(slice.slice_key)}
      onEvidence={onEvidence}
      onExplain={onExplain}
      visualization={
        visualizer === "ratio-bar@1" ? <RatioBar slice={slice} /> : undefined
      }
    />
  ));
}
