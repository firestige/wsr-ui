import type {
  EvidencePage,
  EvidenceResult,
  EvidenceRoute,
  FactsPage,
  FieldValue,
  Scalar,
  TracesPage,
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
const unsignedNanoPattern = /^(?:0|[1-9][0-9]{0,19})$/;
const utf8Encoder = new TextEncoder();
const profileFieldOrder = new Map(
  `agentops.delivery.id agentops.task.id agentops.workflow.id agentops.workflow.version agentops.implementation.id agentops.runtime.id agentops.manifest.digest agentops.workflow.family agentops.event.id agentops.delivery.outcome agentops.summary.state agentops.review.id agentops.review.lens agentops.review.scope agentops.review.severity agentops.review.total agentops.review.observed.count agentops.finding.id agentops.finding.status agentops.source.review.id agentops.fix.id agentops.fix.finding.id agentops.recheck.id agentops.recheck.review.id agentops.recheck.finding.id agentops.recheck.fix.id agentops.iteration.id agentops.artifact.id agentops.artifact.digest agentops.role.id agentops.role.lineage.id agentops.parent.role.id agentops.writer.role.id agentops.reviewer.role.id agentops.recheck.role.id agentops.writer.invocation.id agentops.reviewer.invocation.id agentops.recheck.invocation.id agentops.intervention.kind agentops.observed.loop.count agentops.observed.intervention.count agentops.usage.kind agentops.usage.unit agentops.usage.source agentops.usage.source.id agentops.usage.value agentops.sampling.decision agentops.sampling.probability agentops.family.schema agentops.finding.summary agentops.finding.scope.id agentops.finding.target.kind agentops.finding.target.id agentops.finding.target.artifact.id agentops.delivery.elapsed_time_ms agentops.delivery.stage.reached agentops.model.id agentops.test.passed agentops.test.failed agentops.test.skipped agentops.test.duration.seconds agentops.coverage.dimension agentops.coverage.covered agentops.coverage.total agentops.coverage.scope agentops.coverage.tool.id agentops.coverage.format agentops.fresh_reader.result agentops.fresh_reader.finding.count agentops.verification.id agentops.verification.result agentops.verification.check.passed agentops.verification.check.failed`
    .split(" ")
    .map((name, index) => [name, index] as const),
);
const standardFields = new Set([
  "error.type",
  "gen_ai.agent.id",
  "gen_ai.agent.name",
  "gen_ai.agent.version",
  "gen_ai.operation.name",
  "gen_ai.provider.name",
  "gen_ai.request.model",
  "gen_ai.response.model",
  "gen_ai.tool.call.id",
  "gen_ai.tool.name",
  "gen_ai.tool.type",
  "gen_ai.usage.input_tokens",
  "gen_ai.usage.output_tokens",
]);

function bytewiseCompare(left: string, right: string): number {
  const leftBytes = utf8Encoder.encode(left);
  const rightBytes = utf8Encoder.encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftBytes[index]! - rightBytes[index]!;
    if (difference !== 0) return difference;
  }
  return leftBytes.length - rightBytes.length;
}

function boundedText(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === "string" &&
    value.length >= minimum &&
    utf8Encoder.encode(value).byteLength <= maximum
  );
}

function uint32(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 4_294_967_295
  );
}

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

function uniqueFields(value: unknown): value is FieldValue[] {
  return (
    Array.isArray(value) &&
    value.every(field) &&
    new Set(value.map((item) => item.field)).size === value.length
  );
}

function orderedFields(value: unknown): value is FieldValue[] {
  if (!uniqueFields(value)) return false;
  const order = (name: string) => profileFieldOrder.get(name) ?? 1_000;
  if (
    value.some(
      (item) =>
        !profileFieldOrder.has(item.field) && !standardFields.has(item.field),
    )
  )
    return false;
  return value.every((item, index) => {
    const previous = value[index - 1];
    if (previous === undefined) return true;
    const difference = order(previous.field) - order(item.field);
    return (
      difference < 0 ||
      (difference === 0 && bytewiseCompare(previous.field, item.field) < 0)
    );
  });
}

function orderedDimensions(
  kind: string,
  eventName: unknown,
  dimensions: unknown,
): dimensions is FieldValue[] {
  if (!uniqueFields(dimensions)) return false;
  const expected =
    kind === "MODEL_ATTRIBUTION"
      ? [
          "gen_ai.provider.name",
          "agentops.model.id",
          "agentops.role.id",
          "agentops.runtime.id",
        ]
      : eventName === "usage"
        ? [
            "agentops.usage.kind",
            "agentops.usage.unit",
            "agentops.usage.source",
            "agentops.usage.source.id",
          ]
        : eventName === "implementation.summary"
          ? [
              "agentops.coverage.dimension",
              "agentops.coverage.scope",
              "agentops.coverage.tool.id",
              "agentops.coverage.format",
            ]
          : eventName === "test.summary"
            ? ["agentops.artifact.id", "agentops.artifact.digest"]
            : eventName === "review.summary" || kind === "FINDING_ASSERTION"
              ? ["agentops.review.lens", "agentops.review.scope"]
              : [];
  let cursor = -1;
  return dimensions.every((item) => {
    const index = expected.indexOf(item.field, cursor + 1);
    if (index < 0) return false;
    cursor = index;
    return true;
  });
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
    !boundedText(value.id, 1, 8192) ||
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
    (compatibility.family_schema === null ||
      typeof compatibility.family_schema === "string") &&
    (compatibility.event_name === null ||
      typeof compatibility.event_name === "string") &&
    compatibility.completeness === value.truth.completeness &&
    Array.isArray(compatibility.dimensions) &&
    compatibility.dimensions.length <= 16 &&
    orderedDimensions(
      value.kind as string,
      compatibility.event_name,
      compatibility.dimensions,
    ) &&
    Array.isArray(value.fields) &&
    value.fields.length <= 73 &&
    orderedFields(value.fields) &&
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
    !boundedText(value.id, 1, 8192) ||
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
      boundedText(node.span_name, 1, 128) &&
      oneOf(node.span_kind, ["INTERNAL", "CLIENT"] as const) &&
      typeof node.start_time_unix_nano === "string" &&
      unsignedNanoPattern.test(node.start_time_unix_nano) &&
      typeof node.end_time_unix_nano === "string" &&
      unsignedNanoPattern.test(node.end_time_unix_nano) &&
      oneOf(node.span_status, ["UNSET", "OK", "ERROR"] as const) &&
      uint32(node.span_flags) &&
      (node.trace_state === null || boundedText(node.trace_state, 0, 512)) &&
      Array.isArray(node.fields) &&
      node.fields.length <= 73 &&
      orderedFields(node.fields)
    );
  }
  const edge = value.edge;
  if (!(
    value.node === null &&
    record(edge) &&
    closed(
      edge,
      ["from", "to"],
      value.kind === "LINK" ? ["trace_state", "flags"] : [],
    ) &&
    traceEndpoint(edge.from) &&
    traceEndpoint(edge.to)
  ))
    return false;
  if (value.kind === "PARENT_EDGE") return true;
  return (
    (!Object.hasOwn(edge, "trace_state") ||
      boundedText(edge.trace_state, 0, 512)) &&
    (!Object.hasOwn(edge, "flags") || uint32(edge.flags))
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
  if (route === "facts") {
    const items = input.items as Array<{
      recorded_at: string;
      kind: string;
      id: string;
    }>;
    if (
      items.some((item, index) => {
        const previous = items[index - 1];
        if (previous === undefined) return false;
        const left = [previous.recorded_at, previous.kind, previous.id];
        const right = [item.recorded_at, item.kind, item.id];
        for (let part = 0; part < left.length; part += 1) {
          const order = bytewiseCompare(left[part]!, right[part]!);
          if (order !== 0) return order >= 0;
        }
        return true;
      })
    )
      return incompatible("Fact items are not uniquely ordered");
  }
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
    const kindOrder = { NODE: 0, PARENT_EDGE: 1, LINK: 2 } as const;
    const traceItems = input.items as Array<{
      trace_id: string;
      kind: keyof typeof kindOrder;
      id: string;
    }>;
    if (
      traceItems.some((item, index) => {
        const previous = traceItems[index - 1];
        if (previous === undefined) return false;
        const traceOrder = bytewiseCompare(previous.trace_id, item.trace_id);
        if (traceOrder !== 0) return traceOrder >= 0;
        const typeOrder = kindOrder[previous.kind] - kindOrder[item.kind];
        return typeOrder === 0
          ? bytewiseCompare(previous.id, item.id) >= 0
          : typeOrder > 0;
      })
    )
      return incompatible("Trace items are not uniquely ordered");
    const summaryIds = (
      input.trace_summaries as Array<{ trace_id: string }>
    ).map((item) => item.trace_id);
    if (
      summaryIds.some(
        (item, index) =>
          index > 0 && bytewiseCompare(summaryIds[index - 1]!, item) >= 0,
      )
    )
      return incompatible("Trace summaries are not uniquely ordered");
    const summaries = input.trace_summaries as Array<{ state: string }>;
    const expectedState =
      summaries.length === 0
        ? "ABSENT"
        : summaries.every((item) => item.state === "EXPIRED")
          ? "EXPIRED"
          : summaries.every((item) => item.state === "AVAILABLE")
            ? "AVAILABLE"
            : "PARTIAL";
    if (input.trace_state !== expectedState)
      return incompatible("trace state does not aggregate summaries");
    if (
      (input.trace_state === "ABSENT" || input.trace_state === "EXPIRED") &&
      (input.items.length !== 0 || input.next_cursor !== null)
    )
      return incompatible("absent or expired trace traversal must be empty");
  }
  return { ok: true, value: input as unknown as EvidencePage };
}

type FactKind = FactsPage["items"][number]["kind"];
type EventName =
  | "delivery.summary"
  | "review.finding"
  | "review.summary"
  | "test.summary"
  | "intervention"
  | "role.lineage"
  | "usage"
  | "sampling.decision"
  | "implementation.summary"
  | "system_design.summary";
type CommonFilters = { limit?: number; cursor?: string };
export type FactsFilters = CommonFilters & {
  kind?: FactKind;
  event_name?: EventName;
  family_schema?: string;
  delivery_id?: string;
  trace_id?: string;
  recorded_from?: string;
  recorded_to?: string;
};
export type TracesFilters = CommonFilters &
  (
    | { trace_id: string; delivery_id?: never }
    | { delivery_id: string; trace_id?: never }
  );
type QueryValue = string | number;

function requestTimestamp(value: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value))
    return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function validFilters(
  route: EvidenceRoute,
  filters: Readonly<Record<string, QueryValue>>,
): boolean {
  const allowed =
    route === "facts"
      ? new Set([
          "kind",
          "event_name",
          "family_schema",
          "delivery_id",
          "trace_id",
          "recorded_from",
          "recorded_to",
          "limit",
          "cursor",
        ])
      : new Set(["trace_id", "delivery_id", "limit", "cursor"]);
  if (Object.keys(filters).some((key) => !allowed.has(key))) return false;
  const texts = Object.entries(filters).filter(([key]) => key !== "limit");
  if (
    texts.some(
      ([, value]) =>
        typeof value !== "string" ||
        value.length === 0 ||
        /[\x00-\x1f,*%\\]/.test(value),
    )
  )
    return false;
  if (
    typeof filters.trace_id === "string" &&
    !tracePattern.test(filters.trace_id)
  )
    return false;
  if (
    typeof filters.delivery_id === "string" &&
    !boundedText(filters.delivery_id, 1, 256)
  )
    return false;
  if (route === "traces")
    return (
      (filters.trace_id === undefined) !== (filters.delivery_id === undefined)
    );
  if (
    filters.kind !== undefined &&
    !oneOf(filters.kind, [
      "EVENT_CONTRIBUTION",
      "FINDING_ASSERTION",
      "FINDING_TARGET",
      "FINDING_STATUS",
      "FINDING_FIX",
      "FINDING_RECHECK",
      "ROLE_LINEAGE",
      "DELIVERY_ROOT_BINDING",
      "MODEL_ATTRIBUTION",
    ] as const)
  )
    return false;
  if (
    filters.event_name !== undefined &&
    (!oneOf(filters.event_name, [
      "delivery.summary",
      "review.finding",
      "review.summary",
      "test.summary",
      "intervention",
      "role.lineage",
      "usage",
      "sampling.decision",
      "implementation.summary",
      "system_design.summary",
    ] as const) ||
      (filters.kind !== undefined && filters.kind !== "EVENT_CONTRIBUTION"))
  )
    return false;
  if (
    filters.family_schema !== undefined &&
    !boundedText(filters.family_schema, 1, 128)
  )
    return false;
  const from =
    typeof filters.recorded_from === "string"
      ? requestTimestamp(filters.recorded_from)
      : undefined;
  const to =
    typeof filters.recorded_to === "string"
      ? requestTimestamp(filters.recorded_to)
      : undefined;
  if (
    (filters.recorded_from !== undefined && from === undefined) ||
    (filters.recorded_to !== undefined && to === undefined) ||
    (from !== undefined &&
      to !== undefined &&
      (from > to || to - from > 366 * 86_400_000))
  )
    return false;
  return true;
}

export interface EvidenceClientOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maximumBodyBytes?: number;
}

async function readBoundedBody(
  response: Response,
  maximumBytes: number,
): Promise<EvidenceResult<Uint8Array>> {
  const reader = response.body?.getReader();
  if (reader === undefined) return { ok: true, value: new Uint8Array() };
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      length += item.value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel("Evidence response exceeded configured byte bound");
        return {
          ok: false,
          error: { kind: "RESPONSE_BOUND_EXCEEDED", maximumBytes },
        };
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: bytes };
}

const upstreamStatus: Record<string, number> = {
  INVALID_FILTER: 400,
  INVALID_CURSOR: 400,
  NOT_ACCEPTABLE: 406,
  CURSOR_MISMATCH: 409,
  CURSOR_EXPIRED: 410,
  QUERY_BOUND_EXCEEDED: 413,
  METHOD_NOT_ALLOWED: 405,
  ROUTE_NOT_FOUND: 404,
  QUERY_INTERNAL: 500,
  QUERY_UNAVAILABLE: 503,
};

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
    route: "facts",
    filters: FactsFilters,
  ): Promise<EvidenceResult<FactsPage>>;
  async getPage(
    route: "traces",
    filters: TracesFilters,
  ): Promise<EvidenceResult<TracesPage>>;
  async getPage(
    route: EvidenceRoute,
    filters: FactsFilters | TracesFilters,
  ): Promise<EvidenceResult> {
    const rawFilters = filters as Readonly<Record<string, QueryValue>>;
    const limit = typeof filters.limit === "number" ? filters.limit : 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200)
      return incompatible("limit must be between 1 and 200");
    if (!validFilters(route, rawFilters))
      return incompatible("filters are not valid for this Evidence route");
    const query = new URLSearchParams(
      Object.entries(rawFilters)
        .sort(([left], [right]) => bytewiseCompare(left, right))
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
      const contentType = response.headers.get("content-type");
      if (
        contentType?.split(";", 1)[0]?.trim().toLowerCase() !==
        "application/json"
      )
        return incompatible("response content type must be application/json");
      const bounded = await readBoundedBody(response, this.#maximumBodyBytes);
      if (!bounded.ok) return bounded;
      let body: unknown;
      try {
        body = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bounded.value),
        );
      } catch {
        return {
          ok: false,
          error: { kind: "ERROR", reason: "MALFORMED_BODY" },
        };
      }
      const decoded = decodeEvidencePage(route, body, limit);
      if (response.ok) {
        if (!decoded.ok && decoded.error.kind === "UPSTREAM")
          return incompatible("HTTP success carried an error envelope");
        return decoded;
      }
      if (decoded.ok || decoded.error.kind !== "UPSTREAM")
        return incompatible("HTTP error lacked a valid error envelope");
      if (upstreamStatus[decoded.error.code] !== response.status)
        return incompatible("HTTP status does not match Evidence error code");
      return decoded;
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
