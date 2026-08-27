import type {
  EvidencePage,
  EvidenceResult,
  EvidenceRoute,
  FieldValue,
  Scalar,
  Truth,
} from "./types";
import { closed, oneOf, record } from "./validation";

export type {
  EvidenceError,
  EvidencePage,
  EvidenceResult,
  EvidenceRoute,
} from "./types";

const MAXIMUM_BODY_BYTES = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;
const timestampPattern =
  /^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{6}Z$/;
const tracePattern = /^[a-f0-9]{32}$/;
const spanPattern = /^[a-f0-9]{16}$/;

function scalar(value: unknown): value is Scalar {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      (!Number.isInteger(value) || Number.isSafeInteger(value)))
  );
}

function field(value: unknown): value is FieldValue {
  return (
    record(value) &&
    closed(value, ["field", "value"]) &&
    typeof value.field === "string" &&
    value.field.length > 0 &&
    scalar(value.value)
  );
}

function source(value: unknown) {
  if (!record(value) || typeof value.kind !== "string") return false;
  if (value.kind === "EVENT") {
    return (
      closed(value, ["kind", "event_id"]) &&
      typeof value.event_id === "string" &&
      value.event_id.length > 0
    );
  }
  return (
    value.kind === "SPAN" &&
    closed(value, ["kind", "trace_id", "span_id"]) &&
    typeof value.trace_id === "string" &&
    tracePattern.test(value.trace_id) &&
    typeof value.span_id === "string" &&
    spanPattern.test(value.span_id)
  );
}

function truth(value: unknown, trace: boolean): value is Truth {
  if (
    !record(value) ||
    !closed(value, ["completeness", "availability", "expiry", "expires_at"])
  )
    return false;
  const completeness = value.completeness;
  if (
    completeness !== null &&
    !oneOf(completeness, [
      "FINAL",
      "LOWER_BOUND",
      "NOT_APPLICABLE",
      "UNAVAILABLE",
    ] as const)
  ) {
    return false;
  }
  if (trace && completeness !== null) return false;
  if (!oneOf(value.availability, ["AVAILABLE", "UNAVAILABLE"] as const))
    return false;
  if (!oneOf(value.expiry, ["ACTIVE", "EXPIRED"] as const)) return false;
  if (
    value.expires_at !== null &&
    (typeof value.expires_at !== "string" ||
      !timestampPattern.test(value.expires_at))
  ) {
    return false;
  }
  if (value.expiry === "EXPIRED") return value.availability === "UNAVAILABLE";
  if (completeness === "UNAVAILABLE")
    return value.availability === "UNAVAILABLE";
  return value.availability === "AVAILABLE";
}

function endpoint(value: unknown) {
  return (
    record(value) &&
    closed(value, ["kind", "key"]) &&
    oneOf(value.kind, [
      "FINDING",
      "FINDING_TARGET",
      "FIX",
      "RECHECK",
      "ROLE",
      "ROLE_LINEAGE",
      "SPAN",
      "DELIVERY",
      "MODEL_ROLE",
    ] as const) &&
    Array.isArray(value.key) &&
    value.key.length >= 1 &&
    value.key.length <= 16 &&
    value.key.every(scalar)
  );
}

function relationship(value: unknown) {
  return (
    record(value) &&
    closed(value, ["kind", "from", "to"]) &&
    oneOf(value.kind, [
      "FINDING_TARGET",
      "FINDING_FIX",
      "FINDING_RECHECK",
      "ROLE_LINEAGE",
      "DELIVERY_ROOT",
      "MODEL_ATTRIBUTION",
    ] as const) &&
    endpoint(value.from) &&
    endpoint(value.to)
  );
}

function fact(value: unknown) {
  if (
    !record(value) ||
    !closed(value, [
      "id",
      "kind",
      "source",
      "recorded_at",
      "provenance",
      "compatibility",
      "truth",
      "fields",
      "relationships",
    ])
  ) {
    return false;
  }
  if (
    typeof value.id !== "string" ||
    !oneOf(value.kind, [
      "EVENT_CONTRIBUTION",
      "FINDING_ASSERTION",
      "FINDING_TARGET",
      "FINDING_STATUS",
      "FINDING_FIX",
      "FINDING_RECHECK",
      "ROLE_LINEAGE",
      "DELIVERY_ROOT_BINDING",
      "MODEL_ATTRIBUTION",
    ] as const) ||
    !source(value.source) ||
    typeof value.recorded_at !== "string" ||
    !timestampPattern.test(value.recorded_at) ||
    !truth(value.truth, false)
  ) {
    return false;
  }
  const provenance = value.provenance;
  const compatibility = value.compatibility;
  return (
    record(provenance) &&
    closed(provenance, [
      "accepted_digest",
      "profile_version",
      "family_schema",
      "owner_key",
    ]) &&
    typeof provenance.accepted_digest === "string" &&
    /^[a-f0-9]{64}$/.test(provenance.accepted_digest) &&
    provenance.profile_version === "1.0.0" &&
    (provenance.family_schema === null ||
      typeof provenance.family_schema === "string") &&
    Array.isArray(provenance.owner_key) &&
    provenance.owner_key.length >= 1 &&
    provenance.owner_key.length <= 16 &&
    provenance.owner_key.every(scalar) &&
    record(compatibility) &&
    closed(compatibility, [
      "family_schema",
      "event_name",
      "completeness",
      "dimensions",
    ]) &&
    compatibility.completeness === value.truth.completeness &&
    Array.isArray(compatibility.dimensions) &&
    compatibility.dimensions.length <= 16 &&
    compatibility.dimensions.every(field) &&
    Array.isArray(value.fields) &&
    value.fields.length <= 73 &&
    value.fields.every(field) &&
    Array.isArray(value.relationships) &&
    value.relationships.length <= 16 &&
    value.relationships.every(relationship)
  );
}

function traceEndpoint(value: unknown) {
  return (
    record(value) &&
    closed(value, ["trace_id", "span_id"]) &&
    typeof value.trace_id === "string" &&
    tracePattern.test(value.trace_id) &&
    typeof value.span_id === "string" &&
    spanPattern.test(value.span_id)
  );
}

function traceItem(value: unknown) {
  if (
    !record(value) ||
    !closed(value, [
      "id",
      "trace_id",
      "kind",
      "source",
      "recorded_at",
      "truth",
      "node",
      "edge",
    ]) ||
    typeof value.id !== "string" ||
    typeof value.trace_id !== "string" ||
    !tracePattern.test(value.trace_id) ||
    !oneOf(value.kind, ["NODE", "PARENT_EDGE", "LINK"] as const) ||
    !source(value.source) ||
    typeof value.recorded_at !== "string" ||
    !timestampPattern.test(value.recorded_at) ||
    !truth(value.truth, true)
  ) {
    return false;
  }
  if (value.kind === "NODE") {
    const node = value.node;
    return (
      value.edge === null &&
      record(node) &&
      closed(node, [
        "span_id",
        "span_name",
        "span_kind",
        "start_time_unix_nano",
        "end_time_unix_nano",
        "span_status",
        "span_flags",
        "trace_state",
        "fields",
      ]) &&
      typeof node.span_id === "string" &&
      spanPattern.test(node.span_id) &&
      typeof node.span_name === "string" &&
      oneOf(node.span_kind, ["INTERNAL", "CLIENT"] as const) &&
      typeof node.start_time_unix_nano === "string" &&
      /^\d+$/.test(node.start_time_unix_nano) &&
      typeof node.end_time_unix_nano === "string" &&
      /^\d+$/.test(node.end_time_unix_nano) &&
      oneOf(node.span_status, ["UNSET", "OK", "ERROR"] as const) &&
      Number.isInteger(node.span_flags) &&
      Array.isArray(node.fields) &&
      node.fields.every(field)
    );
  }
  const edge = value.edge;
  return (
    value.node === null &&
    record(edge) &&
    closed(
      edge,
      ["from", "to"],
      value.kind === "LINK" ? ["trace_state", "flags"] : [],
    ) &&
    traceEndpoint(edge.from) &&
    traceEndpoint(edge.to)
  );
}

function incompatible(reason: string): EvidenceResult {
  return { ok: false, error: { kind: "INCOMPATIBLE", reason } };
}

export function decodeEvidencePage(
  route: EvidenceRoute,
  input: unknown,
  requestedLimit: number,
): EvidenceResult {
  if (!record(input)) return incompatible("response must be an object");
  if (Object.hasOwn(input, "error")) {
    if (
      !closed(input, ["error"]) ||
      !record(input.error) ||
      !closed(input.error, ["code", "message"])
    ) {
      return incompatible("invalid error response");
    }
    if (
      !oneOf(input.error.code, [
        "INVALID_FILTER",
        "INVALID_CURSOR",
        "NOT_ACCEPTABLE",
        "CURSOR_MISMATCH",
        "CURSOR_EXPIRED",
        "QUERY_BOUND_EXCEEDED",
        "METHOD_NOT_ALLOWED",
        "ROUTE_NOT_FOUND",
        "QUERY_INTERNAL",
        "QUERY_UNAVAILABLE",
      ] as const) ||
      typeof input.error.message !== "string" ||
      input.error.message.length === 0
    ) {
      return incompatible("unknown upstream error");
    }
    return {
      ok: false,
      error: {
        kind: "UPSTREAM",
        code: input.error.code,
        message: input.error.message,
      },
    };
  }

  const common = [
    "contract",
    "observation_profile",
    "read_model_revision",
    "snapshot",
    "items",
    "next_cursor",
  ];
  const traceKeys = ["trace_state", "trace_summaries"];
  if (!closed(input, route === "traces" ? [...common, ...traceKeys] : common))
    return incompatible("unknown or missing response field");
  if (
    !record(input.contract) ||
    !closed(input.contract, ["name", "revision"]) ||
    input.contract.name !== "evidence.query" ||
    input.contract.revision !== "0.1.0" ||
    input.observation_profile !== "1.0.0" ||
    input.read_model_revision !== "1.0.0" ||
    typeof input.snapshot !== "string" ||
    input.snapshot.length === 0 ||
    !Array.isArray(input.items) ||
    input.items.length > requestedLimit ||
    input.items.length > 200 ||
    (input.next_cursor !== null && typeof input.next_cursor !== "string")
  ) {
    return incompatible("unsupported coordinate or envelope");
  }
  if (route === "facts" && !input.items.every(fact))
    return incompatible("invalid fact item");
  if (route === "traces") {
    if (!input.items.every(traceItem))
      return incompatible("invalid trace item");
    if (
      !oneOf(input.trace_state, [
        "ABSENT",
        "AVAILABLE",
        "PARTIAL",
        "EXPIRED",
      ] as const) ||
      !Array.isArray(input.trace_summaries) ||
      input.trace_summaries.length > 32 ||
      !input.trace_summaries.every(
        (summary) =>
          record(summary) &&
          closed(summary, ["trace_id", "state"]) &&
          typeof summary.trace_id === "string" &&
          tracePattern.test(summary.trace_id) &&
          oneOf(summary.state, ["AVAILABLE", "PARTIAL", "EXPIRED"] as const),
      )
    ) {
      return incompatible("invalid trace summary");
    }
  }
  return { ok: true, value: input as unknown as EvidencePage };
}

type QueryValue = string | number | boolean;

export interface EvidenceClientOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maximumBodyBytes?: number;
}

export class EvidenceClient {
  readonly #fetcher: typeof fetch;
  readonly #timeoutMs: number;
  readonly #maximumBodyBytes: number;

  constructor(options: EvidenceClientOptions = {}) {
    this.#fetcher = options.fetcher ?? fetch;
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maximumBodyBytes = options.maximumBodyBytes ?? MAXIMUM_BODY_BYTES;
  }

  async getPage(
    route: EvidenceRoute,
    filters: Readonly<Record<string, QueryValue>>,
  ): Promise<EvidenceResult> {
    const limit = typeof filters.limit === "number" ? filters.limit : 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200)
      return incompatible("limit must be between 1 and 200");
    const query = new URLSearchParams(
      Object.entries(filters)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, String(value)]),
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetcher(`/v1/evidence/${route}?${query}`, {
        method: "GET",
        credentials: "omit",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      const declaredLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > this.#maximumBodyBytes
      ) {
        return {
          ok: false,
          error: {
            kind: "RESPONSE_BOUND_EXCEEDED",
            maximumBytes: this.#maximumBodyBytes,
          },
        };
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > this.#maximumBodyBytes) {
        return {
          ok: false,
          error: {
            kind: "RESPONSE_BOUND_EXCEEDED",
            maximumBytes: this.#maximumBodyBytes,
          },
        };
      }
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return {
          ok: false,
          error: { kind: "ERROR", reason: "MALFORMED_BODY" },
        };
      }
      return decodeEvidencePage(route, body, limit);
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === "AbortError"
          ? "TIMEOUT"
          : "NETWORK";
      return { ok: false, error: { kind: "ERROR", reason } };
    } finally {
      clearTimeout(timeout);
    }
  }
}
