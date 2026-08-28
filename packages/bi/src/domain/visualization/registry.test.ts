import { describe, expect, it } from "vitest";

import type { MetricSlice } from "../evolution/types";
import { compatibleVisualizerIds, VISUALIZER_REGISTRY } from "./registry";

const ratioSlice: MetricSlice = {
  slice_key: {},
  state: "AVAILABLE",
  value: { kind: "RATIO", value: "1/3", unit: "ratio" },
  measures: {},
  coverage: {
    numerator: "1",
    denominator: "1",
    raw_ratio: "1",
    state: "FULL",
    alert: null,
  },
  compatibility: {},
  exclusions: [],
  missing_inputs: [],
  provenance_refs: [],
};

describe("closed visualizer registry", () => {
  it("declares the bounded tool vocabulary and presentation transforms", () => {
    expect(Object.keys(VISUALIZER_REGISTRY)).toEqual([
      "numeric-card@1",
      "badge@1",
      "ratio-bar@1",
      "gauge@1",
      "bar@1",
      "line@1",
      "table@1",
      "radar@1",
    ]);
    expect(VISUALIZER_REGISTRY["ratio-bar@1"].transforms).toEqual([
      "RATIO_TO_PERCENT",
      "SCALE_LAYOUT",
    ]);
  });

  it("offers only tools compatible with the authoritative Result shape", () => {
    expect(compatibleVisualizerIds(ratioSlice)).toEqual([
      "numeric-card@1",
      "ratio-bar@1",
      "table@1",
    ]);
  });

  it("does not infer a gauge, line, bar, or radar domain from current values", () => {
    expect(
      compatibleVisualizerIds(ratioSlice, {
        authoritativeDomain: false,
        orderedDimension: false,
        sharedNormalizedDomain: false,
      }),
    ).not.toEqual(
      expect.arrayContaining(["gauge@1", "bar@1", "line@1", "radar@1"]),
    );
  });

  it("offers bounded domain-based tools only when their descriptors exist", () => {
    expect(
      compatibleVisualizerIds(ratioSlice, {
        authoritativeDomain: true,
        orderedDimension: true,
        sharedNormalizedDomain: true,
      }),
    ).toEqual([
      "numeric-card@1",
      "ratio-bar@1",
      "gauge@1",
      "bar@1",
      "line@1",
      "table@1",
      "radar@1",
    ]);
  });

  it("keeps a table fallback when truth withholds the value", () => {
    expect(
      compatibleVisualizerIds({
        ...ratioSlice,
        state: "UNAVAILABLE",
        value: undefined,
        withholding_reason: "MISSING_INPUT",
      }),
    ).toEqual(["numeric-card@1", "table@1"]);
  });
});
