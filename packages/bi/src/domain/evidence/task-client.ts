import { closed, record } from "./validation";

const taskIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAXIMUM_BODY_BYTES = 1024 * 1024;
const encoder = new TextEncoder();

export interface TaskListItem {
  task_id: string;
  display_name: string | null;
  provenance: {
    accepted_digest: string;
    profile_version: "2.0.0";
    source: { kind: "EVENT"; event_id: string };
  };
}

export interface TaskPage {
  contract: { name: "evidence.query"; revision: "1.0.0" };
  observation_profile: "2.0.0";
  read_model_revision: "2.0.0";
  snapshot: string;
  items: TaskListItem[];
  next_cursor: string | null;
}

type TaskError =
  | { kind: "INCOMPATIBLE"; reason: string }
  | { kind: "UPSTREAM"; code: string; message: string }
  | { kind: "ERROR"; reason: "MALFORMED_BODY" | "NETWORK" | "TIMEOUT" };
export type TaskResult =
  { ok: true; value: TaskPage } | { ok: false; error: TaskError };

const incompatible = (reason: string): TaskResult => ({
  ok: false,
  error: { kind: "INCOMPATIBLE", reason },
});

function bytewiseCompare(left: string, right: string): number {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function source(value: unknown): boolean {
  return (
    record(value) &&
    closed(value, ["kind", "event_id"]) &&
    value.kind === "EVENT" &&
    typeof value.event_id === "string" &&
    value.event_id.length > 0
  );
}

function item(value: unknown): value is TaskListItem {
  return (
    record(value) &&
    closed(value, ["task_id", "display_name", "provenance"]) &&
    typeof value.task_id === "string" &&
    taskIdPattern.test(value.task_id) &&
    (value.display_name === null ||
      (typeof value.display_name === "string" &&
        value.display_name.trim().length > 0 &&
        value.display_name.length <= 160)) &&
    record(value.provenance) &&
    closed(value.provenance, [
      "accepted_digest",
      "profile_version",
      "source",
    ]) &&
    typeof value.provenance.accepted_digest === "string" &&
    digestPattern.test(value.provenance.accepted_digest) &&
    value.provenance.profile_version === "2.0.0" &&
    source(value.provenance.source)
  );
}

export function decodeTaskPage(input: unknown, limit: number): TaskResult {
  if (
    !record(input) ||
    !closed(input, [
      "contract",
      "observation_profile",
      "read_model_revision",
      "snapshot",
      "items",
      "next_cursor",
    ]) ||
    !record(input.contract) ||
    !closed(input.contract, ["name", "revision"]) ||
    input.contract.name !== "evidence.query" ||
    input.contract.revision !== "1.0.0" ||
    input.observation_profile !== "2.0.0" ||
    input.read_model_revision !== "2.0.0" ||
    typeof input.snapshot !== "string" ||
    input.snapshot.length === 0 ||
    !Array.isArray(input.items) ||
    input.items.length > limit ||
    !input.items.every(item) ||
    (input.next_cursor !== null &&
      (typeof input.next_cursor !== "string" || input.next_cursor.length === 0))
  )
    return incompatible("Task page does not match evidence.query@1.0.0");
  const ids = input.items.map((entry) => (entry as TaskListItem).task_id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some(
      (taskId, index) =>
        index > 0 && bytewiseCompare(ids[index - 1]!, taskId) >= 0,
    )
  )
    return incompatible("Task items are not unique bytewise ascending IDs");
  return { ok: true, value: input as unknown as TaskPage };
}

export class EvidenceTaskClient {
  readonly #fetcher: typeof fetch;
  readonly #timeoutMs: number;

  constructor(options: { fetcher?: typeof fetch; timeoutMs?: number } = {}) {
    this.#fetcher = options.fetcher ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async getPage(filters: {
    limit?: number;
    cursor?: string;
  }): Promise<TaskResult> {
    const limit = filters.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200)
      return incompatible("Task page limit must be between 1 and 200");
    if (filters.cursor !== undefined && filters.cursor.length === 0)
      return incompatible("Task cursor must be a nonempty opaque string");
    const query = new URLSearchParams();
    if (filters.cursor !== undefined) query.set("cursor", filters.cursor);
    query.set("limit", String(limit));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetcher(`/v1/evidence/tasks?${query}`, {
        method: "GET",
        credentials: "omit",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.headers.get("content-type")?.startsWith("application/json"))
        return incompatible("Task response content type is not JSON");
      const body = await response.text();
      if (encoder.encode(body).length > MAXIMUM_BODY_BYTES)
        return incompatible("Task response exceeds the byte bound");
      let decoded: unknown;
      try {
        decoded = JSON.parse(body);
      } catch {
        return {
          ok: false,
          error: { kind: "ERROR", reason: "MALFORMED_BODY" },
        };
      }
      if (!response.ok) {
        if (
          record(decoded) &&
          closed(decoded, ["error"]) &&
          record(decoded.error) &&
          closed(decoded.error, ["code", "message"]) &&
          typeof decoded.error.code === "string" &&
          typeof decoded.error.message === "string"
        )
          return {
            ok: false,
            error: {
              kind: "UPSTREAM",
              code: decoded.error.code,
              message: decoded.error.message,
            },
          };
        return incompatible("Task HTTP error lacks the closed envelope");
      }
      return decodeTaskPage(decoded, limit);
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ERROR",
          reason:
            error instanceof DOMException && error.name === "AbortError"
              ? "TIMEOUT"
              : "NETWORK",
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
