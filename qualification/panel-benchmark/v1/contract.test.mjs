import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateRun,
  nearestRank,
  validateCompleteResult,
} from "./contract.mjs";

test("nearest-rank selects ceil(P*N)-1 without interpolating", () => {
  const values = Array.from({ length: 30 }, (_, index) => index + 1);
  assert.equal(nearestRank(values, 0.5), 15);
  assert.equal(nearestRank(values, 0.95), 29);
});

test("a run fails closed on any applicable budget violation", () => {
  const samples = Array.from({ length: 30 }, (_, index) => ({
    firstPaintMs: index === 28 ? 101 : index + 1,
    frameP95Ms: 10,
    longTasks: [],
  }));

  const result = evaluateRun(samples, {
    firstPaintP95Ms: 100,
    interactiveFrameP95Ms: 16.7,
    maximumLongTasks: 0,
  });

  assert.equal(result.firstPaintP95Ms, 30);
  assert.equal(result.passed, true);
  samples[29].firstPaintMs = 101;
  assert.equal(
    evaluateRun(samples, {
      firstPaintP95Ms: 100,
      interactiveFrameP95Ms: 16.7,
      maximumLongTasks: 0,
    }).passed,
    false,
  );
});

test("complete result requires 3 independent 30-sample runs and retained evidence", () => {
  const run = {
    runIndex: 1,
    rawSamples: Array.from({ length: 30 }, () => ({
      firstPaintMs: 20,
      frameP95Ms: 10,
      longTasks: [],
    })),
    browserTrace: "trace-1.zip",
    environment: {
      platform: "linux/arm64/v8",
      browserVersion: "151.0.7922.34",
    },
  };
  const complete = {
    runs: [run, { ...run, runIndex: 2 }, { ...run, runIndex: 3 }],
  };

  assert.doesNotThrow(() => validateCompleteResult(complete));
  assert.throws(
    () => validateCompleteResult({ runs: complete.runs.slice(0, 2) }),
    /exactly 3 independent runs/i,
  );
  assert.throws(
    () =>
      validateCompleteResult({
        runs: [
          { ...run, browserTrace: "" },
          complete.runs[1],
          complete.runs[2],
        ],
      }),
    /browser trace/i,
  );
});
