import { closed, oneOf, record } from "../evidence/validation";
import type {
  CompareResponse,
  DeltaEntry,
  EvolutionResult,
  ExactValue,
  MetricResult,
  MetricSlice,
  ResolvedEvaluationContext,
  SideError,
  SideResult,
  SingleResponse,
} from "./types";

export type {
  CompareResponse,
  ComputeResponse,
  EvolutionError,
  EvolutionResult,
  SingleResponse,
} from "./types";

export const CATALOG_COORDINATES = [
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

const CATALOG_DIGEST =
  "851692f9d4a549d21f3c741470737eabb0d40b5f03cf10ffae76e1892023741e";
const MAXIMUM_BODY_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 125_000;
const taskIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;
const decimalPattern = /^(?:0|[1-9][0-9]*|-[1-9][0-9]*)(?:\.[0-9]+)?$/;
const integerPattern = /^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/;
const unsignedIntegerPattern = /^(?:0|[1-9][0-9]*)$/;
const rationalPattern =
  /^(?:0|[1-9][0-9]*|-[1-9][0-9]*|(?:[1-9][0-9]*|-[1-9][0-9]*)\/[1-9][0-9]*)$/;
const digestPattern = /^[a-f0-9]{64}$/;
const prefixedDigestPattern = /^sha256:[a-f0-9]{64}$/;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function incompatible(reason: string): EvolutionResult {
  return { ok: false, error: { kind: "INCOMPATIBLE", reason } };
}

function stringMap(value: unknown): value is Record<string, string> {
  return (
    record(value) &&
    Object.values(value).every((item) => typeof item === "string")
  );
}

function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function canonicalMap(value: Record<string, string>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        bytewiseCompare(left, right),
      ),
    ),
  );
}

function unsigned(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

const utf8Encoder = new TextEncoder();

function bytewiseCompare(left: string, right: string): number {
  const leftBytes = utf8Encoder.encode(left);
  const rightBytes = utf8Encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

function rationalParts(value: string): [bigint, bigint] | undefined {
  if (!rationalPattern.test(value)) return undefined;
  const [numeratorText, denominatorText] = value.split("/");
  const numerator = BigInt(numeratorText!);
  const denominator = BigInt(denominatorText ?? "1");
  if (denominator <= 0n || greatestCommonDivisor(numerator, denominator) !== 1n)
    return undefined;
  return [numerator, denominator];
}

function countRatio(numerator: string, denominator: string): string {
  const divisor = greatestCommonDivisor(BigInt(numerator), BigInt(denominator));
  const reducedNumerator = BigInt(numerator) / divisor;
  const reducedDenominator = BigInt(denominator) / divisor;
  return reducedDenominator === 1n
    ? reducedNumerator.toString()
    : `${reducedNumerator}/${reducedDenominator}`;
}

function selection(value: unknown): boolean {
  return (
    record(value) &&
    closed(value, ["selection_version", "task_ids"]) &&
    value.selection_version === 1 &&
    Array.isArray(value.task_ids) &&
    value.task_ids.length >= 1 &&
    value.task_ids.length <= 24 &&
    value.task_ids.every(
      (item) => typeof item === "string" && taskIdPattern.test(item),
    ) &&
    new Set(value.task_ids).size === value.task_ids.length &&
    value.task_ids.every(
      (item, index, all) =>
        index === 0 || bytewiseCompare(all[index - 1]!, item) < 0,
    )
  );
}

function exactValue(value: unknown): value is ExactValue {
  if (
    !record(value) ||
    !closed(value, ["kind", "value", "unit"], ["precision", "rounding"])
  )
    return false;
  if (
    !oneOf(value.kind, [
      "COUNT",
      "QUANTITY",
      "RATIO",
      "MONEY",
      "DURATION_MS",
      "BOOLEAN",
    ] as const) ||
    typeof value.unit !== "string" ||
    value.unit.length < 1 ||
    value.unit.length > 64
  )
    return false;
  const noDisplayRounding =
    value.precision === undefined && value.rounding === undefined;
  if (value.kind === "RATIO")
    return (
      typeof value.value === "string" &&
      rationalParts(value.value) !== undefined &&
      noDisplayRounding
    );
  if (value.kind === "DURATION_MS")
    return (
      typeof value.value === "string" &&
      rationalParts(value.value) !== undefined &&
      noDisplayRounding
    );
  if (value.kind === "BOOLEAN")
    return typeof value.value === "boolean" && noDisplayRounding;
  return (
    typeof value.value === "string" &&
    integerPattern.test(value.value) &&
    noDisplayRounding
  );
}

function coverage(value: unknown): boolean {
  if (
    !record(value) ||
    !closed(value, ["numerator", "denominator", "raw_ratio", "state", "alert"])
  )
    return false;
  if (
    typeof value.numerator !== "string" ||
    !unsignedIntegerPattern.test(value.numerator) ||
    typeof value.denominator !== "string" ||
    !unsignedIntegerPattern.test(value.denominator) ||
    BigInt(value.numerator) > BigInt(value.denominator)
  )
    return false;
  if (
    !oneOf(value.state, [
      "NO_POPULATION",
      "NO_COVERAGE",
      "PARTIAL",
      "FULL",
    ] as const)
  )
    return false;
  if (value.raw_ratio !== null && typeof value.raw_ratio !== "string")
    return false;
  if (value.alert !== null && value.alert !== "LOW_COVERAGE") return false;
  if (value.denominator === "0")
    return (
      value.state === "NO_POPULATION" &&
      value.raw_ratio === null &&
      value.alert === null
    );
  if (value.raw_ratio === null) return false;
  if (value.raw_ratio !== countRatio(value.numerator, value.denominator))
    return false;
  const expectedState =
    value.numerator === "0"
      ? "NO_COVERAGE"
      : value.numerator === value.denominator
        ? "FULL"
        : "PARTIAL";
  const expectedAlert =
    100n * BigInt(value.numerator) < 10n * BigInt(value.denominator)
      ? "LOW_COVERAGE"
      : null;
  return value.state === expectedState && value.alert === expectedAlert;
}

function metricSlice(value: unknown): value is MetricSlice {
  const required = [
    "slice_key",
    "state",
    "measures",
    "coverage",
    "compatibility",
    "exclusions",
    "missing_inputs",
    "provenance_refs",
  ];
  const optional = [
    "value",
    "withholding_reason",
    "numerator",
    "denominator",
    "contributing_count",
    "reading",
  ];
  if (
    !record(value) ||
    !closed(value, required, optional) ||
    !stringMap(value.slice_key) ||
    !stringMap(value.compatibility)
  )
    return false;
  if (
    !oneOf(value.state, [
      "AVAILABLE",
      "LOWER_BOUND",
      "NOT_APPLICABLE",
      "UNAVAILABLE",
      "EXPIRED",
      "INCOMPATIBLE",
    ] as const)
  )
    return false;
  if (
    !record(value.measures) ||
    !Object.values(value.measures).every(
      (item) => typeof item === "string" && decimalPattern.test(item),
    )
  )
    return false;
  if (
    ![value.numerator, value.denominator, value.contributing_count].every(
      (item) =>
        item === undefined ||
        (typeof item === "string" && unsignedIntegerPattern.test(item)),
    )
  )
    return false;
  if (
    !coverage(value.coverage) ||
    !strings(value.exclusions) ||
    !strings(value.missing_inputs) ||
    !strings(value.provenance_refs)
  )
    return false;
  if (
    value.reading !== undefined &&
    (typeof value.reading !== "string" || value.reading.length > 2048)
  )
    return false;
  const published =
    value.state === "AVAILABLE" || value.state === "LOWER_BOUND";
  return published
    ? exactValue(value.value) && value.withholding_reason === undefined
    : value.value === undefined && typeof value.withholding_reason === "string";
}

function metricResult(value: unknown): value is MetricResult {
  if (!(
    record(value) &&
    closed(value, ["metric_id", "metric_version", "slices"]) &&
    typeof value.metric_id === "string" &&
    value.metric_version === "2.0.0" &&
    Array.isArray(value.slices) &&
    value.slices.length > 0 &&
    value.slices.every(metricSlice)
  ))
    return false;
  const keys = value.slices.map((item) => canonicalMap(item.slice_key));
  return (
    new Set(keys).size === keys.length &&
    (!keys.includes("{}") || keys.length === 1) &&
    keys.every(
      (item, index, all) =>
        index === 0 || bytewiseCompare(all[index - 1]!, item) < 0,
    )
  );
}

function membership(value: unknown): boolean {
  return (
    record(value) &&
    closed(value, [
      "delivery_id",
      "manifest_digest",
      "accepted_digest",
      "profile_version",
      "source_identity",
      "recorded_at",
    ]) &&
    typeof value.delivery_id === "string" &&
    value.delivery_id.length <= 256 &&
    typeof value.manifest_digest === "string" &&
    digestPattern.test(value.manifest_digest) &&
    typeof value.accepted_digest === "string" &&
    digestPattern.test(value.accepted_digest) &&
    value.profile_version === "2.0.0" &&
    typeof value.source_identity === "string" &&
    value.source_identity.length <= 512 &&
    typeof value.recorded_at === "string" &&
    timestampPattern.test(value.recorded_at)
  );
}

function taskPopulation(value: unknown): boolean {
  if (!(
    record(value) &&
    closed(
      value,
      ["task_id", "memberships", "cohort_coordinates", "exclusions"],
      ["display_name", "terminal_reading"],
    ) &&
    typeof value.task_id === "string" &&
    taskIdPattern.test(value.task_id) &&
    (value.display_name === undefined ||
      (typeof value.display_name === "string" &&
        value.display_name.length >= 1 &&
        value.display_name.length <= 160)) &&
    Array.isArray(value.memberships) &&
    value.memberships.every(membership) &&
    stringMap(value.cohort_coordinates) &&
    strings(value.exclusions) &&
    (value.terminal_reading === undefined ||
      typeof value.terminal_reading === "string")
  ))
    return false;
  const deliveryIds = value.memberships.map(
    (item) => (item as { delivery_id: string }).delivery_id,
  );
  return (
    new Set(deliveryIds).size === deliveryIds.length &&
    deliveryIds.every(
      (item, index, all) =>
        index === 0 || bytewiseCompare(all[index - 1]!, item) < 0,
    ) &&
    (deliveryIds.length > 0 ||
      value.exclusions.includes("UNDEFINED_TASK_MEMBERSHIP"))
  );
}

function evidenceBinding(value: unknown): boolean {
  if (
    !record(value) ||
    !closed(
      value,
      [
        "route",
        "canonical_filter",
        "contract_revision",
        "observation_profile",
        "read_model_revision",
        "route_snapshot",
        "completion_state",
      ],
      ["error_state"],
    )
  )
    return false;
  if (
    !oneOf(value.route, [
      "/v1/evidence/tasks",
      "/v1/evidence/facts",
      "/v1/evidence/traces",
    ] as const) ||
    !stringMap(value.canonical_filter)
  )
    return false;
  const coordinates =
    value.route === "/v1/evidence/tasks"
      ? ["1.0.0", "2.0.0", "2.0.0"]
      : ["0.1.0", "1.0.0", "1.0.0"];
  if (
    value.contract_revision !== coordinates[0] ||
    value.observation_profile !== coordinates[1] ||
    value.read_model_revision !== coordinates[2]
  )
    return false;
  if (
    typeof value.route_snapshot !== "string" ||
    value.route_snapshot.length === 0 ||
    !oneOf(value.completion_state, ["COMPLETE", "PARTIAL", "EXPIRED"] as const)
  )
    return false;
  return value.completion_state === "COMPLETE"
    ? value.error_state === undefined
    : typeof value.error_state === "string";
}

function inputReference(value: unknown): boolean {
  return (
    record(value) &&
    closed(value, ["kind", "identity", "provenance_ref"]) &&
    oneOf(value.kind, ["TASK_MEMBERSHIP", "FACT", "TRACE_NODE"] as const) &&
    typeof value.identity === "string" &&
    typeof value.provenance_ref === "string"
  );
}

function resolutionAttempt(value: unknown): boolean {
  if (!(
    record(value) &&
    closed(
      value,
      ["code"],
      ["source_id", "source_index", "message", "omitted_count"],
    ) &&
    oneOf(value.code, [
      "NOT_FOUND",
      "SOURCE_UNAVAILABLE",
      "INVALID_DESCRIPTOR",
      "CHECKSUM_MISMATCH",
      "INVALID_ARCHIVE",
      "INVALID_WORKFLOW",
      "PACKAGE_DIGEST_MISMATCH",
      "SNAPSHOT_DIGEST_MISMATCH",
      "ROLE_BINDING_MISMATCH",
      "DEADLINE_EXCEEDED",
      "ATTEMPTS_TRUNCATED",
    ] as const) &&
    (value.source_id === undefined || typeof value.source_id === "string") &&
    (value.source_index === undefined ||
      (unsigned(value.source_index) && value.source_index <= 7)) &&
    (value.message === undefined ||
      (typeof value.message === "string" && value.message.length <= 160)) &&
    (value.omitted_count === undefined || unsigned(value.omitted_count))
  ))
    return false;
  const resolverLevel =
    value.code === "DEADLINE_EXCEEDED" || value.code === "ATTEMPTS_TRUNCATED";
  const hasSource =
    value.source_id !== undefined || value.source_index !== undefined;
  return (
    resolverLevel !== hasSource &&
    (value.code === "ATTEMPTS_TRUNCATED") ===
      (value.omitted_count !== undefined) &&
    (value.code !== "ATTEMPTS_TRUNCATED" || value.omitted_count === 2)
  );
}

function workflowResolution(value: unknown): boolean {
  const required = [
    "manifest_digest",
    "manifest_projection_digest",
    "accepted_digest",
    "profile_version",
    "source_identity",
    "package_name",
    "exact_package_version",
    "package_digest",
    "workflow_id",
    "workflow_version",
    "snapshot_id",
    "snapshot_digest",
    "state",
    "attempts",
  ];
  const optional = [
    "matched_source_id",
    "matched_source_index",
    "matched_repository",
    "validated_archive_digest",
    "validated_package_digest",
    "validated_snapshot_digest",
  ];
  if (!record(value) || !closed(value, required, optional)) return false;
  if (!(
    [
      value.manifest_digest,
      value.manifest_projection_digest,
      value.accepted_digest,
    ].every((item) => typeof item === "string" && digestPattern.test(item)) &&
    value.profile_version === "2.0.0" &&
    [
      value.source_identity,
      value.package_name,
      value.exact_package_version,
      value.workflow_id,
      value.workflow_version,
      value.snapshot_id,
    ].every((item) => typeof item === "string" && item.length > 0) &&
    typeof value.package_digest === "string" &&
    prefixedDigestPattern.test(value.package_digest) &&
    typeof value.snapshot_digest === "string" &&
    prefixedDigestPattern.test(value.snapshot_digest) &&
    oneOf(value.state, [
      "AVAILABLE",
      "NOT_FOUND",
      "UNAVAILABLE",
      "INCOMPATIBLE",
    ] as const) &&
    Array.isArray(value.attempts) &&
    value.attempts.length <= 8 &&
    value.attempts.every(resolutionAttempt)
  ))
    return false;
  const matched = [
    value.matched_source_id,
    value.matched_source_index,
    value.matched_repository,
    value.validated_archive_digest,
    value.validated_package_digest,
    value.validated_snapshot_digest,
  ];
  if (
    (value.matched_source_id !== undefined &&
      (typeof value.matched_source_id !== "string" ||
        value.matched_source_id.length < 1 ||
        value.matched_source_id.length > 128)) ||
    (value.matched_source_index !== undefined &&
      (!unsigned(value.matched_source_index) ||
        value.matched_source_index > 7)) ||
    (value.matched_repository !== undefined &&
      (typeof value.matched_repository !== "string" ||
        value.matched_repository.length < 3 ||
        value.matched_repository.length > 201)) ||
    ![
      value.validated_archive_digest,
      value.validated_package_digest,
      value.validated_snapshot_digest,
    ].every(
      (item) =>
        item === undefined ||
        (typeof item === "string" && prefixedDigestPattern.test(item)),
    )
  )
    return false;
  return value.state === "AVAILABLE"
    ? matched.every((item) => item !== undefined) &&
        value.validated_package_digest === value.package_digest &&
        value.validated_snapshot_digest === value.snapshot_digest
    : matched.every((item) => item === undefined);
}

function receipt(value: unknown): value is ResolvedEvaluationContext {
  if (
    !record(value) ||
    !closed(value, [
      "context_version",
      "selection",
      "as_of",
      "resolved_at",
      "task_population",
      "catalog",
      "evidence_bindings",
      "input_refs",
      "workflow_resolutions",
      "population_state",
    ])
  )
    return false;
  if (
    value.context_version !== 1 ||
    !selection(value.selection) ||
    typeof value.as_of !== "string" ||
    !timestampPattern.test(value.as_of) ||
    typeof value.resolved_at !== "string" ||
    !timestampPattern.test(value.resolved_at)
  )
    return false;
  if (
    !Array.isArray(value.task_population) ||
    !value.task_population.every(taskPopulation) ||
    !Array.isArray(value.evidence_bindings) ||
    !value.evidence_bindings.every(evidenceBinding) ||
    !Array.isArray(value.input_refs) ||
    !value.input_refs.every(inputReference) ||
    !Array.isArray(value.workflow_resolutions) ||
    !value.workflow_resolutions.every(workflowResolution)
  )
    return false;
  if (
    !record(value.catalog) ||
    !closed(value.catalog, [
      "catalog_id",
      "version",
      "semantic_digest",
      "observation_profile",
    ]) ||
    value.catalog.catalog_id !== "agentops.evaluation.metric-catalog" ||
    value.catalog.version !== "2.0.0" ||
    value.catalog.semantic_digest !== CATALOG_DIGEST ||
    value.catalog.observation_profile !== "1.0.0"
  )
    return false;
  if (
    !oneOf(value.population_state, [
      "COMPLETE",
      "PARTIAL",
      "OPEN",
      "MIXED",
      "EXPIRED",
    ] as const)
  )
    return false;
  const selectedTaskIds = (value.selection as { task_ids: string[] }).task_ids;
  const population = value.task_population as Array<{
    task_id: string;
    memberships: Array<{
      manifest_digest: string;
      recorded_at: string;
    }>;
  }>;
  const populationTaskIds = population.map((item) => item.task_id);
  const bindings = value.evidence_bindings as Array<{
    route: string;
    canonical_filter: Record<string, string>;
    completion_state: string;
  }>;
  const bindingKeys = bindings.map(
    (item) => `${item.route}\u0000${canonicalMap(item.canonical_filter)}`,
  );
  const taskBindings = bindings.filter(
    (item) => item.route === "/v1/evidence/tasks",
  );
  const references = value.input_refs as Array<{
    kind: string;
    identity: string;
  }>;
  const referenceKeys = references.map(
    (item) => `${item.kind}\u0000${item.identity}`,
  );
  const membershipManifests = new Set(
    population.flatMap((task) =>
      task.memberships.map((membership) => membership.manifest_digest),
    ),
  );
  const resolutionManifests = (
    value.workflow_resolutions as Array<{ manifest_digest: string }>
  ).map((item) => item.manifest_digest);
  return (
    new Set(populationTaskIds).size === populationTaskIds.length &&
    selectedTaskIds.length === populationTaskIds.length &&
    selectedTaskIds.every((item, index) => populationTaskIds[index] === item) &&
    new Set(bindingKeys).size === bindingKeys.length &&
    taskBindings.length === selectedTaskIds.length &&
    taskBindings.every(
      (item) =>
        Object.keys(item.canonical_filter).length === 2 &&
        item.canonical_filter.task_id !== undefined &&
        selectedTaskIds.includes(item.canonical_filter.task_id) &&
        item.canonical_filter.as_of === value.as_of,
    ) &&
    new Set(taskBindings.map((item) => item.canonical_filter.task_id)).size ===
      selectedTaskIds.length &&
    (value.population_state !== "COMPLETE" ||
      (taskBindings.every((item) => item.completion_state === "COMPLETE") &&
        population.every((item) => item.memberships.length > 0))) &&
    population.every((item) =>
      item.memberships.every(
        (membership) =>
          Date.parse(membership.recorded_at) <=
          Date.parse(value.as_of as string),
      ),
    ) &&
    new Set(referenceKeys).size === referenceKeys.length &&
    new Set(resolutionManifests).size === resolutionManifests.length &&
    resolutionManifests.length === membershipManifests.size &&
    resolutionManifests.every((item) => membershipManifests.has(item))
  );
}

function sideResult(value: unknown): value is SideResult {
  if (
    !record(value) ||
    !closed(value, ["tag", "receipt", "metric_results"]) ||
    value.tag !== "SIDE_RESULT" ||
    !receipt(value.receipt) ||
    !Array.isArray(value.metric_results) ||
    !value.metric_results.every(metricResult)
  )
    return false;
  const coordinates = value.metric_results.map(
    (item) => `${item.metric_id}@${item.metric_version}`,
  );
  return (
    coordinates.length === CATALOG_COORDINATES.length &&
    coordinates.every((item, index) => item === CATALOG_COORDINATES[index])
  );
}

function sideError(value: unknown): value is SideError {
  return (
    record(value) &&
    closed(value, ["tag", "code", "retryable", "detail"]) &&
    value.tag === "SIDE_ERROR" &&
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.retryable === "boolean" &&
    typeof value.detail === "string" &&
    value.detail.length > 0
  );
}

function delta(value: unknown): value is DeltaEntry {
  if (
    !record(value) ||
    !closed(
      value,
      ["metric_coordinate", "slice_key", "state"],
      ["value", "withholding_reason", "direction"],
    ) ||
    typeof value.metric_coordinate !== "string" ||
    !CATALOG_COORDINATES.includes(
      value.metric_coordinate as (typeof CATALOG_COORDINATES)[number],
    ) ||
    !stringMap(value.slice_key) ||
    !oneOf(value.state, ["AVAILABLE", "WITHHELD", "SIDE_UNRESOLVED"] as const)
  )
    return false;
  if (value.state === "AVAILABLE")
    if (
      exactValue(value.value) &&
      value.value.kind !== "BOOLEAN" &&
      value.withholding_reason === undefined &&
      oneOf(value.direction, ["INCREASE", "DECREASE", "NO_CHANGE"] as const)
    ) {
      const sign =
        typeof value.value.value === "string"
          ? Number(rationalParts(value.value.value)?.[0] ?? 0n)
          : 0;
      const expected =
        sign > 0 ? "INCREASE" : sign < 0 ? "DECREASE" : "NO_CHANGE";
      return value.direction === expected;
    } else return false;
  return (
    value.value === undefined &&
    value.direction === undefined &&
    (value.state === "SIDE_UNRESOLVED" ||
      typeof value.withholding_reason === "string")
  );
}

function sliceIdentity(metric: MetricResult, slice: MetricSlice): string {
  return `${metric.metric_id}@${metric.metric_version}\u0000${canonicalMap(slice.slice_key)}`;
}

function sideSlices(side: SideResult): Map<string, MetricSlice> {
  return new Map(
    side.metric_results.flatMap((metric) =>
      metric.slices.map(
        (slice) => [sliceIdentity(metric, slice), slice] as const,
      ),
    ),
  );
}

function compareDeltas(
  status: "FULL_COMPARE" | "PARTIAL_COMPARE",
  left: SideResult | SideError,
  right: SideResult | SideError,
  deltas: DeltaEntry[],
): boolean {
  const resultSides = [left, right].filter(sideResult);
  const sliceMaps = resultSides.map(sideSlices);
  const expected = new Set(sliceMaps.flatMap((items) => [...items.keys()]));
  const actual = deltas.map(
    (item) => `${item.metric_coordinate}\u0000${canonicalMap(item.slice_key)}`,
  );
  if (
    new Set(actual).size !== actual.length ||
    actual.length !== expected.size ||
    actual.some((item) => !expected.has(item))
  )
    return false;
  if (status === "PARTIAL_COMPARE")
    return (
      resultSides.length === 1 &&
      deltas.every((item) => item.state === "SIDE_UNRESOLVED")
    );
  if (
    resultSides.length !== 2 ||
    deltas.some((item) => item.state === "SIDE_UNRESOLVED")
  )
    return false;
  for (let index = 0; index < deltas.length; index += 1) {
    const item = deltas[index]!;
    const key = actual[index]!;
    const before = sliceMaps[0]!.get(key);
    const after = sliceMaps[1]!.get(key);
    const compatible =
      before !== undefined &&
      after !== undefined &&
      before.state === "AVAILABLE" &&
      after.state === "AVAILABLE" &&
      before.value !== undefined &&
      after.value !== undefined &&
      before.value.kind === after.value.kind &&
      before.value.unit === after.value.unit &&
      canonicalMap(before.compatibility) === canonicalMap(after.compatibility);
    if ((item.state === "AVAILABLE") !== compatible) return false;
    if (
      compatible &&
      (item.value === undefined ||
        item.value.kind !== before.value?.kind ||
        item.value.unit !== before.value.unit)
    )
      return false;
  }
  return true;
}

function upstreamError(
  input: Record<string, unknown>,
): EvolutionResult | undefined {
  if (!Object.hasOwn(input, "error")) return undefined;
  if (
    !closed(input, ["error"]) ||
    !record(input.error) ||
    !closed(input.error, ["code", "retryable", "detail"], ["details"]) ||
    typeof input.error.code !== "string" ||
    typeof input.error.retryable !== "boolean" ||
    typeof input.error.detail !== "string"
  )
    return incompatible("invalid Evolution error response");
  const details = input.error.details;
  if (
    details !== undefined &&
    (!Array.isArray(details) ||
      details.length > 16 ||
      !details.every(
        (item) =>
          record(item) &&
          closed(item, ["path", "type"]) &&
          typeof item.path === "string" &&
          typeof item.type === "string",
      ))
  )
    return incompatible("invalid Evolution error details");
  return {
    ok: false,
    error: {
      kind: "UPSTREAM",
      code: input.error.code,
      retryable: input.error.retryable,
      detail: input.error.detail,
      ...(details === undefined
        ? {}
        : { details: details as Array<{ path: string; type: string }> }),
    },
  };
}

export function decodeComputeResponse(input: unknown): EvolutionResult {
  if (!record(input)) return incompatible("response must be an object");
  const error = upstreamError(input);
  if (error) return error;
  if (input.mode === "SINGLE") {
    if (
      !closed(input, ["api_version", "mode", "result"]) ||
      input.api_version !== 1 ||
      !sideResult(input.result)
    )
      return incompatible("invalid single response");
    return { ok: true, value: input as unknown as SingleResponse };
  }
  if (input.mode === "COMPARE") {
    if (
      !closed(input, [
        "api_version",
        "mode",
        "status",
        "left",
        "right",
        "deltas",
      ]) ||
      input.api_version !== 1 ||
      !oneOf(input.status, ["FULL_COMPARE", "PARTIAL_COMPARE"] as const) ||
      !(sideResult(input.left) || sideError(input.left)) ||
      !(sideResult(input.right) || sideError(input.right)) ||
      !Array.isArray(input.deltas) ||
      !input.deltas.every(delta)
    )
      return incompatible("invalid compare response");
    if (
      !compareDeltas(
        input.status,
        input.left as SideResult | SideError,
        input.right as SideResult | SideError,
        input.deltas as DeltaEntry[],
      )
    )
      return incompatible("compare status does not match side outcomes");
    return { ok: true, value: input as unknown as CompareResponse };
  }
  return incompatible("unsupported compute mode");
}

export interface EvolutionClientOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maximumBodyBytes?: number;
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<EvolutionResult<Uint8Array>> {
  const reader = response.body?.getReader();
  if (reader === undefined) return { ok: true, value: new Uint8Array() };
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel(
          "Evolution response exceeded configured byte bound",
        );
        return {
          ok: false,
          error: { kind: "RESPONSE_BOUND_EXCEEDED", maximumBytes },
        };
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: bytes };
}

function makeSelection(
  taskIds: readonly string[],
): EvolutionResult<{ selection_version: 1; task_ids: string[] }> {
  if (
    taskIds.length < 1 ||
    taskIds.length > 24 ||
    new Set(taskIds).size !== taskIds.length ||
    !taskIds.every((item) => taskIdPattern.test(item))
  )
    return {
      ok: false,
      error: {
        kind: "INVALID_SELECTION",
        reason: "selection requires 1-24 unique valid Task IDs",
      },
    };
  return {
    ok: true,
    value: {
      selection_version: 1,
      task_ids: [...taskIds].sort(bytewiseCompare),
    },
  };
}

export class EvolutionClient {
  readonly #fetcher: typeof fetch;
  readonly #timeoutMs: number;
  readonly #maximumBodyBytes: number;

  constructor(options: EvolutionClientOptions = {}) {
    this.#fetcher = options.fetcher ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maximumBodyBytes = options.maximumBodyBytes ?? MAXIMUM_BODY_BYTES;
  }

  async computeSingle(taskIds: readonly string[]): Promise<EvolutionResult> {
    const selected = makeSelection(taskIds);
    if (!selected.ok) return selected;
    return this.#post({
      api_version: 1,
      mode: "SINGLE",
      selection: selected.value,
    });
  }

  async computeCompare(
    leftTaskIds: readonly string[],
    rightTaskIds: readonly string[],
  ): Promise<EvolutionResult> {
    const left = makeSelection(leftTaskIds);
    if (!left.ok) return left;
    const right = makeSelection(rightTaskIds);
    if (!right.ok) return right;
    return this.#post({
      api_version: 1,
      mode: "COMPARE",
      left: left.value,
      right: right.value,
    });
  }

  async #post(body: object): Promise<EvolutionResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetcher(
        "/api/evolution/v1/evaluations:compute",
        {
          method: "POST",
          credentials: "omit",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      const contentType = response.headers.get("content-type");
      if (
        contentType === null ||
        !/^application\/json(?:\s*;|$)/i.test(contentType)
      )
        return incompatible(
          "Evolution response content type is not application/json",
        );
      const declaredLength = response.headers.get("content-length");
      if (
        declaredLength !== null &&
        /^[0-9]+$/.test(declaredLength) &&
        BigInt(declaredLength) > BigInt(this.#maximumBodyBytes)
      )
        return {
          ok: false,
          error: {
            kind: "RESPONSE_BOUND_EXCEEDED",
            maximumBytes: this.#maximumBodyBytes,
          },
        };
      const bounded = await readBoundedBody(response, this.#maximumBodyBytes);
      if (!bounded.ok) return bounded;
      let decoded: unknown;
      try {
        decoded = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bounded.value),
        );
      } catch {
        return {
          ok: false,
          error: { kind: "ERROR", reason: "MALFORMED_BODY" },
        };
      }
      const result = decodeComputeResponse(decoded);
      if (response.ok !== result.ok)
        return incompatible(
          "Evolution HTTP status and response envelope disagree",
        );
      return result;
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ERROR",
          reason:
            error instanceof DOMException && error.name === "AbortError"
              ? "TIMEOUT"
              : "NETWORK",
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
