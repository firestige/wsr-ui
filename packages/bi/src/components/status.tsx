import type { Truth } from "../domain/evidence/types";
import type {
  Coverage,
  TruthState,
  WithholdingReason,
} from "../domain/evolution/types";

const metricTruth: Record<
  TruthState,
  { label: string; marker: string; tone: string }
> = {
  AVAILABLE: { label: "Available", marker: "✓", tone: "available" },
  LOWER_BOUND: { label: "Lower bound", marker: "≥", tone: "attention" },
  NOT_APPLICABLE: {
    label: "Not applicable",
    marker: "—",
    tone: "unavailable",
  },
  UNAVAILABLE: { label: "Unavailable", marker: "×", tone: "unavailable" },
  EXPIRED: { label: "Expired", marker: "⌛", tone: "expired" },
  INCOMPATIBLE: { label: "Incompatible", marker: "≠", tone: "incompatible" },
};

export function MetricTruthLabel({
  state,
  withholdingReason,
  reading,
}: {
  state: TruthState;
  withholdingReason?: WithholdingReason;
  reading?: string;
}) {
  const truth = metricTruth[state];
  return (
    <div className="status-stack" data-state={state}>
      <span className={`status-label status-${truth.tone}`}>
        <span aria-hidden="true">{truth.marker}</span>
        {truth.label}
      </span>
      {withholdingReason === undefined ? null : (
        <span className="status-reason">Reason: {withholdingReason}</span>
      )}
      {reading === undefined ? null : (
        <span className="status-reading">{reading}</span>
      )}
    </div>
  );
}

const coverageLabels: Record<Coverage["state"], string> = {
  NO_POPULATION: "No applicable population",
  NO_COVERAGE: "No coverage",
  PARTIAL: "Partial coverage",
  FULL: "Full coverage",
};

const coveragePresentation: Record<
  Coverage["state"],
  { marker: string; tone: string }
> = {
  NO_POPULATION: { marker: "○", tone: "unavailable" },
  NO_COVERAGE: { marker: "○", tone: "attention" },
  PARTIAL: { marker: "△", tone: "attention" },
  FULL: { marker: "●", tone: "available" },
};

export function CoverageLabel({ coverage }: { coverage: Coverage | null }) {
  if (coverage === null)
    return (
      <div className="coverage-label" data-coverage="UNAVAILABLE">
        <span className="status-label status-unavailable">
          <span aria-hidden="true">○</span>
          Coverage unavailable
        </span>
      </div>
    );
  const presentation = coveragePresentation[coverage.state];
  return (
    <div className="coverage-label" data-coverage={coverage.state}>
      <span className={`status-label status-${presentation.tone}`}>
        <span aria-hidden="true">{presentation.marker}</span>
        {coverageLabels[coverage.state]}
      </span>
      <span className="numeric-exact">
        {coverage.numerator} / {coverage.denominator}
      </span>
      {coverage.alert === "LOW_COVERAGE" ? (
        <span className="status-reason">Low coverage</span>
      ) : null}
    </div>
  );
}

const humanize = (value: string) => value.toLowerCase().replaceAll("_", " ");

type EvidenceLifecycleProps =
  | { truth: Truth; traceState?: never }
  | {
      truth?: never;
      traceState: "ABSENT" | "AVAILABLE" | "PARTIAL" | "EXPIRED";
    };

export function EvidenceLifecycleLabel(props: EvidenceLifecycleProps) {
  if (props.traceState !== undefined) {
    const label =
      props.traceState === "PARTIAL"
        ? "partial recorded data"
        : humanize(props.traceState);
    const tone =
      props.traceState === "AVAILABLE"
        ? "available"
        : props.traceState === "EXPIRED"
          ? "expired"
          : props.traceState === "PARTIAL"
            ? "attention"
            : "unavailable";
    return (
      <span className={`status-label status-${tone}`}>
        <span aria-hidden="true">◇</span>
        Trace: {label}
      </span>
    );
  }

  const { truth } = props;
  return (
    <div className="lifecycle-grid">
      <span>Completeness: {humanize(truth.completeness ?? "UNSPECIFIED")}</span>
      <span>Availability: {humanize(truth.availability)}</span>
      <span>Expiry: {humanize(truth.expiry)}</span>
    </div>
  );
}

export function ScopedError({
  title,
  detail,
  correlation,
  retryable,
  onRetry,
  announce,
}: {
  title: string;
  detail: string;
  correlation?: string;
  retryable: boolean;
  onRetry?: () => void;
  announce: "polite" | "assertive";
}) {
  return (
    <section
      aria-live={announce}
      className="scoped-error"
      role={announce === "assertive" ? "alert" : "status"}
    >
      <h3 className="text-heading">{title}</h3>
      <p className="text-body">{detail}</p>
      {correlation === undefined ? null : (
        <code className="text-code">Correlation: {correlation}</code>
      )}
      {retryable && onRetry !== undefined ? (
        <button className="action-control" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </section>
  );
}
