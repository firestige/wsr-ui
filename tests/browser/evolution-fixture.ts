const CATALOG_COORDINATES = [
  "role-template-rework-rate@2.0.0",
  "role-template-trajectory-partial-cost@2.0.0",
  "role-model-task-outcome-rate@2.0.0",
  "operational-latency-ms@2.0.0",
  "trajectory-partial-cost@2.0.0",
  "task-cohort-comparison-eligibility@2.0.0",
  "delivery-stage-reach@2.0.0",
  "delivery-terminal-outcome-rate@2.0.0",
  "delivery-cycle-time-ms@2.0.0",
  "operational-token-usage@2.0.0",
  "operational-attributable-cost@2.0.0",
  "operational-usage-availability@2.0.0",
] as const;

const catalogDigest =
  "851692f9d4a549d21f3c741470737eabb0d40b5f03cf10ffae76e1892023741e";

function receipt(taskIds: string[]) {
  return {
    context_version: 1,
    selection: { selection_version: 1, task_ids: taskIds },
    as_of: "2026-08-28T01:00:00.000000Z",
    resolved_at: "2026-08-28T01:00:01.000000Z",
    task_population: taskIds.map((task_id) => ({
      task_id,
      display_name: `Display ${task_id}`,
      memberships: [],
      cohort_coordinates: {},
      exclusions: ["UNDEFINED_TASK_MEMBERSHIP"],
    })),
    catalog: {
      catalog_id: "agentops.evaluation.metric-catalog",
      version: "2.0.0",
      semantic_digest: catalogDigest,
      observation_profile: "1.0.0",
    },
    evidence_bindings: taskIds.map((task_id) => ({
      route: "/v1/evidence/tasks",
      canonical_filter: {
        as_of: "2026-08-28T01:00:00.000000Z",
        task_id,
      },
      contract_revision: "1.0.0",
      observation_profile: "2.0.0",
      read_model_revision: "2.0.0",
      route_snapshot: `snapshot-${task_id}`,
      completion_state: "COMPLETE",
    })),
    input_refs: [],
    workflow_resolutions: [],
    population_state: "OPEN",
  };
}

const fullCoverage = {
  numerator: "4",
  denominator: "4",
  raw_ratio: "1",
  state: "FULL",
  alert: null,
};

function available(value: object, extra: object = {}) {
  return {
    slice_key: {},
    state: "AVAILABLE",
    value,
    measures: {},
    coverage: fullCoverage,
    compatibility: {},
    exclusions: [],
    missing_inputs: [],
    provenance_refs: ["a".repeat(64)],
    ...extra,
  };
}

function withheld(state: string, withholding_reason: string, extra = {}) {
  return {
    slice_key: {},
    state,
    withholding_reason,
    measures: {},
    coverage: {
      numerator: "0",
      denominator: "0",
      raw_ratio: null,
      state: "NO_POPULATION",
      alert: null,
    },
    compatibility: {},
    exclusions: [],
    missing_inputs: ["fixture input"],
    provenance_refs: [],
    ...extra,
  };
}

function metrics() {
  return CATALOG_COORDINATES.map((coordinate, index) => {
    let slice: Record<string, unknown> = available({
      kind: "COUNT",
      value: "7",
      unit: "count",
    });
    if (index === 0)
      slice = available(
        { kind: "RATIO", value: "0", unit: "ratio" },
        {
          numerator: "0",
          denominator: "4",
          contributing_count: "4",
          measures: { sample_size: "4" },
          coverage: {
            numerator: "1",
            denominator: "20",
            raw_ratio: "1/20",
            state: "PARTIAL",
            alert: "LOW_COVERAGE",
          },
        },
      );
    else if (index === 2)
      slice = withheld("UNAVAILABLE", "SAMPLE_INSUFFICIENT");
    else if (index === 3)
      slice = {
        ...available({ kind: "DURATION_MS", value: "1250", unit: "ms" }),
        state: "LOWER_BOUND",
        reading: "Recorded lower bound only",
        coverage: null,
      };
    else if (index === 6)
      slice = withheld("INCOMPATIBLE", "INCOMPATIBLE_INPUT", {
        compatibility: { source_id: "mixed" },
      });
    else if (index === 7) slice = withheld("EXPIRED", "EXPIRED_INPUT");
    else if (index === 9)
      slice = withheld("NOT_APPLICABLE", "NO_APPLICABLE_POPULATION");
    return {
      metric_id: coordinate.slice(0, coordinate.lastIndexOf("@")),
      metric_version: "2.0.0",
      slices: [slice],
    };
  });
}

function side(taskIds: string[]) {
  return {
    tag: "SIDE_RESULT",
    receipt: receipt(taskIds),
    metric_results: metrics(),
  };
}

export function evaluationResponse(request: {
  mode: "SINGLE" | "COMPARE";
  selection?: { task_ids: string[] };
  left?: { task_ids: string[] };
  right?: { task_ids: string[] };
}) {
  if (request.mode === "SINGLE")
    return {
      api_version: 1,
      mode: "SINGLE",
      result: side(request.selection!.task_ids),
    };
  const left = side(request.left!.task_ids);
  const right = side(request.right!.task_ids);
  return {
    api_version: 1,
    mode: "COMPARE",
    status: "FULL_COMPARE",
    left,
    right,
    deltas: CATALOG_COORDINATES.map((metric_coordinate, index) => {
      const slice = left.metric_results[index]!.slices[0]!;
      const value = slice.value as { kind: string; unit: string };
      return slice.state === "AVAILABLE"
        ? {
            metric_coordinate,
            slice_key: {},
            state: "AVAILABLE",
            value: { kind: value.kind, value: "0", unit: value.unit },
            direction: "NO_CHANGE",
          }
        : {
            metric_coordinate,
            slice_key: {},
            state: "WITHHELD",
            withholding_reason: "FIXTURE_DELTA_WITHHELD",
          };
    }),
  };
}
