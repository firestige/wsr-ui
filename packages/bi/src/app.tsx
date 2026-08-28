import { line } from "d3";
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
import type {
  Coverage,
  MetricSlice,
  ResolvedEvaluationContext,
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

const trendPoints: ReadonlyArray<readonly [number, number]> = [
  [8, 57],
  [46, 45],
  [84, 51],
  [122, 29],
  [160, 35],
  [198, 18],
];

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

const previewSlice: MetricSlice = {
  slice_key: {},
  state: "AVAILABLE",
  value: { kind: "RATIO", value: "3/4", unit: "ratio" },
  measures: {},
  numerator: "3",
  denominator: "4",
  contributing_count: "4",
  coverage: coverages[3]!,
  compatibility: {},
  exclusions: [],
  missing_inputs: [],
  provenance_refs: ["fact:preview"],
};

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
    coverage: state === "NOT_APPLICABLE" ? coverages[0]! : coverages[1]!,
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
  orphans: [{ id: "orphan", label: "Missing endpoint", state: "EXPIRED" }],
};

const receipt: ResolvedEvaluationContext = {
  context_version: 1,
  selection: { selection_version: 1, task_ids: ["task-preview"] },
  as_of: "2026-08-28T01:00:00.000000Z",
  resolved_at: "2026-08-28T01:00:01.000000Z",
  task_population: [
    {
      task_id: "task-preview",
      display_name: "Preview task",
      memberships: [],
      cohort_coordinates: {},
      exclusions: ["UNDEFINED_TASK_MEMBERSHIP"],
    },
  ],
  catalog: {
    catalog_id: "agentops.evaluation.metric-catalog",
    version: "2.0.0",
    semantic_digest: "a".repeat(64),
    observation_profile: "1.0.0",
  },
  evidence_bindings: [],
  input_refs: [],
  workflow_resolutions: [],
  population_state: "OPEN",
};

function FactualPreview() {
  const path = useMemo(
    () =>
      line<readonly [number, number]>()
        .x(([x]) => x)
        .y(([, y]) => y)(trendPoints),
    [],
  );
  return (
    <div className="visual-with-fallback">
      <svg
        aria-label="Factual trend preview"
        className="visual-preview text-data-series-1"
        role="img"
        viewBox="0 0 206 70"
      >
        <path className="stroke-border-default" d="M8 62 H198" fill="none" />
        <path className="stroke-current" d={path ?? undefined} fill="none" />
        {trendPoints.map(([x, y]) => (
          <circle
            className="fill-current"
            cx={x}
            cy={y}
            key={`${x}-${y}`}
            r="2.5"
          />
        ))}
      </svg>
      <table className="visual-data-table">
        <caption>Factual trend data</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            <th scope="col">X</th>
            <th scope="col">Y</th>
          </tr>
        </thead>
        <tbody>
          {trendPoints.map(([x, y], index) => (
            <tr key={`${x}-${y}`}>
              <th scope="row">{index + 1}</th>
              <td>{x}</td>
              <td>{y}</td>
            </tr>
          ))}
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
            visualization={<FactualPreview />}
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
          <ReceiptView receipt={receipt} side="single" />
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
