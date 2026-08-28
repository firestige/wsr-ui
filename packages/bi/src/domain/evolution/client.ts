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
