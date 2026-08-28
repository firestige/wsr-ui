import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedEvaluationContext } from "../domain/evolution/types";
import { MetricExplanationView, ReceiptView } from "./details";

const receipt: ResolvedEvaluationContext = {
  context_version: 1,
  selection: { selection_version: 1, task_ids: ["task-a", "task-b"] },
  as_of: "2026-08-28T01:00:00.000000Z",
  resolved_at: "2026-08-28T01:00:01.000000Z",
  task_population: [
    {
      task_id: "task-a",
      display_name: "Checkout optimization",
      memberships: [],
      cohort_coordinates: {},
      exclusions: ["UNDEFINED_TASK_MEMBERSHIP"],
    },
    {
      task_id: "task-b",
      memberships: [],
      cohort_coordinates: {},
      exclusions: ["UNDEFINED_TASK_MEMBERSHIP"],
    },
  ],
  catalog: {
    catalog_id: "agentops.evaluation.metric-catalog",
    version: "2.0.0",
    semantic_digest: "a".repeat(64),
    observation_profile: "1.0.0",
  },
  evidence_bindings: [
    {
      route: "/v1/evidence/tasks",
      canonical_filter: { task_id: "task-a" },
      contract_revision: "1.0.0",
      observation_profile: "2.0.0",
      read_model_revision: "2.0.0",
      route_snapshot: "task-snapshot-a",
      completion_state: "PARTIAL",
    },
  ],
  input_refs: [
    { kind: "FACT", identity: "fact-a", provenance_ref: "b".repeat(64) },
  ],
  workflow_resolutions: [],
  population_state: "PARTIAL",
};

describe("inspector detail content", () => {
  it("renders Catalog-owned explanation without deriving recommendations", () => {
    render(
      <MetricExplanationView
        definition="Share of eligible Deliveries with a terminal outcome."
        eligibility="Closed Deliveries with a valid outcome Fact."
        exclusions={["Open Deliveries", "Invalid outcome values"]}
        limits="This metric does not attribute causes or recommend Workflow changes."
        metricCoordinate="terminal-outcome-rate@2.0.0"
        valueSemantics="Exact ratio over the eligible Delivery population."
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Metric explanation" }),
    ).toBeVisible();
    expect(screen.getByText("terminal-outcome-rate@2.0.0")).toBeVisible();
    expect(screen.getByText(/does not attribute causes/)).toBeVisible();
    expect(screen.queryByText(/improve this workflow/i)).toBeNull();
  });

  it("renders receipt identity, display-name fallback and exact resolved context", () => {
    render(<ReceiptView receipt={receipt} side="single" />);

    expect(
      screen.getByRole("heading", { name: "Evaluation receipt" }),
    ).toBeVisible();
    expect(screen.getByText("Checkout optimization")).toBeVisible();
    expect(screen.getAllByText("task-b").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PARTIAL").length).toBeGreaterThan(0);
    expect(screen.getByText("task-snapshot-a")).toBeVisible();
    expect(screen.getByText("fact-a")).toBeVisible();
    expect(screen.getByText(/response audit record/i)).toBeVisible();
    expect(screen.getByText(/not proof of causation/i)).toBeVisible();
  });
});
