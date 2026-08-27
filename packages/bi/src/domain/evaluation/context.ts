import { CATALOG_COORDINATE, CATALOG_DIGEST } from "./catalog-binding";
import { closed, record } from "../evidence/validation";

type ContextScalar = string | number | boolean | null;

export interface EvaluationContext {
  schema: "wsr.bi.evaluation-context@1.0.0";
  context_id: string;
  context_version: string;
  content_digest: string;
  catalog_coordinate: typeof CATALOG_COORDINATE;
  catalog_semantic_digest: typeof CATALOG_DIGEST;
  as_of: string;
  tasks: Array<{
    task_id: string;
    delivery_ids: string[];
    cohort_coordinates: Array<{ key: string; value: ContextScalar }>;
    event_time_role_template?: { id: string; version: string; digest: string };
  }>;
}

export type ContextResult =
  | { ok: true; value: EvaluationContext }
  | {
      ok: false;
      error: { kind: "INCOMPATIBLE" | "DIGEST_MISMATCH"; reason: string };
    };

const timestampPattern =
  /^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{6}Z$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function scalar(value: unknown): value is ContextScalar {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" &&
      Number.isFinite(value) &&
      (!Number.isInteger(value) || Number.isSafeInteger(value)))
  );
}

export async function digestEvaluationContext(value: unknown) {
  if (!record(value))
    throw new TypeError("evaluation context must be an object");
  const digestInput = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "content_digest"),
  );
  const bytes = new TextEncoder().encode(canonical(digestInput));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function validTemplate(value: unknown) {
  return (
    record(value) &&
    closed(value, ["id", "version", "digest"]) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.version === "string" &&
    value.version.length > 0 &&
    typeof value.digest === "string" &&
    digestPattern.test(value.digest)
  );
}

function validTask(value: unknown) {
  if (
    !record(value) ||
    !closed(
      value,
      ["task_id", "delivery_ids", "cohort_coordinates"],
      ["event_time_role_template"],
    ) ||
    typeof value.task_id !== "string" ||
    value.task_id.length === 0 ||
    !Array.isArray(value.delivery_ids) ||
    !value.delivery_ids.every(
      (delivery) => typeof delivery === "string" && delivery.length > 0,
    ) ||
    new Set(value.delivery_ids).size !== value.delivery_ids.length ||
    !Array.isArray(value.cohort_coordinates)
  ) {
    return false;
  }
  const coordinatesValid = value.cohort_coordinates.every(
    (coordinate) =>
      record(coordinate) &&
      closed(coordinate, ["key", "value"]) &&
      typeof coordinate.key === "string" &&
      coordinate.key.length > 0 &&
      scalar(coordinate.value),
  );
  const coordinateKeys = value.cohort_coordinates
    .filter(record)
    .map((coordinate) => coordinate.key)
    .filter((key): key is string => typeof key === "string");
  return (
    coordinatesValid &&
    new Set(coordinateKeys).size === coordinateKeys.length &&
    (value.event_time_role_template === undefined ||
      validTemplate(value.event_time_role_template))
  );
}

function incompatible(reason: string): ContextResult {
  return { ok: false, error: { kind: "INCOMPATIBLE", reason } };
}

export async function decodeEvaluationContext(
  input: unknown,
): Promise<ContextResult> {
  if (
    !record(input) ||
    !closed(input, [
      "schema",
      "context_id",
      "context_version",
      "content_digest",
      "catalog_coordinate",
      "catalog_semantic_digest",
      "as_of",
      "tasks",
    ])
  ) {
    return incompatible("unknown or missing manifest field");
  }
  if (
    input.schema !== "wsr.bi.evaluation-context@1.0.0" ||
    input.catalog_coordinate !== CATALOG_COORDINATE ||
    input.catalog_semantic_digest !== CATALOG_DIGEST ||
    typeof input.context_id !== "string" ||
    input.context_id.length === 0 ||
    typeof input.context_version !== "string" ||
    input.context_version.length === 0 ||
    typeof input.content_digest !== "string" ||
    !digestPattern.test(input.content_digest) ||
    typeof input.as_of !== "string" ||
    !timestampPattern.test(input.as_of) ||
    !Array.isArray(input.tasks) ||
    !input.tasks.every(validTask)
  ) {
    return incompatible("unsupported coordinate or invalid manifest value");
  }
  const taskIds = input.tasks.filter(record).map((task) => task.task_id);
  const deliveryIds = input.tasks
    .filter(record)
    .flatMap((task) =>
      Array.isArray(task.delivery_ids) ? task.delivery_ids : [],
    );
  if (
    new Set(taskIds).size !== taskIds.length ||
    new Set(deliveryIds).size !== deliveryIds.length
  ) {
    return incompatible("task and Delivery identities must be unique");
  }
  const expectedDigest = await digestEvaluationContext(input);
  if (expectedDigest !== input.content_digest) {
    return {
      ok: false,
      error: {
        kind: "DIGEST_MISMATCH",
        reason: "content_digest does not bind the closed manifest",
      },
    };
  }
  return { ok: true, value: input as unknown as EvaluationContext };
}
