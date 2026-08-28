import { scaleLinear } from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

import { MetricExplanationView, ReceiptView } from "./components/details";
import {
  EvidenceConsoleFoundation,
  type EvidenceConsoleRow,
  type EvidenceScope,
} from "./components/evidence-console";
import { OwnedInspector } from "./components/inspector";
import { MetricResultFrame } from "./components/metric-result";
import {
  MotionControl,
  RecordedStructureFoundation,
  type MotionMode,
  type RecordedStructureViewModel,
} from "./components/recorded-structure";
import {
  CoverageLabel,
  EvidenceLifecycleLabel,
  MetricTruthLabel,
} from "./components/status";
import { previewReceipt, previewSlice } from "./preview-fixtures";
import type {
  Coverage,
  MetricSlice,
  TruthState,
  WithholdingReason,
} from "./domain/evolution/types";

type Theme = "system" | "light" | "dark";
type Density = "comfortable" | "compact";
type InspectorKind = "explanation" | "receipt";
type EvidencePreviewState = "READY" | "EMPTY" | "PARTIAL" | "EXPIRED";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

const truthStates: TruthState[] = [
  "AVAILABLE",
  "LOWER_BOUND",
  "NOT_APPLICABLE",
  "UNAVAILABLE",
  "EXPIRED",
  "INCOMPATIBLE",
];

const coverages: Coverage[] = [
  {
    numerator: "0",
    denominator: "0",
    raw_ratio: null,
    state: "NO_POPULATION",
    alert: null,
  },
  {
    numerator: "0",
    denominator: "4",
    raw_ratio: "0",
    state: "NO_COVERAGE",
    alert: "LOW_COVERAGE",
  },
  {
    numerator: "3",
    denominator: "4",
    raw_ratio: "3/4",
    state: "PARTIAL",
    alert: null,
  },
  {
    numerator: "4",
    denominator: "4",
    raw_ratio: "1",
    state: "FULL",
    alert: null,
  },
];

const withheldReasons: Partial<Record<TruthState, WithholdingReason>> = {
  NOT_APPLICABLE: "NO_APPLICABLE_POPULATION",
  UNAVAILABLE: "MISSING_INPUT",
  EXPIRED: "EXPIRED_INPUT",
  INCOMPATIBLE: "INCOMPATIBLE_INPUT",
};

const truthSlices = truthStates.map((state): MetricSlice => {
  const hasValue = state === "AVAILABLE" || state === "LOWER_BOUND";
  return {
    ...previewSlice,
    state,
    value: hasValue ? previewSlice.value : undefined,
    withholding_reason: withheldReasons[state],
    reading: hasValue
      ? "Authoritative Metric Result value."
      : "Value is withheld; inspect the reason or change the selection.",
    coverage:
      state === "AVAILABLE" || state === "LOWER_BOUND"
        ? coverages[3]!
        : state === "NOT_APPLICABLE"
          ? coverages[0]!
          : coverages[1]!,
  };
});

const evidenceRows: EvidenceConsoleRow[] = [
  {
    factId: "fact-preview",
    factClass: "delivery.outcome",
    coordinates: { delivery_id: "delivery-preview" },
    provenance: "accepted:event-preview",
    truth: {
      completeness: "FINAL",
      availability: "AVAILABLE",
      expiry: "ACTIVE",
      expires_at: null,
    },
    trace: {
      traceId: "trace-preview",
      spanId: "span-preview",
      state: "PARTIAL",
    },
  },
];

const structure: RecordedStructureViewModel = {
  depthGroups: [
    { depth: 0, nodes: [{ id: "root", label: "Root", state: "AVAILABLE" }] },
    {
      depth: 1,
      nodes: [
        { id: "writer", label: "Writer", state: "PARTIAL" },
        { id: "reviewer", label: "Reviewer", state: "AVAILABLE" },
      ],
    },
  ],
  links: [{ sourceId: "writer", targetId: "reviewer", state: "AVAILABLE" }],
  orphans: [{ id: "orphan", label: "Missing endpoint", state: "PARTIAL" }],
};

function FactualPreview({ slice }: { slice: MetricSlice }) {
  const numerator = BigInt(slice.numerator ?? "0");
  const denominator = BigInt(slice.denominator ?? "0");
  const displayBasisPoints =
    denominator === 0n ? 0 : Number((numerator * 10_000n) / denominator);
  const displayPercent = (displayBasisPoints / 100).toFixed(2);
  const barEnd = useMemo(
    () => scaleLinear().domain([0, 10_000]).range([8, 198])(displayBasisPoints),
    [displayBasisPoints],
  );
  return (
    <div className="visual-with-fallback">
      <svg
        aria-label="Factual ratio preview"
        className="visual-preview text-data-series-1"
        role="img"
        viewBox="0 0 206 70"
      >
        <path className="stroke-border-default" d="M8 35 H198" fill="none" />
        <rect
          className="fill-current"
          height="18"
          width={barEnd - 8}
          x="8"
          y="26"
        />
      </svg>
      <table className="visual-data-table">
        <caption>Factual ratio data</caption>
        <thead>
          <tr>
            <th scope="col">Numerator</th>
            <th scope="col">Denominator</th>
            <th scope="col">Display percent</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{slice.numerator}</td>
            <td>{slice.denominator}</td>
            <td>{displayPercent}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function TracePreview() {
  return (
    <svg
      aria-label="Recorded trace preview"
      className="visual-preview text-data-series-2"
      role="img"
      viewBox="0 0 206 70"
    >
      <path
        className="stroke-border-strong"
        d="M29 35 H94 M112 35 H177"
        fill="none"
      />
      {[20, 103, 186].map((x) => (
        <circle
          className="fill-surface-panel stroke-current"
          cx={x}
          cy="35"
          key={x}
          r="9"
        />
      ))}
    </svg>
  );
}

export function App() {
  const [theme, setTheme] = useState<Theme>("system");
  const [density, setDensity] = useState<Density>("comfortable");
  const [inspector, setInspector] = useState<InspectorKind | null>(null);
  const [scope, setScope] = useState<EvidenceScope>("result");
  const [evidenceState, setEvidenceState] =
    useState<EvidencePreviewState>("READY");
  const [motion, setMotion] = useState<MotionMode>("STILL");
  const reducedMotion = useReducedMotion();
  const explanationButton = useRef<HTMLButtonElement>(null);
  const receiptButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.density = density;
  }, [density]);

  const evidenceConsoleState = { tag: evidenceState } as const;
  const invokerRef =
    inspector === "receipt" ? receiptButton : explanationButton;

  return (
    <main className="min-h-screen bg-surface-canvas px-layout-page py-layout-section text-content-primary">
      <div className="mx-auto flex max-w-layout-content flex-col gap-layout-section">
        <header className="flex flex-wrap items-end justify-between gap-layout-cluster">
          <div className="space-y-layout-tight">
            <p className="text-label text-content-muted">Component preview</p>
            <h1 className="text-title">BI visual system</h1>
            <p className="max-w-prose text-body text-content-secondary">
              Semantic, typed presentation foundations; this is not the product
              dashboard.
            </p>
          </div>
          <div className="flex flex-wrap gap-layout-cluster">
            <label className="control-label">
              Theme
              <select
                className="control-field"
                onChange={(event) => setTheme(event.target.value as Theme)}
                value={theme}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="control-label">
              Density
              <select
                className="control-field"
                onChange={(event) => setDensity(event.target.value as Density)}
                value={density}
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          </div>
        </header>

        <section
          aria-label="Metric truth states"
          className="panel-card"
          role="region"
        >
          <h2 className="text-heading">Metric truth states</h2>
          <div className="flex flex-wrap gap-layout-cluster">
            {truthStates.map((state) => (
              <MetricTruthLabel key={state} state={state} />
            ))}
          </div>
          <div className="grid gap-layout-grid lg:grid-cols-2">
            {truthSlices.map((slice) => (
              <MetricResultFrame
                content={{ tag: "RESULT", slice }}
                coordinate={`${slice.state.toLowerCase().replaceAll("_", "-")}-preview@2.0.0`}
                key={slice.state}
                onRecover={
                  slice.value === undefined ? () => undefined : undefined
                }
                recoveryLabel="Change selection"
              />
            ))}
          </div>
          <div className="grid gap-layout-grid lg:grid-cols-2">
            {coverages.map((coverage) => (
              <CoverageLabel coverage={coverage} key={coverage.state} />
            ))}
          </div>
        </section>

        <section
          aria-label="Metric presentation foundations"
          className="grid gap-layout-grid lg:grid-cols-2"
        >
          <MetricResultFrame
            content={{ tag: "RESULT", slice: previewSlice }}
            coordinate="terminal-outcome-rate-preview@2.0.0"
            visualization={<FactualPreview slice={previewSlice} />}
          />
          <article className="panel-card">
            <EvidenceLifecycleLabel traceState="PARTIAL" />
            <TracePreview />
          </article>
          <MetricResultFrame
            content={{ tag: "LOADING" }}
            coordinate="loading-preview@2.0.0"
          />
          <MetricResultFrame
            content={{
              tag: "ERROR",
              detail: "Scoped preview error; selection remains intact.",
              retryable: false,
            }}
            coordinate="error-preview@2.0.0"
          />
        </section>

        <section className="panel-card">
          <h2 className="text-heading">Owned detail inspector</h2>
          <div className="metric-actions">
            <button
              className="action-control"
              onClick={() => setInspector("explanation")}
              ref={explanationButton}
              type="button"
            >
              Preview metric explanation
            </button>
            <button
              className="action-control"
              onClick={() => setInspector("receipt")}
              ref={receiptButton}
              type="button"
            >
              Preview receipt
            </button>
          </div>
        </section>

        <section className="panel-card">
          <label className="control-label">
            Evidence preview state
            <select
              className="control-field"
              onChange={(event) =>
                setEvidenceState(event.target.value as EvidencePreviewState)
              }
              value={evidenceState}
            >
              <option value="READY">Ready</option>
              <option value="EMPTY">Empty</option>
              <option value="PARTIAL">Partial</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
          <EvidenceConsoleFoundation
            onScopeChange={setScope}
            rows={evidenceState === "EMPTY" ? [] : evidenceRows}
            scope={scope}
            state={evidenceConsoleState}
          />
        </section>

        <section className="panel-card">
          <RecordedStructureFoundation
            model={structure}
            onSelect={() => undefined}
          />
          <MotionControl
            canStart
            mode={motion}
            onReset={() => setMotion("STILL")}
            onStart={() => setMotion("COMPLETE")}
            onStop={() => setMotion("STILL")}
            reducedMotion={reducedMotion}
          />
        </section>
      </div>

      <OwnedInspector
        invokerRef={invokerRef}
        kind={inspector ?? "explanation"}
        modal
        onClose={() => setInspector(null)}
        open={inspector !== null}
        title={
          inspector === "receipt" ? "Evaluation receipt" : "Metric explanation"
        }
      >
        {inspector === "receipt" ? (
          <ReceiptView receipt={previewReceipt} side="single" />
        ) : (
          <MetricExplanationView
            definition="Share of eligible Deliveries with a terminal outcome."
            eligibility="Closed Deliveries with a valid outcome Fact."
            exclusions={["Open Deliveries", "Invalid values"]}
            limits="This metric does not attribute causes or recommend Workflow changes."
            metricCoordinate="terminal-outcome-rate@2.0.0"
            valueSemantics="Exact ratio over the eligible Delivery population."
          />
        )}
      </OwnedInspector>
    </main>
  );
}
