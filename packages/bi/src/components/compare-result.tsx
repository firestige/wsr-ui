import type {
  DeltaEntry,
  MetricSlice,
  SideError,
} from "../domain/evolution/types";
import { presentExactValue } from "../domain/visualization/presentation";
import { MetricResultFrame } from "./metric-result";
import { ScopedError } from "./status";

function CompareSide({
  label,
  coordinate,
  slice,
  error,
  onRetry,
}: {
  label: "Before" | "After";
  coordinate: string;
  slice?: MetricSlice;
  error?: SideError;
  onRetry?: () => void;
}) {
  return (
    <section aria-label={`${label} result`} className="compare-side">
      <h3 className="text-label">{label}</h3>
      {slice !== undefined ? (
        <MetricResultFrame
          content={{ tag: "RESULT", slice }}
          coordinate={coordinate}
        />
      ) : error !== undefined ? (
        <ScopedError
          announce="assertive"
          detail={`${error.code}: ${error.detail}`}
          onRetry={onRetry}
          retryable={error.retryable}
          title={`${label} unavailable`}
        />
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
}: {
  coordinate: string;
  before?: MetricSlice;
  after?: MetricSlice;
  beforeError?: SideError;
  afterError?: SideError;
  delta: DeltaEntry;
  onRetryFailedSide?: () => void;
}) {
  return (
    <article aria-label={`Compare ${coordinate}`} className="compare-result">
      <CompareSide
        coordinate={coordinate}
        error={beforeError}
        label="Before"
        onRetry={beforeError === undefined ? undefined : onRetryFailedSide}
        slice={before}
      />
      <CompareSide
        coordinate={coordinate}
        error={afterError}
        label="After"
        onRetry={afterError === undefined ? undefined : onRetryFailedSide}
        slice={after}
      />
      <DeltaView delta={delta} />
    </article>
  );
}
