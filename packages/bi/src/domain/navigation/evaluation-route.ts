import { CATALOG_COORDINATES } from "../evolution/client";

const MAX_TASKS_PER_SIDE = 24;
const MAX_RELATIVE_URL_BYTES = 8 * 1024;
const taskIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;
const encoder = new TextEncoder();

type Focus = {
  metric: (typeof CATALOG_COORDINATES)[number];
  side: "single" | "left" | "right";
};

type Selection =
  | { tag: "SINGLE"; taskIds: string[] }
  | {
      tag: "COMPARE";
      leftTaskIds: string[];
      rightTaskIds: string[];
    };

export type EvaluationRoute =
  | { tag: "SELECT" }
  | { tag: "SINGLE"; taskIds: string[]; focus?: Focus }
  | {
      tag: "COMPARE";
      leftTaskIds: string[];
      rightTaskIds: string[];
      focus?: Focus;
    }
  | {
      tag: "EVIDENCE";
      selection: Selection;
      metric: Focus["metric"];
      side: Focus["side"];
      scope: "result" | "related" | "read-set";
      factId?: string;
    }
  | {
      tag: "TRACE";
      selection: Selection;
      traceId: string;
      spanId?: string;
      side: Focus["side"];
      metric: Focus["metric"];
      scope: "result" | "related" | "read-set";
      factId?: string;
    }
  | { tag: "INVALID"; reason: string };

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

function taskIds(params: URLSearchParams, key: string): string[] | undefined {
  const values = params.getAll(key);
  if (
    values.length < 1 ||
    values.length > MAX_TASKS_PER_SIDE ||
    values.some((value) => !taskIdPattern.test(value)) ||
    new Set(values).size !== values.length
  )
    return undefined;
  return values.toSorted(bytewiseCompare);
}

function canonicalTaskIds(values: readonly string[]): string[] {
  if (
    values.length < 1 ||
    values.length > MAX_TASKS_PER_SIDE ||
    values.some((value) => !taskIdPattern.test(value)) ||
    new Set(values).size !== values.length
  )
    throw new Error("INVALID_TASK_SELECTION");
  return [...values].sort(bytewiseCompare);
}

function boundedUrl(value: string): string {
  if (encoder.encode(value).length > MAX_RELATIVE_URL_BYTES)
    throw new Error("URL_BOUND_EXCEEDED");
  return value;
}

function focus(
  params: URLSearchParams,
  allowedSides: readonly Focus["side"][],
): Focus | undefined | null {
  const metric = params.get("metric");
  const side = params.get("side");
  if (metric === null && side === null) return undefined;
  if (
    metric === null ||
    side === null ||
    !CATALOG_COORDINATES.includes(
      metric as (typeof CATALOG_COORDINATES)[number],
    ) ||
    !allowedSides.includes(side as Focus["side"])
  )
    return null;
  return { metric: metric as Focus["metric"], side: side as Focus["side"] };
}

function identifier(value: string | null): string | undefined {
  if (
    value === null ||
    value.length < 1 ||
    value.length > 256 ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  )
    return undefined;
  return value;
}

function decodedPathIdentifier(value: string): string | undefined {
  try {
    return identifier(decodeURIComponent(value));
  } catch {
    return undefined;
  }
}

function selection(
  params: URLSearchParams,
):
  { selection: Selection; allowedSides: readonly Focus["side"][] } | undefined {
  const mode = params.get("mode");
  if (mode === "compare") {
    const leftTaskIds = taskIds(params, "left_task");
    const rightTaskIds = taskIds(params, "right_task");
    if (!leftTaskIds || !rightTaskIds) return undefined;
    return {
      selection: { tag: "COMPARE", leftTaskIds, rightTaskIds },
      allowedSides: ["left", "right"],
    };
  }
  if (mode !== null) return undefined;
  const selectedTaskIds = taskIds(params, "task");
  if (!selectedTaskIds) return undefined;
  return {
    selection: { tag: "SINGLE", taskIds: selectedTaskIds },
    allowedSides: ["single"],
  };
}

function hasOnlyParameters(
  params: URLSearchParams,
  allowed: ReadonlySet<string>,
): boolean {
  return (
    ![...params.keys()].some((key) => !allowed.has(key)) &&
    params.getAll("v").length === 1 &&
    params.get("v") === "1" &&
    params.getAll("mode").length <= 1 &&
    [...allowed].every((key) =>
      ["task", "left_task", "right_task"].includes(key)
        ? true
        : params.getAll(key).length <= 1,
    )
  );
}

export function parseEvaluationRoute(relativeUrl: string): EvaluationRoute {
  if (encoder.encode(relativeUrl).length > MAX_RELATIVE_URL_BYTES)
    return { tag: "INVALID", reason: "URL_BOUND_EXCEEDED" };
  const url = new URL(relativeUrl, "http://bi.local");
  if (url.hash !== "") return { tag: "INVALID", reason: "UNKNOWN_ROUTE" };
  if (url.pathname === "/evaluate/evidence") {
    const params = url.searchParams;
    const allowed = new Set([
      "v",
      "mode",
      "task",
      "left_task",
      "right_task",
      "metric",
      "side",
      "scope",
      "fact",
    ]);
    const selected = selection(params);
    const routeFocus = selected ? focus(params, selected.allowedSides) : null;
    const scope = params.get("scope");
    const factValue = params.get("fact");
    const factId = factValue === null ? undefined : identifier(factValue);
    if (
      !hasOnlyParameters(params, allowed) ||
      !selected ||
      !routeFocus ||
      !["result", "related", "read-set"].includes(scope ?? "") ||
      (factValue !== null && factId === undefined)
    )
      return { tag: "INVALID", reason: "INVALID_EVIDENCE_FOCUS" };
    return {
      tag: "EVIDENCE",
      selection: selected.selection,
      metric: routeFocus.metric,
      side: routeFocus.side,
      scope: scope as "result" | "related" | "read-set",
      factId,
    };
  }
  if (url.pathname.startsWith("/evaluate/trace/")) {
    const params = url.searchParams;
    const traceId = decodedPathIdentifier(
      url.pathname.slice("/evaluate/trace/".length),
    );
    const allowed = new Set([
      "v",
      "mode",
      "task",
      "left_task",
      "right_task",
      "span",
      "side",
      "metric",
      "scope",
      "fact",
    ]);
    const selected = selection(params);
    const routeFocus = selected ? focus(params, selected.allowedSides) : null;
    const scope = params.get("scope");
    const factValue = params.get("fact");
    const factId = factValue === null ? undefined : identifier(factValue);
    const spanValue = params.get("span");
    const spanId =
      spanValue !== null && /^[a-f0-9]{16}$/.test(spanValue)
        ? spanValue
        : undefined;
    if (
      !hasOnlyParameters(params, allowed) ||
      !selected ||
      traceId === undefined ||
      !/^[a-f0-9]{32}$/.test(traceId) ||
      !routeFocus ||
      !["result", "related", "read-set"].includes(scope ?? "") ||
      (factValue !== null && factId === undefined) ||
      (spanValue !== null && spanId === undefined)
    )
      return { tag: "INVALID", reason: "INVALID_TRACE_FOCUS" };
    return {
      tag: "TRACE",
      selection: selected.selection,
      traceId,
      spanId,
      side: routeFocus.side,
      metric: routeFocus.metric,
      scope: scope as "result" | "related" | "read-set",
      factId,
    };
  }
  if (url.pathname !== "/evaluate")
    return { tag: "INVALID", reason: "UNKNOWN_ROUTE" };
  if (url.search === "") return { tag: "SELECT" };
  const params = url.searchParams;
  const mode = params.get("mode");
  const allowed = new Set(
    mode === "compare"
      ? ["v", "mode", "left_task", "right_task", "metric", "side"]
      : ["v", "task", "metric", "side"],
  );
  if (
    [...params.keys()].some((key) => !allowed.has(key)) ||
    params.getAll("v").length !== 1 ||
    params.get("v") !== "1" ||
    params.getAll("mode").length > 1 ||
    params.getAll("metric").length > 1 ||
    params.getAll("side").length > 1
  )
    return { tag: "INVALID", reason: "INVALID_PARAMETERS" };

  if (mode === "compare") {
    const leftTaskIds = taskIds(params, "left_task");
    const rightTaskIds = taskIds(params, "right_task");
    const routeFocus = focus(params, ["left", "right"]);
    if (!leftTaskIds || !rightTaskIds || routeFocus === null)
      return { tag: "INVALID", reason: "INVALID_COMPARE_SELECTION" };
    return { tag: "COMPARE", leftTaskIds, rightTaskIds, focus: routeFocus };
  }
  if (mode !== null) return { tag: "INVALID", reason: "INVALID_MODE" };
  const selectedTaskIds = taskIds(params, "task");
  const routeFocus = focus(params, ["single"]);
  if (!selectedTaskIds || routeFocus === null)
    return { tag: "INVALID", reason: "INVALID_SINGLE_SELECTION" };
  return { tag: "SINGLE", taskIds: selectedTaskIds, focus: routeFocus };
}

export function serializeEvaluationRoute(route: EvaluationRoute): string {
  if (route.tag === "SELECT") return "/evaluate";
  if (route.tag === "INVALID")
    throw new Error("Cannot serialize invalid route");
  const params = new URLSearchParams({ v: "1" });
  const selected =
    route.tag === "EVIDENCE" || route.tag === "TRACE" ? route.selection : route;
  if (selected.tag === "SINGLE") {
    for (const taskId of canonicalTaskIds(selected.taskIds))
      params.append("task", taskId);
  } else {
    params.set("mode", "compare");
    for (const taskId of canonicalTaskIds(selected.leftTaskIds))
      params.append("left_task", taskId);
    for (const taskId of canonicalTaskIds(selected.rightTaskIds))
      params.append("right_task", taskId);
  }
  if (route.tag === "EVIDENCE") {
    params.set("metric", route.metric);
    params.set("side", route.side);
    params.set("scope", route.scope);
    if (route.factId) params.set("fact", route.factId);
    return boundedUrl(`/evaluate/evidence?${params.toString()}`);
  }
  if (route.tag === "TRACE") {
    if (route.spanId) params.set("span", route.spanId);
    params.set("metric", route.metric);
    params.set("side", route.side);
    params.set("scope", route.scope);
    if (route.factId) params.set("fact", route.factId);
    return boundedUrl(
      `/evaluate/trace/${encodeURIComponent(route.traceId)}?${params.toString()}`,
    );
  }
  if (route.focus) {
    params.set("metric", route.focus.metric);
    params.set("side", route.focus.side);
  }
  return boundedUrl(`/evaluate?${params.toString()}`);
}
