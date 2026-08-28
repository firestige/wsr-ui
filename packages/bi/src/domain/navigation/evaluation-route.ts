import { CATALOG_COORDINATES } from "../evolution/client";

const MAX_TASKS_PER_SIDE = 24;
const MAX_RELATIVE_URL_BYTES = 8 * 1024;
const taskIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;
const encoder = new TextEncoder();

type Focus = {
  metric: (typeof CATALOG_COORDINATES)[number];
  side: "single" | "left" | "right";
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

export function parseEvaluationRoute(relativeUrl: string): EvaluationRoute {
  if (encoder.encode(relativeUrl).length > MAX_RELATIVE_URL_BYTES)
    return { tag: "INVALID", reason: "URL_BOUND_EXCEEDED" };
  const url = new URL(relativeUrl, "http://bi.local");
  if (url.pathname !== "/evaluate" || url.hash !== "")
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
  if (mode !== null)
    return { tag: "INVALID", reason: "INVALID_MODE" };
  const selectedTaskIds = taskIds(params, "task");
  const routeFocus = focus(params, ["single"]);
  if (!selectedTaskIds || routeFocus === null)
    return { tag: "INVALID", reason: "INVALID_SINGLE_SELECTION" };
  return { tag: "SINGLE", taskIds: selectedTaskIds, focus: routeFocus };
}

export function serializeEvaluationRoute(route: EvaluationRoute): string {
  if (route.tag === "SELECT") return "/evaluate";
  if (route.tag === "INVALID") throw new Error("Cannot serialize invalid route");
  const params = new URLSearchParams({ v: "1" });
  if (route.tag === "SINGLE") {
    for (const taskId of route.taskIds) params.append("task", taskId);
  } else {
    params.set("mode", "compare");
    for (const taskId of route.leftTaskIds) params.append("left_task", taskId);
    for (const taskId of route.rightTaskIds) params.append("right_task", taskId);
  }
  if (route.focus) {
    params.set("metric", route.focus.metric);
    params.set("side", route.focus.side);
  }
  return `/evaluate?${params.toString()}`;
}
