export function clipLongTaskToWindow(entry, window) {
  const measuredStart = Math.max(entry.startTime, window.startTime);
  const measuredEnd = Math.min(
    entry.startTime + entry.duration,
    window.endTime,
  );
  return {
    ...entry,
    measuredDuration: Math.max(0, measuredEnd - measuredStart),
  };
}

export function nearestRank(values, percentile) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("nearest-rank requires at least one value");
  }
  if (!(percentile > 0 && percentile <= 1)) {
    throw new Error("nearest-rank percentile must be in (0, 1]");
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(percentile * sorted.length) - 1];
}

export function evaluateRun(samples, budgets) {
  if (samples.length !== 30) {
    throw new Error("A full run requires exactly 30 measured samples");
  }
  const firstPaint = samples.map((sample) => sample.firstPaintMs);
  const frames = samples
    .map((sample) => sample.frameP95Ms)
    .filter((value) => value !== null && value !== undefined);
  const longTaskCount = samples.reduce(
    (total, sample) => total + sample.longTasks.length,
    0,
  );
  const result = {
    firstPaintP50Ms: nearestRank(firstPaint, 0.5),
    firstPaintP95Ms: nearestRank(firstPaint, 0.95),
    frameP50Ms: frames.length === 0 ? null : nearestRank(frames, 0.5),
    frameP95Ms: frames.length === 0 ? null : nearestRank(frames, 0.95),
    longTaskCount,
  };
  return {
    ...result,
    passed:
      result.firstPaintP95Ms <= budgets.firstPaintP95Ms &&
      (result.frameP95Ms === null ||
        result.frameP95Ms <= budgets.interactiveFrameP95Ms) &&
      longTaskCount <= budgets.maximumLongTasks,
  };
}

export function validateCompleteResult(result) {
  if (!Array.isArray(result.runs) || result.runs.length !== 3) {
    throw new Error("A complete result requires exactly 3 independent runs");
  }
  const indexes = new Set();
  for (const run of result.runs) {
    indexes.add(run.runIndex);
    if (!Array.isArray(run.rawSamples) || run.rawSamples.length !== 30) {
      throw new Error("Every run must retain exactly 30 raw samples");
    }
    if (typeof run.browserTrace !== "string" || run.browserTrace.length === 0) {
      throw new Error("Every run must retain a browser trace");
    }
    if (!run.environment?.platform || !run.environment?.browserVersion) {
      throw new Error("Every run must retain environment metadata");
    }
  }
  if (indexes.size !== 3) {
    throw new Error("Run indexes must identify 3 independent runs");
  }
}
