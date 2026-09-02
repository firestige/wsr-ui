import type { MetricResult, MetricSlice } from "../public";
import { PRESET_LAYOUTS, type DashboardLayout } from "../domain/layout/layout";

const fullCoverage: MetricSlice["coverage"] = {
  alert: null,
  denominator: "12",
  numerator: "12",
  raw_ratio: "1",
  state: "FULL",
};

function availableSlice(
  value: NonNullable<MetricSlice["value"]>,
  sliceKey: Record<string, string> = {},
): MetricSlice {
  const [numerator, denominator] =
    value.kind === "RATIO" ? value.value.split("/") : [];
  return {
    compatibility: {},
    coverage: fullCoverage,
    denominator,
    exclusions: [],
    measures: {},
    missing_inputs: [],
    numerator,
    provenance_refs: ["fixture:dashboard"],
    reading: "Exact recorded fixture value",
    slice_key: sliceKey,
    state: "AVAILABLE",
    value,
  };
}

function result(
  metricId: MetricResult["metric_id"],
  slices: MetricSlice[],
): MetricResult {
  return { metric_id: metricId, metric_version: "2.0.0", slices };
}

const preset = PRESET_LAYOUTS["default-overview@1"];

export const dashboardLayout: DashboardLayout = {
  ...preset,
  panels: preset.panels.map((panel) => ({
    ...panel,
    channels: { ...panel.channels },
    transforms: [...panel.transforms],
  })),
};

export const dashboardResults: MetricResult[] = [
  result("role-template-rework-rate", [
    availableSlice({ kind: "RATIO", unit: "ratio", value: "2/7" }),
  ]),
  result("role-model-task-outcome-rate", [
    availableSlice({ kind: "RATIO", unit: "ratio", value: "5/6" }),
  ]),
  result("operational-latency-ms", [
    availableSlice({ kind: "DURATION_MS", unit: "ms", value: "1840" }),
  ]),
  result("delivery-stage-reach", [
    availableSlice(
      { kind: "RATIO", unit: "ratio", value: "12/12" },
      { stage: "accepted" },
    ),
    availableSlice(
      { kind: "RATIO", unit: "ratio", value: "10/12" },
      { stage: "verified" },
    ),
    availableSlice(
      { kind: "RATIO", unit: "ratio", value: "9/12" },
      { stage: "released" },
    ),
  ]),
  result("delivery-terminal-outcome-rate", [
    availableSlice({ kind: "RATIO", unit: "ratio", value: "9/10" }),
  ]),
  result("operational-token-usage", [
    availableSlice(
      { kind: "COUNT", unit: "tokens", value: "48620" },
      { direction: "input" },
    ),
    availableSlice(
      { kind: "COUNT", unit: "tokens", value: "12340" },
      { direction: "output" },
    ),
  ]),
];
