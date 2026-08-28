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
