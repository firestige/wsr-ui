import { describe, expect, it, vi } from "vitest";

import { EvidenceClient, decodeEvidencePage } from "./client";

const truth = {
  completeness: null,
  availability: "AVAILABLE",
  expiry: "ACTIVE",
  expires_at: "2027-01-01T00:00:00.000000Z",
} as const;

function traceResponse() {
  return {
    contract: { name: "evidence.query", revision: "0.1.0" },
    observation_profile: "1.0.0",
    read_model_revision: "1.0.0",
    snapshot: "snapshot-1",
    items: [
      {
        id: "node-1",
        trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        kind: "NODE",
        source: {
          kind: "SPAN",
          trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          span_id: "bbbbbbbbbbbbbbbb",
        },
        recorded_at: "2026-01-01T00:00:00.000000Z",
        truth: { ...truth },
        node: {
          span_id: "bbbbbbbbbbbbbbbb",
          span_name: "chat",
          span_kind: "CLIENT",
          start_time_unix_nano: "1000000000",
          end_time_unix_nano: "2000000000",
          span_status: "OK",
          span_flags: 1,
          trace_state: null,
          fields: [],
        },
        edge: null,
      },
    ],
    next_cursor: "cursor-2",
    trace_state: "AVAILABLE",
    trace_summaries: [
      { trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", state: "AVAILABLE" },
    ],
  };
}

function factResponse() {
  return {
    contract: { name: "evidence.query", revision: "0.1.0" },
    observation_profile: "1.0.0",
    read_model_revision: "1.0.0",
    snapshot: "snapshot-facts-1",
    items: [
      {
        id: "fact-1",
        kind: "EVENT_CONTRIBUTION",
        source: { kind: "EVENT", event_id: "event-1" },
        recorded_at: "2026-01-01T00:00:00.000000Z",
        provenance: {
          accepted_digest: "1".repeat(64),
          profile_version: "1.0.0",
          family_schema: "implementation@1",
          owner_key: ["usage", "event-1"],
        },
        compatibility: {
          family_schema: "implementation@1",
          event_name: "usage",
          completeness: "FINAL",
          dimensions: [],
        },
        truth: {
          completeness: "FINAL",
          availability: "AVAILABLE",
          expiry: "ACTIVE",
          expires_at: "2027-01-01T00:00:00.000000Z",
        },
        fields: [],
        relationships: [],
      },
    ],
    next_cursor: null,
  };
}

function linkResponse() {
  const body = traceResponse();
  body.items[0] = {
    ...body.items[0]!,
    id: "link-1",
    kind: "LINK",
    node: null as never,
    edge: {
      from: {
        trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        span_id: "bbbbbbbbbbbbbbbb",
      },
      to: {
        trace_id: "cccccccccccccccccccccccccccccccc",
        span_id: "dddddddddddddddd",
      },
      trace_state: "vendor=x",
      flags: 1,
    } as never,
  };
  return body;
}

describe("closed Evidence decoder", () => {
  it("accepts the exact published trace envelope", () => {
    const result = decodeEvidencePage("traces", traceResponse(), 100);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items[0]?.kind).toBe("NODE");
      expect(result.value.snapshot).toBe("snapshot-1");
    }
  });

  it.each([
    [
      "later revision",
      (value: ReturnType<typeof traceResponse>) => {
        value.contract.revision = "0.2.0";
      },
    ],
    [
      "unknown response field",
      (value: ReturnType<typeof traceResponse>) => {
        Object.assign(value, { future_field: true });
      },
    ],
    [
      "unknown nested field",
      (value: ReturnType<typeof traceResponse>) => {
        Object.assign(value.items[0]?.truth ?? {}, { inferred: true });
      },
    ],
    [
      "invalid truth tuple",
      (value: ReturnType<typeof traceResponse>) => {
        if (value.items[0])
          Object.assign(value.items[0].truth, { availability: "UNAVAILABLE" });
      },
    ],
    [
      "item bound overflow",
      (value: ReturnType<typeof traceResponse>) => {
        value.items = Array.from({ length: 101 }, () => value.items[0]!);
      },
    ],
  ])("rejects %s as wholly incompatible", (_name, mutate) => {
    const body = traceResponse();
    mutate(body);

    expect(decodeEvidencePage("traces", body, 100)).toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("maps a published upstream error without recasting it as absence", () => {
    expect(
      decodeEvidencePage(
        "facts",
        { error: { code: "CURSOR_EXPIRED", message: "cursor expired" } },
        100,
      ),
    ).toEqual({
      ok: false,
      error: {
        kind: "UPSTREAM",
        code: "CURSOR_EXPIRED",
        message: "cursor expired",
      },
    });
  });

  it("rejects empty identities, duplicate fields and unordered resources", () => {
    const empty = factResponse();
    empty.items[0]!.id = "";
    expect(decodeEvidencePage("facts", empty, 100)).toMatchObject({
      ok: false,
    });

    const duplicateFields = factResponse();
    duplicateFields.items[0]!.fields = [
      { field: "agentops.delivery.id", value: "delivery-a" },
      { field: "agentops.delivery.id", value: "delivery-a" },
    ] as never;
    expect(decodeEvidencePage("facts", duplicateFields, 100)).toMatchObject({
      ok: false,
    });

    const unorderedFields = factResponse();
    unorderedFields.items[0]!.fields = [
      { field: "agentops.task.id", value: "task-a" },
      { field: "agentops.delivery.id", value: "delivery-a" },
    ] as never;
    expect(decodeEvidencePage("facts", unorderedFields, 100)).toMatchObject({
      ok: false,
    });

    const unordered = factResponse();
    unordered.items = [
      { ...unordered.items[0]!, id: "fact-b" },
      { ...unordered.items[0]!, id: "fact-a" },
    ];
    expect(decodeEvidencePage("facts", unordered, 100)).toMatchObject({
      ok: false,
    });
  });

  it("rejects unordered or duplicate Trace summaries", () => {
    const body = traceResponse();
    body.trace_summaries = [
      { trace_id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", state: "AVAILABLE" },
      { trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", state: "AVAILABLE" },
    ];
    expect(decodeEvidencePage("traces", body, 100)).toMatchObject({
      ok: false,
    });
  });

  it.each([
    [
      "empty node name",
      (node: Record<string, unknown>) => (node.span_name = ""),
    ],
    [
      "oversized node name",
      (node: Record<string, unknown>) => (node.span_name = "x".repeat(129)),
    ],
    [
      "invalid node flags",
      (node: Record<string, unknown>) => (node.span_flags = -1),
    ],
    [
      "oversized node trace state",
      (node: Record<string, unknown>) => (node.trace_state = "x".repeat(513)),
    ],
  ])("rejects %s", (_name, mutate) => {
    const body = traceResponse();
    mutate(body.items[0]!.node as unknown as Record<string, unknown>);
    expect(decodeEvidencePage("traces", body, 100)).toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("rejects Trace identities that disagree across item, source, node, and edge", () => {
    const nodeMismatch = traceResponse();
    nodeMismatch.items[0]!.source.span_id = "c".repeat(16);
    expect(decodeEvidencePage("traces", nodeMismatch, 100)).toMatchObject({
      ok: false,
    });

    const parentMismatch = traceResponse();
    parentMismatch.items[0] = {
      ...parentMismatch.items[0]!,
      id: "parent-1",
      kind: "PARENT_EDGE",
      node: null as never,
      edge: {
        from: {
          trace_id: "a".repeat(32),
          span_id: "b".repeat(16),
        },
        to: {
          trace_id: "c".repeat(32),
          span_id: "d".repeat(16),
        },
      } as never,
    };
    expect(decodeEvidencePage("traces", parentMismatch, 100)).toMatchObject({
      ok: false,
    });

    const linkMismatch = linkResponse();
    linkMismatch.items[0]!.source.span_id = "e".repeat(16);
    expect(decodeEvidencePage("traces", linkMismatch, 100)).toMatchObject({
      ok: false,
    });

    const expired = traceResponse();
    Reflect.set(expired.items[0]!.truth, "expiry", "EXPIRED");
    Reflect.set(expired.items[0]!.truth, "availability", "UNAVAILABLE");
    expect(decodeEvidencePage("traces", expired, 100)).toMatchObject({
      ok: false,
    });
  });

  it.each([
    ["invalid LINK flags", { flags: 4294967296 }],
    ["invalid LINK trace state", { trace_state: "x".repeat(513) }],
  ])("rejects %s", (_name, mutation) => {
    const body = linkResponse();
    Object.assign(
      body.items[0]!.edge as unknown as Record<string, unknown>,
      mutation,
    );
    expect(decodeEvidencePage("traces", body, 100)).toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it.each([
    ["family_schema", 3],
    ["event_name", false],
  ])("rejects non-string nullable Fact compatibility %s", (field, value) => {
    const body = factResponse();
    Object.assign(body.items[0]!.compatibility, { [field]: value });
    expect(decodeEvidencePage("facts", body, 100)).toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });
});

describe("bounded Evidence transport", () => {
  it("rejects route-incompatible filters before transport", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new EvidenceClient({ fetcher });

    await expect(
      client.getPage("traces", { kind: "NODE", limit: 100 } as never),
    ).resolves.toMatchObject({ ok: false, error: { kind: "INCOMPATIBLE" } });
    await expect(
      client.getPage("traces", {
        trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        delivery_id: "delivery-a",
      } as never),
    ).resolves.toMatchObject({ ok: false, error: { kind: "INCOMPATIBLE" } });
    await expect(
      client.getPage("facts", {
        kind: "FINDING_FIX",
        event_name: "usage",
      }),
    ).resolves.toMatchObject({ ok: false, error: { kind: "INCOMPATIBLE" } });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses same-origin GET, exact filters, JSON accept and no credentials", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(traceResponse()), {
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new EvidenceClient({ fetcher });

    const result = await client.getPage("traces", {
      trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      limit: 100,
    });

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "/v1/evidence/traces?limit=100&trace_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expect.objectContaining({
        method: "GET",
        credentials: "omit",
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("rejects a successful Trace page for a different exact Trace", async () => {
    const client = new EvidenceClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(traceResponse()), {
          headers: { "content-type": "application/json" },
        }),
      ),
    });

    await expect(
      client.getPage("traces", {
        trace_id: "c".repeat(32),
        limit: 100,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("rejects a response above four MiB before JSON decoding", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("x".repeat(4 * 1024 * 1024 + 1), {
        headers: { "content-length": String(4 * 1024 * 1024 + 1) },
      }),
    );
    const client = new EvidenceClient({ fetcher });

    await expect(client.getPage("facts", { limit: 100 })).resolves.toEqual({
      ok: false,
      error: { kind: "RESPONSE_BOUND_EXCEEDED", maximumBytes: 4 * 1024 * 1024 },
    });
  });

  it("does not automatically follow a continuation cursor", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(traceResponse()), {
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new EvidenceClient({ fetcher });

    const result = await client.getPage("traces", {
      trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      limit: 100,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { next_cursor: "cursor-2" },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-JSON response before decoding", async () => {
    const client = new EvidenceClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(traceResponse()), {
          headers: { "content-type": "text/plain" },
        }),
      ),
    });

    await expect(
      client.getPage("traces", {
        trace_id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        limit: 100,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("rejects HTTP success carrying an error envelope", async () => {
    const client = new EvidenceClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "QUERY_UNAVAILABLE", message: "later" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    });

    await expect(
      client.getPage("facts", { limit: 100 }),
    ).resolves.toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
  });

  it("cancels a streamed body as soon as the byte bound is crossed", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
      },
      cancel,
    });
    const client = new EvidenceClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(stream, {
          headers: { "content-type": "application/json" },
        }),
      ),
      maximumBodyBytes: 10,
    });

    await expect(client.getPage("facts", { limit: 100 })).resolves.toEqual({
      ok: false,
      error: { kind: "RESPONSE_BOUND_EXCEEDED", maximumBytes: 10 },
    });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
