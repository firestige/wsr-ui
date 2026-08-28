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
      memberships: [
        {
          delivery_id: "delivery-a",
          manifest_digest: "c".repeat(64),
          accepted_digest: "d".repeat(64),
          profile_version: "2.0.0",
          source_identity: "source-a",
          recorded_at: "2026-08-28T00:59:00.000000Z",
        },
      ],
      cohort_coordinates: { workflow: "checkout@3.0.0" },
      exclusions: ["UNDEFINED_TASK_MEMBERSHIP"],
    },
    {
      task_id: "task-b",
      display_name: "   ",
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
      error_state: "UPSTREAM_PARTIAL",
    },
  ],
  input_refs: [
    { kind: "FACT", identity: "fact-a", provenance_ref: "b".repeat(64) },
  ],
  workflow_resolutions: [
    {
      manifest_digest: "c".repeat(64),
      manifest_projection_digest: "e".repeat(64),
      accepted_digest: "d".repeat(64),
      profile_version: "2.0.0",
      source_identity: "source-a",
      package_name: "checkout",
      exact_package_version: "3.0.0",
      package_digest: "f".repeat(64),
      workflow_id: "workflow-checkout",
      workflow_version: "3.0.0",
      snapshot_id: "snapshot-checkout",
      snapshot_digest: "1".repeat(64),
      state: "AVAILABLE",
      matched_source_id: "github-primary",
      matched_source_index: 0,
      matched_repository: "example/checkout",
      validated_archive_digest: "2".repeat(64),
      validated_package_digest: "3".repeat(64),
      validated_snapshot_digest: "4".repeat(64),
      attempts: [
        {
          source_id: "mirror",
          source_index: 1,
          code: "NOT_FOUND",
          message: "Package was not present",
        },
      ],
    },
  ],
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
    expect(screen.getByText("task-b").tagName).toBe("STRONG");
    expect(screen.getAllByText("PARTIAL").length).toBeGreaterThan(0);
    expect(screen.getByText("task-snapshot-a")).toBeVisible();
    expect(screen.getByText("delivery-a")).toBeVisible();
    expect(screen.getByText("workflow=checkout@3.0.0")).toBeVisible();
    expect(screen.getByText("UPSTREAM_PARTIAL")).toBeVisible();
    expect(screen.getByText("github-primary")).toBeVisible();
    expect(screen.getByText("example/checkout")).toBeVisible();
    expect(screen.getByText("NOT_FOUND")).toBeVisible();
    expect(screen.getByText("Package was not present")).toBeVisible();
    expect(screen.getAllByText("a".repeat(64)).length).toBeGreaterThan(0);
    expect(screen.getByText("fact-a")).toBeVisible();
    expect(screen.getByText(/response audit record/i)).toBeVisible();
    expect(screen.getByText(/not proof of causation/i)).toBeVisible();
  });
});
