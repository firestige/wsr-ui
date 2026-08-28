import { describe, expect, it } from "vitest";

import { parseEvaluationRoute, serializeEvaluationRoute } from "./evaluation-route";

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

  it("keeps an empty evaluate route as the explicit selection state", () => {
    expect(parseEvaluationRoute("/evaluate")).toEqual({ tag: "SELECT" });
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
