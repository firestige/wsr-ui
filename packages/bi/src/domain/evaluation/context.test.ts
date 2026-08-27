import { describe, expect, it } from "vitest";

import { decodeEvaluationContext, digestEvaluationContext } from "./context";

async function context() {
  const value = {
    schema: "wsr.bi.evaluation-context@1.0.0",
    context_id: "context-1",
    context_version: "1.0.0",
    content_digest: "",
    catalog_coordinate: "agentops.evaluation.metric-catalog@1.0.0",
    catalog_semantic_digest:
      "sha256:6dbb4375507a3a2eebbe5e86bb6f0a40ebf811790f55ee841b15c6942e1f159d",
    as_of: "2026-01-01T00:00:00.000000Z",
    tasks: [
      {
        task_id: "task-1",
        delivery_ids: ["delivery-1"],
        cohort_coordinates: [{ key: "suite", value: "alpha" }],
        event_time_role_template: {
          id: "writer",
          version: "1.2.3",
          digest:
            "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      },
    ],
  };
  value.content_digest = await digestEvaluationContext(value);
  return value;
}

describe("BI-local evaluation context", () => {
  it("accepts an exact closed manifest and verified digest", async () => {
    const result = await decodeEvaluationContext(await context());

    expect(result).toMatchObject({
      ok: true,
      value: { context_id: "context-1" },
    });
  });

  it("rejects unknown fields and digest drift", async () => {
    const unknown = await context();
    Object.assign(unknown.tasks[0]!, { inferred_outcome: "SUCCESS" });
    const drifted = await context();
    drifted.tasks[0]!.task_id = "changed-after-digest";

    await expect(decodeEvaluationContext(unknown)).resolves.toMatchObject({
      ok: false,
    });
    await expect(decodeEvaluationContext(drifted)).resolves.toMatchObject({
      ok: false,
      error: { kind: "DIGEST_MISMATCH" },
    });
  });

  it("rejects duplicate task and Delivery identities", async () => {
    const duplicateTask = await context();
    duplicateTask.tasks.push(structuredClone(duplicateTask.tasks[0]!));
    duplicateTask.content_digest = await digestEvaluationContext(duplicateTask);
    const duplicateDelivery = await context();
    duplicateDelivery.tasks[0]!.delivery_ids.push("delivery-1");
    duplicateDelivery.content_digest =
      await digestEvaluationContext(duplicateDelivery);

    await expect(decodeEvaluationContext(duplicateTask)).resolves.toMatchObject(
      { ok: false },
    );
    await expect(
      decodeEvaluationContext(duplicateDelivery),
    ).resolves.toMatchObject({ ok: false });
  });
});
