export const CATALOG_COORDINATE = "agentops.evaluation.metric-catalog@1.0.0";
export const CATALOG_DIGEST =
  "sha256:6dbb4375507a3a2eebbe5e86bb6f0a40ebf811790f55ee841b15c6942e1f159d";

export type MetricKind = "rate" | "money" | "duration" | "quantity";
export type Formula = "RATE" | "SUM" | "AVERAGE" | "CATEGORICAL_RATE";

export interface MetricBinding {
  id: string;
  version: "1.0.0";
  inputRefs: readonly string[];
  minimumSample: number;
  kind: MetricKind;
  unit: string;
  formula: Formula;
  forbiddenInference: readonly string[];
}

function metric(
  id: string,
  minimumSample: number,
  kind: MetricKind,
  unit: string,
  formula: Formula,
  inputRefs: readonly string[],
  forbiddenInference: readonly string[],
): MetricBinding {
  return {
    id,
    version: "1.0.0",
    inputRefs,
    minimumSample,
    kind,
    unit,
    formula,
    forbiddenInference,
  };
}

const bindings = [
  metric(
    "role-template-rework-rate",
    20,
    "rate",
    "ratio",
    "RATE",
    [
      "evaluation.defined-task-snapshot",
      "evaluation.event-time-role-template",
      "evaluation.unique-terminal-task-outcome",
      "observation.repair-link",
      "projection.compatibility-eligibility",
    ],
    ["do not infer template causality", "do not backfill assignments"],
  ),
  metric(
    "role-template-trajectory-partial-cost",
    20,
    "money",
    "source currency",
    "SUM",
    [
      "evaluation.defined-task-snapshot",
      "evaluation.event-time-role-template",
      "evaluation.unique-terminal-task-outcome",
      "observation.reported-cost",
      "projection.compatibility-eligibility",
    ],
    ["do not label as total cost", "do not convert currency implicitly"],
  ),
  metric(
    "role-model-task-outcome-rate",
    20,
    "rate",
    "ratio",
    "CATEGORICAL_RATE",
    [
      "evaluation.unique-terminal-task-outcome",
      "observation.model-role-attribution-tuple",
      "projection.compatibility-eligibility",
    ],
    ["do not infer model causality", "do not compare incompatible cohorts"],
  ),
  metric(
    "packet-rework-rate",
    1,
    "rate",
    "ratio",
    "RATE",
    [
      "observation.packet-identity",
      "observation.repair-link",
      "projection.compatibility-eligibility",
    ],
    ["do not infer causal fault"],
  ),
  metric(
    "operational-latency-ms",
    1,
    "duration",
    "milliseconds",
    "AVERAGE",
    [
      "observation.model-call-span-duration",
      "observation.model-role-attribution-tuple",
      "projection.compatibility-eligibility",
    ],
    ["do not substitute C55 or zero", "do not infer causality"],
  ),
  metric(
    "trajectory-partial-cost",
    20,
    "money",
    "source currency",
    "SUM",
    [
      "observation.delivery-identity",
      "observation.reported-cost",
      "projection.compatibility-eligibility",
    ],
    ["do not label as total cost", "do not convert currency implicitly"],
  ),
  metric(
    "task-cohort-comparison-eligibility",
    20,
    "rate",
    "ratio",
    "RATE",
    [
      "evaluation.defined-task-snapshot",
      "evaluation.unique-terminal-task-outcome",
      "projection.compatibility-eligibility",
    ],
    [
      "do not drop excluded tasks from the denominator",
      "do not reconstruct missing membership",
    ],
  ),
  metric(
    "delivery-stage-reach",
    1,
    "rate",
    "ratio",
    "CATEGORICAL_RATE",
    [
      "observation.delivery-identity",
      "observation.delivery-stage-reached-c56",
      "projection.compatibility-eligibility",
    ],
    ["do not infer stage from workflow order or text"],
  ),
  metric(
    "delivery-terminal-outcome-rate",
    1,
    "rate",
    "ratio",
    "CATEGORICAL_RATE",
    [
      "observation.delivery-identity",
      "observation.delivery-outcome",
      "projection.compatibility-eligibility",
    ],
    ["do not infer a task-level outcome"],
  ),
  metric(
    "delivery-cycle-time-ms",
    1,
    "duration",
    "milliseconds",
    "AVERAGE",
    [
      "observation.delivery-identity",
      "observation.delivery-elapsed-time-c55",
      "projection.compatibility-eligibility",
    ],
    [
      "do not derive from arrival time",
      "do not substitute model-call latency or zero",
    ],
  ),
  metric(
    "operational-token-usage",
    1,
    "quantity",
    "tokens",
    "SUM",
    [
      "observation.standard-token-usage",
      "observation.model-role-attribution-tuple",
      "projection.compatibility-eligibility",
    ],
    ["do not synthesize missing total tokens", "do not label as total usage"],
  ),
  metric(
    "operational-attributable-cost",
    1,
    "money",
    "source currency",
    "SUM",
    [
      "observation.reported-cost",
      "observation.model-role-attribution-tuple",
      "projection.compatibility-eligibility",
    ],
    ["do not estimate or convert", "do not label as total cost"],
  ),
  metric(
    "operational-usage-availability",
    1,
    "rate",
    "ratio",
    "RATE",
    [
      "observation.model-call-identity",
      "observation.usage-source",
      "observation.model-role-attribution-tuple",
      "projection.compatibility-eligibility",
    ],
    ["do not turn missing usage into zero usage"],
  ),
  metric(
    "direct-evidence-basis-rate",
    1,
    "rate",
    "ratio",
    "RATE",
    [
      "observation.fact-identity",
      "observation.fact-provenance",
      "projection.compatibility-eligibility",
    ],
    ["do not infer semantic correctness from provenance"],
  ),
] as const;

export const METRIC_BINDINGS: Readonly<Record<string, MetricBinding>> =
  Object.freeze(
    Object.fromEntries(bindings.map((binding) => [binding.id, binding])),
  );
