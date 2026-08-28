import { describe, expect, it, vi } from "vitest";

import {
  CATALOG_COORDINATES,
  EvolutionClient,
  decodeComputeResponse,
} from "./client";

function receipt(taskId: string) {
  return {
    context_version: 1,
    selection: { selection_version: 1, task_ids: [taskId] },
    as_of: "2026-08-28T01:00:00.000000Z",
    resolved_at: "2026-08-28T01:00:01.000000Z",
    task_population: [
      {
        task_id: taskId,
        memberships: [],
        cohort_coordinates: {},
        exclusions: ["UNDEFINED_TASK_MEMBERSHIP"],
      },
    ],
    catalog: {
      catalog_id: "agentops.evaluation.metric-catalog",
      version: "2.0.0",
      semantic_digest:
        "851692f9d4a549d21f3c741470737eabb0d40b5f03cf10ffae76e1892023741e",
      observation_profile: "1.0.0",
    },
    evidence_bindings: [
      {
        route: "/v1/evidence/tasks",
        canonical_filter: {
          as_of: "2026-08-28T01:00:00.000000Z",
          task_id: taskId,
        },
        contract_revision: "1.0.0",
        observation_profile: "2.0.0",
        read_model_revision: "2.0.0",
        route_snapshot: "task-snapshot-1",
        completion_state: "COMPLETE",
      },
    ],
    input_refs: [],
    workflow_resolutions: [],
    population_state: "OPEN",
  };
}

function metricResults() {
  return CATALOG_COORDINATES.map((coordinate) => ({
    metric_id: coordinate.slice(0, coordinate.lastIndexOf("@")),
    metric_version: "2.0.0",
    slices: [
      {
        slice_key: {},
        state: "UNAVAILABLE",
        withholding_reason: "MISSING_INPUT",
        measures: {},
        coverage: {
          numerator: "0",
          denominator: "0",
          raw_ratio: null,
          state: "NO_POPULATION",
          alert: null,
        },
        compatibility: {},
        exclusions: [],
        missing_inputs: [],
        provenance_refs: [],
      },
    ],
  }));
}

function singleResponse(taskId = "task-a") {
  return {
    api_version: 1,
    mode: "SINGLE",
    result: {
      tag: "SIDE_RESULT",
      receipt: receipt(taskId),
      metric_results: metricResults(),
    },
  };
}

function responseWithManifest() {
  const body = singleResponse() as unknown as {
    result: {
      receipt: {
        task_population: Array<{
          memberships: Array<Record<string, unknown>>;
          exclusions: string[];
        }>;
        workflow_resolutions: Array<Record<string, unknown>>;
      };
    };
  };
  body.result.receipt.task_population[0]!.memberships = [
    {
      delivery_id: "delivery-a",
      manifest_digest: "a".repeat(64),
      accepted_digest: "b".repeat(64),
      profile_version: "2.0.0",
      source_identity: "event:membership-a",
      recorded_at: "2026-08-28T01:00:00.000000Z",
    },
  ];
  body.result.receipt.task_population[0]!.exclusions = [];
  body.result.receipt.workflow_resolutions = [
    {
      manifest_digest: "a".repeat(64),
      manifest_projection_digest: "c".repeat(64),
      accepted_digest: "b".repeat(64),
      profile_version: "2.0.0",
      source_identity: "event:membership-a",
      package_name: "implementation",
      exact_package_version: "2.0.0",
      package_digest: `sha256:${"d".repeat(64)}`,
      workflow_id: "workflow.implementation",
      workflow_version: "2.0.0",
      snapshot_id: "snapshot.implementation.2",
      snapshot_digest: `sha256:${"e".repeat(64)}`,
      state: "NOT_FOUND",
      attempts: [{ source_id: "official", source_index: 0, code: "NOT_FOUND" }],
    },
  ];
  return body;
}

describe("closed Evolution decoder", () => {
  it("accepts an exact twelve-result single response without parsing exact values", () => {
    const body = singleResponse();
    body.result.metric_results[0]!.slices[0] = {
      ...body.result.metric_results[0]!.slices[0]!,
      state: "AVAILABLE",
      value: { kind: "RATIO", value: "1/3", unit: "ratio" },
      withholding_reason: undefined,
      numerator: "1",
      denominator: "3",
      contributing_count: "3",
      coverage: {
        numerator: "3",
        denominator: "3",
        raw_ratio: "1",
        state: "FULL",
        alert: null,
      },
    } as never;

    const result = decodeComputeResponse(body);

    expect(result).toMatchObject({ ok: true });
    if (result.ok && result.value.mode === "SINGLE") {
      expect(
        result.value.result.metric_results[0]?.slices[0]?.value?.value,
      ).toBe("1/3");
    }
  });

  it("accepts slice keys ordered by UTF-8 bytes rather than UTF-16 code units", () => {
    const body = singleResponse();
    const baseSlice = body.result.metric_results[0]!.slices[0]!;
    body.result.metric_results[0]!.slices = [
      { ...baseSlice, slice_key: { "\uE000": "bmp" } },
      { ...baseSlice, slice_key: { "\u{10000}": "supplementary" } },
    ];

    expect(decodeComputeResponse(body)).toMatchObject({ ok: true });
  });

  it.each([
    [
      "unknown field",
      (body: ReturnType<typeof singleResponse>) =>
        Object.assign(body, { future: true }),
    ],
    [
      "wrong API version",
      (body: ReturnType<typeof singleResponse>) =>
        Object.assign(body, { api_version: 2 }),
    ],
    [
      "missing catalog coordinate",
      (body: ReturnType<typeof singleResponse>) =>
        body.result.metric_results.pop(),
    ],
    [
      "unknown nested field",
      (body: ReturnType<typeof singleResponse>) =>
        Object.assign(body.result.receipt, { manifest: true }),
    ],
    [
      "Task population does not match selection",
      (body: ReturnType<typeof singleResponse>) =>
        Object.assign(body.result.receipt.task_population[0]!, {
          task_id: "task-other",
        }),
    ],
    [
      "undefined Task lacks its exclusion",
      (body: ReturnType<typeof singleResponse>) =>
        body.result.receipt.task_population[0]!.exclusions.pop(),
    ],
    [
      "non-canonical coverage ratio",
      (body: ReturnType<typeof singleResponse>) =>
        Object.assign(body.result.metric_results[0]!.slices[0]!.coverage, {
          numerator: "1",
          denominator: "2",
          raw_ratio: "2/4",
          state: "PARTIAL",
        }),
    ],
    [
      "Task binding cutoff does not match receipt",
      (body: ReturnType<typeof singleResponse>) =>
        Object.assign(
          body.result.receipt.evidence_bindings[0]!.canonical_filter,
          { as_of: "2026-08-28T00:00:00.000000Z" },
        ),
    ],
    [
      "duplicate input reference",
      (body: ReturnType<typeof singleResponse>) =>
        (body.result.receipt.input_refs as Array<Record<string, unknown>>).push(
          {
            kind: "FACT",
            identity: "fact-a",
            provenance_ref: "a".repeat(64),
          },
          {
            kind: "FACT",
            identity: "fact-a",
            provenance_ref: "a".repeat(64),
          },
        ),
    ],
    [
      "complete population contains undefined membership",
      (body: ReturnType<typeof singleResponse>) =>
        Object.assign(body.result.receipt, { population_state: "COMPLETE" }),
    ],
  ])("rejects %s as incompatible", (_name, mutate) => {
    const body = singleResponse();
    mutate(body);
    expect(decodeComputeResponse(body)).toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("retains the successful side of a partial compare", () => {
    const body = {
      api_version: 1,
      mode: "COMPARE",
      status: "PARTIAL_COMPARE",
      left: singleResponse().result,
      right: {
        tag: "SIDE_ERROR",
        code: "RESOLUTION_BOUND_EXCEEDED",
        retryable: false,
        detail: "unique Delivery bound exceeded",
      },
      deltas: CATALOG_COORDINATES.map((metric_coordinate) => ({
        metric_coordinate,
        slice_key: {},
        state: "SIDE_UNRESOLVED",
      })),
    };

    expect(decodeComputeResponse(body)).toMatchObject({
      ok: true,
      value: {
        status: "PARTIAL_COMPARE",
        left: { tag: "SIDE_RESULT" },
        right: { code: "RESOLUTION_BOUND_EXCEEDED", retryable: false },
      },
    });
  });

  it("rejects a Delta whose direction disagrees with its exact sign", () => {
    const left = singleResponse().result;
    const right = singleResponse().result;
    for (const [side, ratio] of [
      [left, "1/3"],
      [right, "2/3"],
    ] as const) {
      side.metric_results[0]!.slices[0] = {
        ...side.metric_results[0]!.slices[0]!,
        state: "AVAILABLE",
        value: { kind: "RATIO", value: ratio, unit: "ratio" },
        withholding_reason: undefined,
        coverage: {
          numerator: "1",
          denominator: "1",
          raw_ratio: "1",
          state: "FULL",
          alert: null,
        },
      } as never;
    }
    const body = {
      api_version: 1,
      mode: "COMPARE",
      status: "FULL_COMPARE",
      left,
      right,
      deltas: CATALOG_COORDINATES.map((metric_coordinate, index) =>
        index === 0
          ? {
              metric_coordinate,
              slice_key: {},
              state: "AVAILABLE",
              value: { kind: "RATIO", value: "1/3", unit: "ratio" },
              direction: "DECREASE",
            }
          : {
              metric_coordinate,
              slice_key: {},
              state: "WITHHELD",
              withholding_reason: "MISSING_INPUT",
            },
      ),
    };

    expect(decodeComputeResponse(body)).toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("preserves integers beyond the JavaScript safe range as canonical strings", () => {
    const body = singleResponse();
    body.result.metric_results[0]!.slices[0] = {
      ...body.result.metric_results[0]!.slices[0]!,
      state: "AVAILABLE",
      value: {
        kind: "COUNT",
        value: "9007199254740993",
        unit: "count",
      },
      withholding_reason: undefined,
      measures: { observed: "9007199254740993" },
      numerator: "9007199254740993",
      denominator: "9007199254740993",
      contributing_count: "9007199254740993",
      coverage: {
        numerator: "9007199254740993",
        denominator: "9007199254740993",
        raw_ratio: "1",
        state: "FULL",
        alert: null,
      },
    } as never;

    const result = decodeComputeResponse(body);

    expect(result).toMatchObject({ ok: true });
    if (result.ok && result.value.mode === "SINGLE") {
      expect(
        result.value.result.metric_results[0]!.slices[0]!.value!.value,
      ).toBe("9007199254740993");
    }
  });

  it("rejects incomplete or state-incompatible compare Delta sets", () => {
    const full = {
      api_version: 1,
      mode: "COMPARE",
      status: "FULL_COMPARE",
      left: singleResponse().result,
      right: singleResponse().result,
      deltas: [],
    };
    expect(decodeComputeResponse(full)).toMatchObject({ ok: false });

    const partial = {
      api_version: 1,
      mode: "COMPARE",
      status: "PARTIAL_COMPARE",
      left: singleResponse().result,
      right: {
        tag: "SIDE_ERROR",
        code: "UPSTREAM_UNAVAILABLE",
        retryable: true,
        detail: "Evidence unavailable",
      },
      deltas: CATALOG_COORDINATES.map((metric_coordinate) => ({
        metric_coordinate,
        slice_key: {},
        state: "WITHHELD",
        withholding_reason: "MISSING_INPUT",
      })),
    };
    expect(decodeComputeResponse(partial)).toMatchObject({ ok: false });
  });

  it("rejects source proof on an unresolved Workflow reading", () => {
    const body = responseWithManifest();
    Object.assign(body.result.receipt.workflow_resolutions[0]!, {
      matched_source_id: "official",
      matched_source_index: 0,
    });

    expect(decodeComputeResponse(body)).toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("requires exactly one Workflow resolution for every membership Manifest", () => {
    const body = responseWithManifest();
    body.result.receipt.workflow_resolutions = [];

    expect(decodeComputeResponse(body)).toMatchObject({ ok: false });
  });

  it("rejects semantically duplicate slice keys regardless of insertion order", () => {
    const body = singleResponse();
    const original = body.result.metric_results[0]!.slices[0]!;
    body.result.metric_results[0]!.slices = [
      { ...original, slice_key: { a: "1", b: "2" } },
      { ...original, slice_key: { b: "2", a: "1" } },
    ];

    expect(decodeComputeResponse(body)).toMatchObject({ ok: false });
  });
});

describe("bounded Evolution transport", () => {
  it("canonicalizes Task IDs and submits a same-origin credential-free request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(singleResponse()), {
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new EvolutionClient({ fetcher });

    const result = await client.computeSingle(["task-z", "task-a"]);

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/evolution/v1/evaluations:compute",
      expect.objectContaining({
        method: "POST",
        credentials: "omit",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_version: 1,
          mode: "SINGLE",
          selection: { selection_version: 1, task_ids: ["task-a", "task-z"] },
        }),
      }),
    );
  });

  it("uses UTF-8 bytewise Task ordering rather than locale collation", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(singleResponse("task-Z")), {
        headers: { "content-type": "application/json" },
      }),
    );

    await new EvolutionClient({ fetcher }).computeSingle(["task-a", "task-Z"]);

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          api_version: 1,
          mode: "SINGLE",
          selection: { selection_version: 1, task_ids: ["task-Z", "task-a"] },
        }),
      }),
    );
  });

  it("rejects duplicate or over-bound selections before transport", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new EvolutionClient({ fetcher });

    await expect(
      client.computeSingle(["task-a", "task-a"]),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: "INVALID_SELECTION" },
    });
    await expect(
      client.computeSingle(
        Array.from({ length: 25 }, (_, index) => `task-${index}`),
      ),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: "INVALID_SELECTION" },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps the published top-level Evolution error without inventing Metric Results", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            detail: "Evidence timed out",
            retryable: true,
          },
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      new EvolutionClient({ fetcher }).computeSingle(["task-a"]),
    ).resolves.toEqual({
      ok: false,
      error: {
        kind: "UPSTREAM",
        code: "UPSTREAM_UNAVAILABLE",
        detail: "Evidence timed out",
        retryable: true,
      },
    });
  });

  it.each([
    [
      "success envelope on an error status",
      new Response(JSON.stringify(singleResponse()), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    ],
    [
      "error envelope on a success status",
      new Response(
        JSON.stringify({
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            retryable: true,
            detail: "Evidence unavailable",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ],
    [
      "non-JSON content type",
      new Response(JSON.stringify(singleResponse()), {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    ],
  ])("rejects %s", async (_name, response) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(
      new EvolutionClient({ fetcher }).computeSingle(["task-a"]),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("stops a chunked response once the configured byte bound is exceeded", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          new TextEncoder().encode(JSON.stringify(singleResponse())),
          { headers: { "content-type": "application/json" } },
        ),
      );

    await expect(
      new EvolutionClient({ fetcher, maximumBodyBytes: 16 }).computeSingle([
        "task-a",
      ]),
    ).resolves.toEqual({
      ok: false,
      error: { kind: "RESPONSE_BOUND_EXCEEDED", maximumBytes: 16 },
    });
  });
});
