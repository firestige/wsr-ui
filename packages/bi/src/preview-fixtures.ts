import type {
  MetricSlice,
  ResolvedEvaluationContext,
} from "./domain/evolution/types";

export const previewSlice: MetricSlice = {
  slice_key: {},
  state: "AVAILABLE",
  value: { kind: "RATIO", value: "3/4", unit: "ratio" },
  measures: {},
  numerator: "3",
  denominator: "4",
  contributing_count: "4",
  coverage: {
    numerator: "4",
    denominator: "4",
    raw_ratio: "1",
    state: "FULL",
    alert: null,
  },
  compatibility: {},
  exclusions: [],
  missing_inputs: [],
  provenance_refs: ["fact:preview"],
};

export const previewReceipt: ResolvedEvaluationContext = {
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
    semantic_digest:
      "851692f9d4a549d21f3c741470737eabb0d40b5f03cf10ffae76e1892023741e",
    observation_profile: "1.0.0",
  },
  evidence_bindings: [
    {
      route: "/v1/evidence/tasks",
      canonical_filter: {
        as_of: "2026-08-28T01:00:00.000000Z",
        task_id: "task-preview",
      },
      contract_revision: "1.0.0",
      observation_profile: "2.0.0",
      read_model_revision: "2.0.0",
      route_snapshot: "task-snapshot-preview",
      completion_state: "COMPLETE",
    },
  ],
  input_refs: [],
  workflow_resolutions: [],
  population_state: "OPEN",
};
