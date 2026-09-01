/* global fetch, performance, setTimeout, window */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { arch, platform } from "node:os";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

import {
  clipLongTaskToWindow,
  evaluateRun,
  nearestRank,
  validateCompleteResult,
} from "./contract.mjs";

const benchmarkRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(benchmarkRoot, "../../..");
const argument = (name, fallback) => {
  const entry = process.argv.find((value) => value.startsWith(`--${name}=`));
  return entry === undefined ? fallback : entry.slice(name.length + 3);
};
const mode = argument("mode", "smoke");
const manifestPath = resolve(
  repositoryRoot,
  argument("manifest", "qualification/panel-benchmark/v1/manifest.json"),
);
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const isFull = mode === "full";
const runCount = isFull ? manifest.protocol.independentRuns : 1;
const sampleCount = isFull ? manifest.protocol.measuredSamplesPerRun : 3;
const interactionDurationMs = isFull
  ? manifest.protocol.interactiveDurationMsPerSample
  : 250;

if (isFull) {
  if (process.env.WSR_BENCHMARK_FIXED_RUNNER !== "1") {
    throw new Error(
      "Full panel-benchmark@1 must run through the fixed-runner container",
    );
  }
  if (platform() !== "linux" || arch() !== "arm64") {
    throw new Error(`Fixed runner platform mismatch: ${platform()}/${arch()}`);
  }
}

const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "packages/bi",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  { cwd: repositoryRoot, stdio: ["ignore", "pipe", "pipe"] },
);
let serverOutput = "";
server.stdout.on("data", (chunk) => (serverOutput += chunk));
server.stderr.on("data", (chunk) => (serverOutput += chunk));

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4174/benchmark.html");
      if (response.ok) return;
    } catch {
      // The fixed retry loop is part of runner startup, not a measured sample.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Benchmark server did not start:\n${serverOutput}`);
}

function smokeEvaluation(samples) {
  const firstPaint = samples.map((sample) => sample.firstPaintMs);
  const frames = samples
    .map((sample) => sample.frameP95Ms)
    .filter((value) => value !== null);
  return {
    firstPaintP50Ms: nearestRank(firstPaint, 0.5),
    firstPaintP95Ms: nearestRank(firstPaint, 0.95),
    frameP50Ms: frames.length === 0 ? null : nearestRank(frames, 0.5),
    frameP95Ms: frames.length === 0 ? null : nearestRank(frames, 0.95),
    longTaskCount: samples.reduce(
      (total, sample) => total + sample.longTasks.length,
      0,
    ),
    passed: true,
    qualifying: false,
  };
}

async function measureSample(browser, target) {
  const page = await browser.newPage({
    deviceScaleFactor: manifest.runner.deviceScaleFactor,
    viewport: manifest.runner.viewport,
  });
  try {
    await page.goto(
      `http://127.0.0.1:4174/benchmark.html?panel=${encodeURIComponent(target.panel)}&fixture=${encodeURIComponent(target.fixture)}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForFunction(() => window.__wsrBenchmark?.ready === true);
    if (target.panel === "unavailable@1") {
      if ((await page.locator('[data-state="UNAVAILABLE"]').count()) !== 1) {
        throw new Error("UNAVAILABLE semantic state is missing");
      }
      if ((await page.locator("svg").count()) !== 0) {
        throw new Error("UNAVAILABLE fixture rendered a chart");
      }
    } else if (
      typeof target.rendererReadySelector !== "string" ||
      (await page.locator(target.rendererReadySelector).count()) === 0
    ) {
      throw new Error(`${target.panel} did not satisfy renderer readiness`);
    }
    const frameDurations = target.interactive
      ? await page.evaluate(
          (duration) => window.__wsrBenchmark.runInteraction(duration),
          interactionDurationMs,
        )
      : [];
    const raw = await page.evaluate(() => ({
      dataReady: window.__wsrBenchmark.dataReady,
      firstPaintMs: window.__wsrBenchmark.firstPaintMs,
      longTasks: [...window.__wsrBenchmark.longTasks],
      measurementEnd: performance.now(),
    }));
    if (typeof raw.firstPaintMs !== "number") {
      throw new Error("renderer-ready first-paint mark is missing");
    }
    const observedLongTasks = raw.longTasks.map((entry) =>
      clipLongTaskToWindow(entry, {
        startTime: raw.dataReady,
        endTime: raw.measurementEnd,
      }),
    );
    return {
      firstPaintMs: raw.firstPaintMs,
      frameP95Ms:
        frameDurations.length === 0 ? null : nearestRank(frameDurations, 0.95),
      frameDurations,
      observedLongTasks,
      longTasks: observedLongTasks.filter(
        (entry) =>
          entry.measuredDuration >= manifest.budgets.longTaskThresholdMs,
      ),
    };
  } finally {
    await page.close();
  }
}

const targets = manifest.chartPanels.flatMap((panelDefinition) => [
  {
    panel: panelDefinition.id,
    rendererReadySelector: panelDefinition.rendererReadySelector,
    fixture: "typical",
    fixtureId: panelDefinition.typicalFixture.id,
    interactive: panelDefinition.id.startsWith("recorded-trace-"),
  },
  {
    panel: panelDefinition.id,
    rendererReadySelector: panelDefinition.rendererReadySelector,
    fixture: "upper-bound",
    fixtureId: panelDefinition.upperBoundFixture.id,
    interactive: panelDefinition.id.startsWith("recorded-trace-"),
  },
]);
targets.push({
  panel: "unavailable@1",
  fixture: "semantic",
  fixtureId: "unavailable@1",
  interactive: false,
});

const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const resultRoot = resolve(benchmarkRoot, "results", `${mode}-${timestamp}`);
await mkdir(resultRoot, { recursive: true });
let browser;
const results = [];
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  if (isFull && browserVersion !== manifest.runner.playwright.browserVersion) {
    throw new Error(
      `Browser version mismatch: expected ${manifest.runner.playwright.browserVersion}, got ${browserVersion}`,
    );
  }
  for (const target of targets) {
    const targetResult = { ...target, runs: [] };
    for (let runIndex = 1; runIndex <= runCount; runIndex += 1) {
      const context = await browser.newContext();
      await context.tracing.start({
        screenshots: false,
        snapshots: false,
        sources: false,
      });
      await measureSample(context, target);
      const rawSamples = [];
      for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
        rawSamples.push({
          sampleIndex,
          ...(await measureSample(context, target)),
        });
      }
      const traceName = `${target.panel}.${target.fixture}.run-${runIndex}.zip`;
      await context.tracing.stop({ path: resolve(resultRoot, traceName) });
      await context.close();
      const evaluation = isFull
        ? evaluateRun(rawSamples, manifest.budgets)
        : smokeEvaluation(rawSamples);
      targetResult.runs.push({
        runIndex,
        warmupSamples: 1,
        rawSamples,
        browserTrace: traceName,
        environment: {
          platform: `${platform()}/${arch()}`,
          browserVersion,
          browserRevision: manifest.runner.playwright.browserRevision,
          viewport: manifest.runner.viewport,
          deviceScaleFactor: manifest.runner.deviceScaleFactor,
          runnerImageDigest:
            process.env.WSR_BENCHMARK_RUNNER_IMAGE ?? "native-smoke",
        },
        evaluation,
      });
    }
    if (isFull) validateCompleteResult(targetResult);
    results.push(targetResult);
  }
} finally {
  if (browser !== undefined) await browser.close();
  server.kill("SIGTERM");
}

const result = {
  schemaVersion: "panel-benchmark-result@1",
  qualifying: isFull,
  benchmark: manifest.schemaVersion,
  manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
  providerCommit:
    process.env.WSR_BENCHMARK_PROVIDER_COMMIT ?? "working-tree-smoke",
  packageCoordinate: "wsr-ui-core",
  packageVersion: "0.1.0-rc.0",
  createdAt: new Date().toISOString(),
  results,
};
await writeFile(
  resolve(resultRoot, "result.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);
process.stdout.write(
  `${JSON.stringify({ result: resolve(resultRoot, "result.json"), qualifying: isFull }, null, 2)}\n`,
);

if (
  isFull &&
  results.some((target) => target.runs.some((run) => !run.evaluation.passed))
) {
  process.exitCode = 1;
}
