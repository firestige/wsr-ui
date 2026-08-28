import { describe, expect, it } from "vitest";

import {
  parseEvaluationRoute,
  serializeEvaluationRoute,
} from "./evaluation-route";

describe("evaluation route identity", () => {
  it("canonicalizes a single selection without changing Task identity", () => {
    const parsed = parseEvaluationRoute(
      "/evaluate?v=1&task=task-z&task=task-a&metric=delivery-cycle-time-ms%402.0.0&side=single",
    );

    expect(parsed).toEqual({
      tag: "SINGLE",
      taskIds: ["task-a", "task-z"],
      focus: {
        metric: "delivery-cycle-time-ms@2.0.0",
        side: "single",
      },
    });
    expect(serializeEvaluationRoute(parsed)).toBe(
      "/evaluate?v=1&task=task-a&task=task-z&metric=delivery-cycle-time-ms%402.0.0&side=single",
    );
  });

  it("round-trips a compare selection with independent sides", () => {
    const parsed = parseEvaluationRoute(
      "/evaluate?v=1&mode=compare&left_task=task-b&left_task=task-a&right_task=task-c",
    );

    expect(parsed).toEqual({
      tag: "COMPARE",
      leftTaskIds: ["task-a", "task-b"],
      rightTaskIds: ["task-c"],
      focus: undefined,
    });
    expect(serializeEvaluationRoute(parsed)).toBe(
      "/evaluate?v=1&mode=compare&left_task=task-a&left_task=task-b&right_task=task-c",
    );
  });

  it("canonicalizes UI-origin selections and rejects serialized over-budget URLs", () => {
    expect(
      serializeEvaluationRoute({
        tag: "SINGLE",
        taskIds: ["task-z", "task-a"],
      }),
    ).toBe("/evaluate?v=1&task=task-a&task=task-z");
    const long = Array.from(
      { length: 24 },
      (_, index) => `task-${index}-${"/".repeat(116)}`,
    );
    expect(() =>
      serializeEvaluationRoute({
        tag: "COMPARE",
        leftTaskIds: long,
        rightTaskIds: long.map((value) => value.replace("task-", "other-")),
      }),
    ).toThrow("URL_BOUND_EXCEEDED");
  });

  it("keeps an empty evaluate route as the explicit selection state", () => {
    expect(parseEvaluationRoute("/evaluate")).toEqual({ tag: "SELECT" });
  });

  it("round-trips an Evidence Console drill-down with exact Fact focus", () => {
    const parsed = parseEvaluationRoute(
      "/evaluate/evidence?v=1&task=task-a&metric=delivery-cycle-time-ms%402.0.0&side=single&scope=result&fact=fact-1",
    );
    expect(parsed).toEqual({
      tag: "EVIDENCE",
      selection: { tag: "SINGLE", taskIds: ["task-a"] },
      metric: "delivery-cycle-time-ms@2.0.0",
      side: "single",
      scope: "result",
      factId: "fact-1",
    });
    expect(serializeEvaluationRoute(parsed)).toBe(
      "/evaluate/evidence?v=1&task=task-a&metric=delivery-cycle-time-ms%402.0.0&side=single&scope=result&fact=fact-1",
    );
  });

  it("round-trips a Trace deep-link without assigning causal order", () => {
    const parsed = parseEvaluationRoute(
      "/evaluate/trace/trace-1?v=1&mode=compare&left_task=task-a&right_task=task-b&span=span-2&side=left",
    );
    expect(parsed).toEqual({
      tag: "TRACE",
      selection: {
        tag: "COMPARE",
        leftTaskIds: ["task-a"],
        rightTaskIds: ["task-b"],
      },
      traceId: "trace-1",
      spanId: "span-2",
      side: "left",
    });
    expect(serializeEvaluationRoute(parsed)).toBe(
      "/evaluate/trace/trace-1?v=1&mode=compare&left_task=task-a&right_task=task-b&span=span-2&side=left",
    );
  });

  it.each([
    "/evaluate?v=2&task=task-a",
    "/evaluate?v=1&task=task-a&task=task-a",
    "/evaluate?v=1&task=task-a,task-b",
    "/evaluate?v=1&task=task-a&unknown=value",
    "/evaluate?v=1&task=task-a&metric=metric%402.0.0",
    "/evaluate?v=1&mode=compare&left_task=task-a",
    "/evaluate?v=1&mode=compare&left_task=task-a&right_task=task-b&side=single&metric=metric%402.0.0",
  ])("fails closed for %s", (url) => {
    expect(parseEvaluationRoute(url)).toMatchObject({ tag: "INVALID" });
  });

  it("rejects selections above the per-side and URL bounds", () => {
    const tasks = Array.from({ length: 25 }, (_, index) => `task-${index}`)
      .map((task) => `task=${task}`)
      .join("&");
    expect(parseEvaluationRoute(`/evaluate?v=1&${tasks}`)).toMatchObject({
      tag: "INVALID",
    });
    expect(
      parseEvaluationRoute(`/evaluate?v=1&task=${"a".repeat(8_200)}`),
    ).toMatchObject({ tag: "INVALID" });
  });
});
