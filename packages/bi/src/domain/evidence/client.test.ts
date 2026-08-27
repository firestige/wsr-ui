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
});

describe("bounded Evidence transport", () => {
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
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(traceResponse())));
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
});
