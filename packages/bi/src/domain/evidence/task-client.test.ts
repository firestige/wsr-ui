import { describe, expect, it, vi } from "vitest";

import { EvidenceTaskClient, decodeTaskPage } from "./task-client";

const page = {
  contract: { name: "evidence.query", revision: "1.0.0" },
  observation_profile: "2.0.0",
  read_model_revision: "2.0.0",
  snapshot: "snapshot-task-list",
  items: [
    {
      task_id: "task-a",
      display_name: "Baseline run",
      provenance: {
        accepted_digest: "a".repeat(64),
        profile_version: "2.0.0",
        source: { kind: "EVENT", event_id: "event-a" },
      },
    },
    {
      task_id: "task-b",
      display_name: null,
      provenance: {
        accepted_digest: "b".repeat(64),
        profile_version: "2.0.0",
        source: { kind: "EVENT", event_id: "event-b" },
      },
    },
  ],
  next_cursor: null,
};

describe("Evidence Task discovery client", () => {
  it("keeps display name separate from stable Task identity", () => {
    expect(decodeTaskPage(page, 100)).toEqual({ ok: true, value: page });
  });

  it("fails closed on an extra field or non-canonical order", () => {
    expect(decodeTaskPage({ ...page, latest: true }, 100)).toMatchObject({
      ok: false,
      error: { kind: "INCOMPATIBLE" },
    });
    expect(
      decodeTaskPage({ ...page, items: page.items.toReversed() }, 100),
    ).toMatchObject({ ok: false, error: { kind: "INCOMPATIBLE" } });
  });

  it("requests one bounded page and leaves pagination explicit", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...page, next_cursor: "next-page" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = new EvidenceTaskClient({ fetcher });

    const result = await client.getPage({ limit: 100 });

    expect(result).toMatchObject({
      ok: true,
      value: { next_cursor: "next-page" },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/v1/evidence/tasks?limit=100",
      expect.objectContaining({ method: "GET", credentials: "omit" }),
    );
  });

  it("binds continuation to its explicit cursor and limit", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(page), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const result = await new EvidenceTaskClient({ fetcher }).getPage({
      cursor: "opaque-cursor",
      limit: 50,
    });

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(
      "/v1/evidence/tasks?cursor=opaque-cursor&limit=50",
      expect.any(Object),
    );
  });
});
