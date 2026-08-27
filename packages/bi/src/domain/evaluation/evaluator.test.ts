import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CATALOG_DIGEST, METRIC_BINDINGS } from "./catalog-binding";
import { evaluateMetric, type EvaluationUnit } from "./evaluator";

const expected = [
  ["role-template-rework-rate", 20, "rate", "ratio"],
  ["role-template-trajectory-partial-cost", 20, "money", "source currency"],
  ["role-model-task-outcome-rate", 20, "rate", "ratio"],
  ["packet-rework-rate", 1, "rate", "ratio"],
  ["operational-latency-ms", 1, "duration", "milliseconds"],
  ["trajectory-partial-cost", 20, "money", "source currency"],
  ["task-cohort-comparison-eligibility", 20, "rate", "ratio"],
  ["delivery-stage-reach", 1, "rate", "ratio"],
  ["delivery-terminal-outcome-rate", 1, "rate", "ratio"],
  ["delivery-cycle-time-ms", 1, "duration", "milliseconds"],
  ["operational-token-usage", 1, "quantity", "tokens"],
  ["operational-attributable-cost", 1, "money", "source currency"],
  ["operational-usage-availability", 1, "rate", "ratio"],
  ["direct-evidence-basis-rate", 1, "rate", "ratio"],
] as const;

const catalogOracle = readFileSync(
  resolve("packages/bi/src/test/fixtures/metric-catalog-oracle.ndjson"),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

function units(
  metricId: string,
  count: number,
  update: Partial<EvaluationUnit> = {},
) {
  const binding = METRIC_BINDINGS[metricId];
  if (!binding) throw new Error(`missing test binding ${metricId}`);
  return Array.from({ length: count }, (_, index): EvaluationUnit => ({
    id: `unit-${String(index).padStart(2, "0")}`,
    availableInputs: [...binding.inputRefs],
    compatible: true,
    eligible: true,
    numerator: true,
    numericValue: 1,
    coordinates: { cohort: "alpha" },
    factIds: [`fact-${String(index).padStart(2, "0")}`],
    acceptedDigests: [String(index).padStart(64, "0")],
    exclusions: [],
    ...update,
  }));
}

describe("published catalog binding", () => {
  it("binds the exact catalog digest and all 14 metrics", () => {
    expect(CATALOG_DIGEST).toBe(
      "sha256:6dbb4375507a3a2eebbe5e86bb6f0a40ebf811790f55ee841b15c6942e1f159d",
    );
    expect(
      Object.values(METRIC_BINDINGS).map((binding) => [
        binding.id,
        binding.minimumSample,
        binding.kind,
        binding.unit,
      ]),
    ).toEqual(expected);
    expect(
      Object.values(METRIC_BINDINGS).every(
        (binding) => binding.version === "1.0.0",
      ),
    ).toBe(true);
    expect(
      Object.values(METRIC_BINDINGS).every(
        (binding) => binding.inputRefs.length > 0,
      ),
    ).toBe(true);
  });

  it("matches every exact published golden row", () => {
    expect(catalogOracle).toHaveLength(14);
    for (const row of catalogOracle) {
      const binding = METRIC_BINDINGS[row.metric_id];
      expect(binding, row.metric_id).toBeDefined();
      expect(binding).toMatchObject({
        id: row.metric_id,
        version: row.version,
        inputRefs: row.input_refs,
        minimumSample: row.minimum_sample,
        kind: row.value_semantics.kind,
        unit: row.value_semantics.unit,
        forbiddenInference: row.forbidden_inference,
      });
    }
  });
});

describe("catalog-bound evaluator", () => {
  it("withholds a role metric below its minimum sample while retaining coverage", async () => {
    const result = await evaluateMetric({
      metricId: "role-template-rework-rate",
      snapshot: "snapshot-1",
      scope: { asOf: "2026-01-01T00:00:00.000000Z", window: "P7D" },
      units: units("role-template-rework-rate", 19),
    });

    expect(result.value).toMatchObject({
      state: "SAMPLE_INSUFFICIENT",
      exactValue: null,
    });
    expect(result.coverage).toEqual({
      numerator: 19,
      denominator: 19,
      rawRatio: 1,
      state: "FULL",
      alert: false,
    });
  });

  it("keeps an explicit covered zero distinct from missing repair input", async () => {
    const coveredZero = units("packet-rework-rate", 1, { numerator: false });
    const zeroResult = await evaluateMetric({
      metricId: "packet-rework-rate",
      snapshot: "snapshot-1",
      scope: { asOf: "2026-01-01T00:00:00.000000Z", window: "P7D" },
      units: coveredZero,
    });
    const missing = units("packet-rework-rate", 1, { numerator: false });
    missing[0]!.availableInputs = missing[0]!.availableInputs.filter(
      (input) => input !== "observation.repair-link",
    );
    const missingResult = await evaluateMetric({
      metricId: "packet-rework-rate",
      snapshot: "snapshot-1",
      scope: { asOf: "2026-01-01T00:00:00.000000Z", window: "P7D" },
      units: missing,
    });

    expect(zeroResult.value).toMatchObject({
      state: "AVAILABLE",
      exactValue: 0,
    });
    expect(missingResult.value).toMatchObject({
      state: "SAMPLE_INSUFFICIENT",
      exactValue: null,
    });
    expect(missingResult.coverage.state).toBe("NO_COVERAGE");
  });

  it("averages native latency and never substitutes absent duration", async () => {
    const input = units("operational-latency-ms", 3);
    input[0]!.numericValue = 5;
    input[1]!.numericValue = 15;
    input[2]!.availableInputs = input[2]!.availableInputs.filter(
      (name) => name !== "observation.model-call-span-duration",
    );

    const result = await evaluateMetric({
      metricId: "operational-latency-ms",
      snapshot: "snapshot-1",
      scope: { asOf: "2026-01-01T00:00:00.000000Z", window: "P7D" },
      units: input,
    });

    expect(result.value).toMatchObject({
      state: "AVAILABLE",
      exactValue: 10,
      contributingCount: 2,
    });
    expect(result.coverage).toMatchObject({
      numerator: 2,
      denominator: 3,
      state: "PARTIAL",
    });
  });

  it("separates incompatible money coordinates instead of converting or aggregating", async () => {
    const input = units("operational-attributable-cost", 2);
    input[0]!.numericValue = 2;
    input[0]!.coordinates = {
      source: "provider",
      currency: "USD",
      basis: "invoice",
    };
    input[1]!.numericValue = 3;
    input[1]!.coordinates = {
      source: "provider",
      currency: "EUR",
      basis: "invoice",
    };

    const result = await evaluateMetric({
      metricId: "operational-attributable-cost",
      snapshot: "snapshot-1",
      scope: { asOf: "2026-01-01T00:00:00.000000Z", window: "P7D" },
      units: input,
    });

    expect(result.series).toHaveLength(2);
    expect(result.series.map((entry) => entry.exactValue).sort()).toEqual([
      2, 3,
    ]);
    expect(result.value.exactValue).toBeNull();
  });

  it("produces the same digest for differently ordered pinned provenance", async () => {
    const input = units("direct-evidence-basis-rate", 2);
    const request = {
      metricId: "direct-evidence-basis-rate",
      snapshot: "snapshot-1",
      scope: { asOf: "2026-01-01T00:00:00.000000Z", window: "P7D" },
      units: input,
    } as const;
    const first = await evaluateMetric(request);
    const second = await evaluateMetric({
      ...request,
      units: [...input].reverse(),
    });

    expect(second.resultDigest).toBe(first.resultDigest);
    expect(second.provenance.factIds).toEqual(first.provenance.factIds);
  });
});
