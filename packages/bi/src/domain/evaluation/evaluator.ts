import {
  CATALOG_COORDINATE,
  CATALOG_DIGEST,
  METRIC_BINDINGS,
  type MetricBinding,
} from "./catalog-binding";

export interface EvaluationUnit {
  id: string;
  availableInputs: string[];
  compatible: boolean;
  eligible: boolean;
  numerator: boolean;
  numericValue: number | null;
  category?: string;
  coordinates: Record<string, string | number | boolean | null>;
  factIds: string[];
  acceptedDigests: string[];
  exclusions: string[];
}

export interface EvaluationRequest {
  metricId: string;
  snapshot: string;
  scope: {
    asOf: string;
    window: string;
    cohort?: string;
    dimensions?: Record<string, string>;
  };
  units: EvaluationUnit[];
  contextId?: string;
  contextDigest?: string;
}

type CoverageState = "NO_POPULATION" | "NO_COVERAGE" | "PARTIAL" | "FULL";
type ValueState = "AVAILABLE" | "SAMPLE_INSUFFICIENT";

export interface EvaluationSeries {
  key: string;
  coordinates: Record<string, string | number | boolean | null>;
  exactValue: number;
  numerator?: number;
  denominator?: number;
  contributingCount: number;
}

export interface EvaluationResult {
  metric: {
    id: string;
    version: "1.0.0";
    catalogCoordinate: string;
    catalogDigest: string;
  };
  scope: EvaluationRequest["scope"];
  value: {
    state: ValueState;
    kind: string;
    unit: string;
    exactValue: number | null;
    numerator: number | null;
    denominator: number | null;
    contributingCount: number;
  };
  series: EvaluationSeries[];
  coverage: {
    numerator: number;
    denominator: number;
    rawRatio: number | null;
    state: CoverageState;
    alert: boolean;
  };
  truth: {
    missingInputs: string[];
    exclusions: string[];
  };
  provenance: {
    factIds: string[];
    acceptedDigests: string[];
    snapshot: string;
    contextId?: string;
    contextDigest?: string;
  };
  reading: {
    uncertainty: string[];
    forbiddenInference: readonly string[];
  };
  resultDigest: string;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isCovered(unit: EvaluationUnit, binding: MetricBinding) {
  return (
    unit.compatible &&
    binding.inputRefs.every((input) => unit.availableInputs.includes(input))
  );
}

function coordinatesKey(unit: EvaluationUnit) {
  return canonical({ ...unit.coordinates, category: unit.category });
}

function computeSeries(
  binding: MetricBinding,
  units: EvaluationUnit[],
): EvaluationSeries[] {
  const groups = new Map<string, EvaluationUnit[]>();
  for (const unit of units) {
    const key = coordinatesKey(unit);
    groups.set(key, [...(groups.get(key) ?? []), unit]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, group]) => {
      const numeric = group
        .map((unit) => unit.numericValue)
        .filter(
          (value): value is number =>
            typeof value === "number" && Number.isFinite(value),
        );
      const numerator = group.filter((unit) => unit.numerator).length;
      let exactValue: number;
      if (binding.formula === "SUM")
        exactValue = numeric.reduce((total, value) => total + value, 0);
      else if (binding.formula === "AVERAGE") {
        exactValue =
          numeric.reduce((total, value) => total + value, 0) / numeric.length;
      } else exactValue = numerator / group.length;
      return {
        key,
        coordinates: group[0]?.coordinates ?? {},
        exactValue,
        ...(binding.formula === "RATE" || binding.formula === "CATEGORICAL_RATE"
          ? { numerator, denominator: group.length }
          : {}),
        contributingCount:
          binding.formula === "SUM" || binding.formula === "AVERAGE"
            ? numeric.length
            : group.length,
      };
    });
}

export async function evaluateMetric(
  request: EvaluationRequest,
): Promise<EvaluationResult> {
  const binding = METRIC_BINDINGS[request.metricId];
  if (!binding)
    throw new Error(
      `Metric is not bound to ${CATALOG_COORDINATE}: ${request.metricId}`,
    );

  const covered = request.units.filter((unit) => isCovered(unit, binding));
  const eligible = covered.filter((unit) => unit.eligible);
  const coverageDenominator = request.units.length;
  const coverageNumerator = covered.length;
  const coverageState: CoverageState =
    coverageDenominator === 0
      ? "NO_POPULATION"
      : coverageNumerator === 0
        ? "NO_COVERAGE"
        : coverageNumerator === coverageDenominator
          ? "FULL"
          : "PARTIAL";
  const sampleSufficient = eligible.length >= binding.minimumSample;
  const series = sampleSufficient ? computeSeries(binding, eligible) : [];
  const singleSeries = series.length === 1 ? series[0] : undefined;
  const allAvailable = new Set(
    request.units.flatMap((unit) => unit.availableInputs),
  );

  const withoutDigest = {
    metric: {
      id: binding.id,
      version: binding.version,
      catalogCoordinate: CATALOG_COORDINATE,
      catalogDigest: CATALOG_DIGEST,
    },
    scope: request.scope,
    value: {
      state: sampleSufficient
        ? ("AVAILABLE" as const)
        : ("SAMPLE_INSUFFICIENT" as const),
      kind: binding.kind,
      unit: binding.unit,
      exactValue: singleSeries?.exactValue ?? null,
      numerator: singleSeries?.numerator ?? null,
      denominator: singleSeries?.denominator ?? null,
      contributingCount: singleSeries?.contributingCount ?? eligible.length,
    },
    series,
    coverage: {
      numerator: coverageNumerator,
      denominator: coverageDenominator,
      rawRatio:
        coverageDenominator === 0
          ? null
          : coverageNumerator / coverageDenominator,
      state: coverageState,
      alert: coverageState !== "FULL",
    },
    truth: {
      missingInputs: binding.inputRefs
        .filter((input) => !allAvailable.has(input))
        .sort(),
      exclusions: uniqueSorted(
        request.units.flatMap((unit) => unit.exclusions),
      ),
    },
    provenance: {
      factIds: uniqueSorted(request.units.flatMap((unit) => unit.factIds)),
      acceptedDigests: uniqueSorted(
        request.units.flatMap((unit) => unit.acceptedDigests),
      ),
      snapshot: request.snapshot,
      ...(request.contextId === undefined
        ? {}
        : { contextId: request.contextId }),
      ...(request.contextDigest === undefined
        ? {}
        : { contextDigest: request.contextDigest }),
    },
    reading: {
      uncertainty: coverageState === "FULL" ? [] : ["coverage is incomplete"],
      forbiddenInference: binding.forbiddenInference,
    },
  };

  return { ...withoutDigest, resultDigest: await sha256(withoutDigest) };
}
