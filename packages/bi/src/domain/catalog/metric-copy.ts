import type { CATALOG_COORDINATES } from "../evolution/client";

interface MetricCopy {
  definition: string;
  valueSemantics: string;
  eligibility: string;
  exclusions: string[];
  limits: string;
}

type Coordinate = (typeof CATALOG_COORDINATES)[number];

export const METRIC_COPY: Record<Coordinate, MetricCopy> = {
  "role-template-rework-rate@2.0.0": {
    definition: "Role-template rework rate",
    valueSemantics:
      "Ratio of covered terminal Delivery/template exposures with at least one recorded FINDING_FIX relationship.",
    eligibility:
      "Terminal Delivery with an accepted Manifest and recorded C30 binding the exercised role template.",
    exclusions: [
      "Missing or incompatible Manifest coordinate",
      "Unavailable repair relationship input",
      "Expired records outside the current population",
    ],
    limits:
      "Repair association is descriptive. Do not infer template, reviewer, or writer causality; do not merge Deliveries in one Task.",
  },
  "role-template-trajectory-partial-cost@2.0.0": {
    definition: "Role-template trajectory partial cost",
    valueSemantics:
      "Reported compatible money Usage for terminal Delivery/template exposures.",
    eligibility:
      "Terminal Delivery with exact Manifest-bound role template exposure and compatible reported money Usage.",
    exclusions: ["Incompatible Usage kind, unit, source, or source_id"],
    limits:
      "Do not label as total cost; do not estimate, price, or convert Usage.",
  },
  "role-model-task-outcome-rate@2.0.0": {
    definition: "Role-model task outcome rate",
    valueSemantics: "Outcome ratio for eligible attributed terminal Tasks.",
    eligibility:
      "Unique terminal Task outcome and complete canonical model-role tuple.",
    exclusions: ["Open or mixed-outcome Task", "Incomplete attribution"],
    limits: "Outcome difference is descriptive; do not infer model causality.",
  },
  "operational-latency-ms@2.0.0": {
    definition: "Operational latency",
    valueSemantics: "Native model-call Span duration in milliseconds.",
    eligibility: "Native host-reported finite nonnegative duration.",
    exclusions: [
      "Absent or invalid duration",
      "Incompatible provider or runtime cohort",
    ],
    limits:
      "Operational latency is not Delivery elapsed time. Do not substitute C55 or infer causality.",
  },
  "trajectory-partial-cost@2.0.0": {
    definition: "Trajectory partial cost",
    valueSemantics:
      "Partial sum of compatible reported money Usage linked to a Delivery.",
    eligibility:
      "Exact Delivery linkage and exact Usage kind, unit, source, and source_id.",
    exclusions: ["Incompatible Usage kind, unit, source, or source_id"],
    limits:
      "Do not label as total cost; do not estimate, price, or convert Usage.",
  },
  "task-cohort-comparison-eligibility@2.0.0": {
    definition: "Task cohort comparison eligibility",
    valueSemantics:
      "Ratio of defined Tasks ready for compatible cohort comparison.",
    eligibility: "Task passes the Metric Catalog Task eligibility rules.",
    exclusions: [
      "Open Delivery",
      "Mixed Delivery outcomes",
      "Undefined Task membership",
      "Missing Task identity or cohort coordinates",
    ],
    limits:
      "Eligibility measures evidence readiness, not outcome quality. Excluded Tasks stay in the denominator.",
  },
  "delivery-stage-reach@2.0.0": {
    definition: "Delivery stage reach",
    valueSemantics:
      "Per-stage ratio over linked terminal Deliveries with direct C56 readings.",
    eligibility: "Linked terminal Delivery with a valid direct C56 value.",
    exclusions: ["Absent or invalid C56 from the reached-stage numerator"],
    limits:
      "Stage identity does not prove unobserved traversal; do not infer from Workflow order.",
  },
  "delivery-terminal-outcome-rate@2.0.0": {
    definition: "Delivery terminal outcome rate",
    valueSemantics: "Per-outcome ratio over explicitly terminated Deliveries.",
    eligibility: "Exact terminal Delivery identity and supported outcome.",
    exclusions: ["Open or non-terminal Delivery", "Unsupported outcome"],
    limits:
      "Delivery outcome is not Task outcome; do not infer a Task-level outcome.",
  },
  "delivery-cycle-time-ms@2.0.0": {
    definition: "Delivery cycle time",
    valueSemantics:
      "Owner-reported direct C55 Delivery elapsed time in milliseconds.",
    eligibility: "Terminal Delivery with finite nonnegative C55.",
    exclusions: ["Absent or invalid C55"],
    limits:
      "Do not derive from arrival time or substitute model-call latency or zero.",
  },
  "operational-token-usage@2.0.0": {
    definition: "Operational token usage",
    valueSemantics: "Compatible reported input or output token measurements.",
    eligibility:
      "Reported compatible token measurement for an exact model call.",
    exclusions: ["Absent or incompatible measurement"],
    limits:
      "Values are partial attributable Usage; do not synthesize total tokens.",
  },
  "operational-attributable-cost@2.0.0": {
    definition: "Operational attributable cost",
    valueSemantics: "Reported money Usage bound to an exact model call.",
    eligibility:
      "Trace/Span context binds Usage to the exact call with compatible kind, unit, source, and source_id.",
    exclusions: [
      "Missing call linkage",
      "Incompatible Usage",
      "Incomplete attribution",
    ],
    limits:
      "Do not label as total cost; do not estimate, price, or convert Usage.",
  },
  "operational-usage-availability@2.0.0": {
    definition: "Operational usage availability",
    valueSemantics:
      "Ratio of eligible model calls with reported compatible Usage.",
    eligibility: "Eligible exact model-call identity.",
    exclusions: ["Unsupported call identity or compatibility context"],
    limits:
      "Availability does not state Usage amount; do not turn missing Usage into zero.",
  },
};
