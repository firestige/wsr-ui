import type { MetricResult } from "./types";

const truthStates = new Set([
  "AVAILABLE",
  "LOWER_BOUND",
  "NOT_APPLICABLE",
  "UNAVAILABLE",
  "EXPIRED",
  "INCOMPATIBLE",
]);
const valueKinds = new Set([
  "COUNT",
  "QUANTITY",
  "RATIO",
  "MONEY",
  "DURATION_MS",
  "BOOLEAN",
]);
const withholdingReasons = new Set([
  "SAMPLE_INSUFFICIENT",
  "MISSING_INPUT",
  "NO_APPLICABLE_POPULATION",
  "OPEN_TASK",
  "MIXED_TASK_OUTCOMES",
  "EXPIRED_INPUT",
  "INCOMPATIBLE_INPUT",
]);
const coverageStates = new Set([
  "NO_POPULATION",
  "NO_COVERAGE",
  "PARTIAL",
  "FULL",
]);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function isMetricResult(value: unknown): value is MetricResult {
  if (
    !record(value) ||
    typeof value.metric_id !== "string" ||
    value.metric_id.length === 0 ||
    value.metric_version !== "2.0.0" ||
    !Array.isArray(value.slices)
  )
    return false;
  return value.slices.every((slice) => {
    const coverageValid =
      slice !== null &&
      typeof slice === "object" &&
      (slice.coverage === null ||
        (record(slice.coverage) &&
          typeof slice.coverage.numerator === "string" &&
          typeof slice.coverage.denominator === "string" &&
          (slice.coverage.raw_ratio === null ||
            typeof slice.coverage.raw_ratio === "string") &&
          typeof slice.coverage.state === "string" &&
          coverageStates.has(slice.coverage.state) &&
          (slice.coverage.alert === null ||
            slice.coverage.alert === "LOW_COVERAGE")));
    if (
      !record(slice) ||
      !record(slice.slice_key) ||
      typeof slice.state !== "string" ||
      !truthStates.has(slice.state) ||
      !record(slice.measures) ||
      !record(slice.compatibility) ||
      !stringArray(slice.exclusions) ||
      !stringArray(slice.missing_inputs) ||
      !stringArray(slice.provenance_refs) ||
      !coverageValid ||
      !(slice.numerator === undefined || typeof slice.numerator === "string") ||
      !(
        slice.denominator === undefined || typeof slice.denominator === "string"
      ) ||
      !(
        slice.contributing_count === undefined ||
        typeof slice.contributing_count === "string"
      ) ||
      !(slice.reading === undefined || typeof slice.reading === "string")
    )
      return false;
    if (slice.value === undefined)
      return (
        typeof slice.withholding_reason === "string" &&
        withholdingReasons.has(slice.withholding_reason)
      );
    if (
      !record(slice.value) ||
      typeof slice.value.kind !== "string" ||
      !valueKinds.has(slice.value.kind) ||
      typeof slice.value.unit !== "string"
    )
      return false;
    if (slice.value.kind === "BOOLEAN")
      return typeof slice.value.value === "boolean";
    if (typeof slice.value.value !== "string") return false;
    if (slice.value.kind === "RATIO")
      return /^-?(?:0|[1-9][0-9]*)(?:\/[1-9][0-9]*)?$/u.test(slice.value.value);
    return (
      /^-?(?:0|[1-9][0-9]*)$/u.test(slice.value.value) ||
      slice.value.kind === "MONEY" ||
      slice.value.kind === "QUANTITY"
    );
  });
}
