export type TruthState =
  | "AVAILABLE"
  | "LOWER_BOUND"
  | "NOT_APPLICABLE"
  | "UNAVAILABLE"
  | "EXPIRED"
  | "INCOMPATIBLE";

export interface EvaluationSelection {
  selection_version: 1;
  task_ids: string[];
}

interface NumericExactValue {
  kind: "COUNT" | "QUANTITY" | "RATIO" | "MONEY" | "DURATION_MS";
  value: string;
  unit: string;
  precision?: never;
  rounding?: never;
}

interface BooleanExactValue {
  kind: "BOOLEAN";
  value: boolean;
  unit: string;
  precision?: never;
  rounding?: never;
}

export type ExactValue = NumericExactValue | BooleanExactValue;

export type WithholdingReason =
  | "SAMPLE_INSUFFICIENT"
  | "MISSING_INPUT"
  | "NO_APPLICABLE_POPULATION"
  | "OPEN_TASK"
  | "MIXED_TASK_OUTCOMES"
  | "EXPIRED_INPUT"
  | "INCOMPATIBLE_INPUT";

export interface Coverage {
  numerator: string;
  denominator: string;
  raw_ratio: string | null;
  state: "NO_POPULATION" | "NO_COVERAGE" | "PARTIAL" | "FULL";
  alert: "LOW_COVERAGE" | null;
}

export interface MetricSlice {
  slice_key: Record<string, string>;
  state: TruthState;
  value?: ExactValue;
  withholding_reason?: WithholdingReason;
  measures: Record<string, string>;
  numerator?: string;
  denominator?: string;
  contributing_count?: string;
  coverage: Coverage;
  compatibility: Record<string, string>;
  exclusions: string[];
  missing_inputs: string[];
  provenance_refs: string[];
  reading?: string;
}

export interface MetricResult {
  metric_id: string;
  metric_version: "2.0.0";
  slices: MetricSlice[];
}

export interface TaskPopulationEntry {
  task_id: string;
  display_name?: string;
  memberships: TaskMembershipReference[];
  cohort_coordinates: Record<string, string>;
  exclusions: string[];
  terminal_reading?: string;
}

export interface TaskMembershipReference {
  delivery_id: string;
  manifest_digest: string;
  accepted_digest: string;
  profile_version: "2.0.0";
  source_identity: string;
  recorded_at: string;
}

export interface EvidenceBinding {
  route: "/v1/evidence/tasks" | "/v1/evidence/facts" | "/v1/evidence/traces";
  canonical_filter: Record<string, string>;
  contract_revision: string;
  observation_profile: string;
  read_model_revision: string;
  route_snapshot: string;
  completion_state: "COMPLETE" | "PARTIAL" | "EXPIRED";
  error_state?: string;
}

export interface InputReference {
  kind: "TASK_MEMBERSHIP" | "FACT" | "TRACE_NODE";
  identity: string;
  provenance_ref: string;
}

export interface WorkflowResolutionAttempt {
  source_id?: string;
  source_index?: number;
  code:
    | "NOT_FOUND"
    | "SOURCE_UNAVAILABLE"
    | "INVALID_DESCRIPTOR"
    | "CHECKSUM_MISMATCH"
    | "INVALID_ARCHIVE"
    | "INVALID_WORKFLOW"
    | "PACKAGE_DIGEST_MISMATCH"
    | "SNAPSHOT_DIGEST_MISMATCH"
    | "ROLE_BINDING_MISMATCH"
    | "DEADLINE_EXCEEDED"
    | "ATTEMPTS_TRUNCATED";
  message?: string;
  omitted_count?: number;
}

export interface WorkflowResolutionEntry {
  manifest_digest: string;
  manifest_projection_digest: string;
  accepted_digest: string;
  profile_version: "2.0.0";
  source_identity: string;
  package_name: string;
  exact_package_version: string;
  package_digest: string;
  workflow_id: string;
  workflow_version: string;
  snapshot_id: string;
  snapshot_digest: string;
  state: "AVAILABLE" | "NOT_FOUND" | "UNAVAILABLE" | "INCOMPATIBLE";
  matched_source_id?: string;
  matched_source_index?: number;
  matched_repository?: string;
  validated_archive_digest?: string;
  validated_package_digest?: string;
  validated_snapshot_digest?: string;
  attempts: WorkflowResolutionAttempt[];
}

export interface ResolvedEvaluationContext {
  context_version: 1;
  selection: EvaluationSelection;
  as_of: string;
  resolved_at: string;
  task_population: TaskPopulationEntry[];
  catalog: {
    catalog_id: "agentops.evaluation.metric-catalog";
    version: "2.0.0";
    semantic_digest: string;
    observation_profile: "1.0.0";
  };
  evidence_bindings: EvidenceBinding[];
  input_refs: InputReference[];
  workflow_resolutions: WorkflowResolutionEntry[];
  population_state: "COMPLETE" | "PARTIAL" | "OPEN" | "MIXED" | "EXPIRED";
}

export interface SideResult {
  tag: "SIDE_RESULT";
  receipt: ResolvedEvaluationContext;
  metric_results: MetricResult[];
}

export interface SideError {
  tag: "SIDE_ERROR";
  code: string;
  retryable: boolean;
  detail: string;
}

export interface DeltaEntry {
  metric_coordinate: string;
  slice_key: Record<string, string>;
  state: "AVAILABLE" | "WITHHELD" | "SIDE_UNRESOLVED";
  value?: ExactValue;
  withholding_reason?: string;
  direction?: "INCREASE" | "DECREASE" | "NO_CHANGE";
}

export interface SingleResponse {
  api_version: 1;
  mode: "SINGLE";
  result: SideResult;
}

export interface CompareResponse {
  api_version: 1;
  mode: "COMPARE";
  status: "FULL_COMPARE" | "PARTIAL_COMPARE";
  left: SideResult | SideError;
  right: SideResult | SideError;
  deltas: DeltaEntry[];
}

export type ComputeResponse = SingleResponse | CompareResponse;

export type EvolutionError =
  | { kind: "INVALID_SELECTION"; reason: string }
  | { kind: "INCOMPATIBLE"; reason: string }
  | {
      kind: "UPSTREAM";
      code: string;
      detail: string;
      retryable: boolean;
      details?: Array<{ path: string; type: string }>;
    }
  | { kind: "ERROR"; reason: "MALFORMED_BODY" | "NETWORK" | "TIMEOUT" }
  | { kind: "RESPONSE_BOUND_EXCEEDED"; maximumBytes: number };

export type EvolutionResult<T = ComputeResponse> =
  { ok: true; value: T } | { ok: false; error: EvolutionError };
