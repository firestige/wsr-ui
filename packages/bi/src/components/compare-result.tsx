import type {
  DeltaEntry,
  MetricResult,
  MetricSlice,
  SideError,
} from "../domain/evolution/types";
import type { VisualizerId } from "../domain/visualization/registry";
import { presentExactValue } from "../domain/visualization/presentation";
import { MetricPanel } from "./result-visualizer";
import { ScopedError } from "./status";

function CompareSide({
  label,
  coordinate,
  slice,
  error,
  ownsError,
  onRetry,
  onExplain,
  onEvidence,
  focusEvidenceAction,
  visualizer,
}: {
  label: "Before" | "After";
  coordinate: string;
  slice?: MetricSlice;
  error?: SideError;
  ownsError: boolean;
  onRetry?: () => void;
  onExplain?: (trigger: HTMLButtonElement) => void;
  onEvidence?: (trigger: HTMLButtonElement) => void;
  focusEvidenceAction: boolean;
  visualizer: VisualizerId;
}) {
  const split = coordinate.lastIndexOf("@");
  const result: MetricResult | undefined =
    slice === undefined
      ? undefined
      : {
          metric_id: coordinate.slice(0, split),
          metric_version: "2.0.0",
          slices: [slice],
        };
  return (
    <section aria-label={`${label} result`} className="compare-side">
      <h3 className="text-label">{label}</h3>
      {result !== undefined ? (
        <MetricPanel
          result={result}
          visualizer={visualizer}
          focusEvidenceAction={focusEvidenceAction}
          onEvidence={onEvidence}
          onExplain={onExplain}
        />
      ) : error !== undefined && ownsError ? (
        <ScopedError
          announce="assertive"
          detail={`${error.code}: ${error.detail}`}
          onRetry={onRetry}
          retryable={error.retryable}
          title={`${label} unavailable`}
        />
      ) : error !== undefined ? (
        <p className="status-reading">
          {label} side unresolved: {error.code}
        </p>
      ) : (
        <p className="empty-state">No matching slice on this side.</p>
      )}
    </section>
  );
}

function DeltaView({ delta }: { delta: DeltaEntry }) {
  return (
    <section aria-label="Delta result" className="compare-delta">
      <h3 className="text-label">Delta</h3>
      {delta.state === "AVAILABLE" && delta.value !== undefined ? (
        <div className="status-stack">
          <span className="metric-number">
            {presentExactValue(delta.value).display}
          </span>
          <span className="status-reading">
            {delta.direction === "INCREASE"
              ? "Increase"
              : delta.direction === "DECREASE"
                ? "Decrease"
                : "No change"}
          </span>
          <span className="numeric-exact">
            Exact delta: {presentExactValue(delta.value).exact}
          </span>
        </div>
      ) : delta.state === "SIDE_UNRESOLVED" ? (
        <p className="status-reading">
          Delta unavailable until both sides resolve
        </p>
      ) : (
        <p className="status-reading">
          Delta withheld: {delta.withholding_reason}
        </p>
      )}
    </section>
  );
}

export function CompareResultFrame({
  coordinate,
  before,
  after,
  beforeError,
  afterError,
  delta,
  onRetryFailedSide,
  ownsFailedSide = true,
  focusEvidenceSide,
  onExplain,
  onEvidence,
  visualizer = "numeric-card@1",
}: {
  coordinate: string;
  before?: MetricSlice;
  after?: MetricSlice;
  beforeError?: SideError;
  afterError?: SideError;
  delta: DeltaEntry;
  onRetryFailedSide?: () => void;
  ownsFailedSide?: boolean;
  focusEvidenceSide?: "left" | "right";
  onExplain?: (side: "left" | "right", trigger: HTMLButtonElement) => void;
  onEvidence?: (side: "left" | "right", trigger: HTMLButtonElement) => void;
  visualizer?: VisualizerId;
}) {
  return (
    <article aria-label={`Compare ${coordinate}`} className="compare-result">
      <CompareSide
        coordinate={coordinate}
        error={beforeError}
        focusEvidenceAction={focusEvidenceSide === "left"}
        label="Before"
        ownsError={ownsFailedSide}
        onEvidence={
          onEvidence === undefined
            ? undefined
            : (trigger) => onEvidence("left", trigger)
        }
        onExplain={
          onExplain === undefined
            ? undefined
            : (trigger) => onExplain("left", trigger)
        }
        onRetry={beforeError === undefined ? undefined : onRetryFailedSide}
        slice={before}
        visualizer={visualizer}
      />
      <CompareSide
        coordinate={coordinate}
        error={afterError}
        focusEvidenceAction={focusEvidenceSide === "right"}
        label="After"
        ownsError={ownsFailedSide}
        onEvidence={
          onEvidence === undefined
            ? undefined
            : (trigger) => onEvidence("right", trigger)
        }
        onExplain={
          onExplain === undefined
            ? undefined
            : (trigger) => onExplain("right", trigger)
        }
        onRetry={afterError === undefined ? undefined : onRetryFailedSide}
        slice={after}
        visualizer={visualizer}
      />
      <DeltaView delta={delta} />
    </article>
  );
}
