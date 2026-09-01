/* eslint-disable react-refresh/only-export-components -- benchmark-only entry */
import { scaleLinear } from "d3";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { BiSurface } from "./components/bi-surface";
import { MetricPanel } from "./components/result-visualizer";
import { TraceTree, TraceWaterfall } from "./components/trace-views";
import type { MetricResult } from "./domain/evolution/types";
import type { TraceView } from "./domain/trace/trace-view";
import "./shared.css";

interface BenchmarkApi {
  dataReady: number;
  firstPaintMs?: number;
  longTasks: Array<{ startTime: number; duration: number }>;
  ready: boolean;
  runInteraction(durationMs: number): Promise<number[]>;
}

declare global {
  interface Window {
    __wsrBenchmark: BenchmarkApi;
  }
}

const query = new URLSearchParams(window.location.search);
const panel = query.get("panel") ?? "metric-ratio-bar@1";
const fixture = query.get("fixture") ?? "typical";
const dataReady = performance.now();
const longTasks: Array<{ startTime: number; duration: number }> = [];
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    longTasks.push({ startTime: entry.startTime, duration: entry.duration });
  }
});
observer.observe({ type: "longtask", buffered: true });

window.__wsrBenchmark = {
  dataReady,
  longTasks,
  ready: false,
  runInteraction: async () => [],
};

const baseSlice = {
  slice_key: {},
  measures: {},
  coverage: null,
  compatibility: {},
  exclusions: [],
  missing_inputs: [],
  provenance_refs: [],
};

function ratioResult(): MetricResult {
  return {
    metric_id: "delivery-success-rate",
    metric_version: "2.0.0",
    slices: [
      {
        ...baseSlice,
        state: "AVAILABLE",
        value: {
          kind: "RATIO",
          value: fixture === "upper-bound" ? "9999/10000" : "3/4",
          unit: "ratio",
        },
      },
    ],
  };
}

function unavailableResult(): MetricResult {
  return {
    metric_id: "workflow-resolution-rate",
    metric_version: "2.0.0",
    slices: [
      {
        ...baseSlice,
        state: "UNAVAILABLE",
        withholding_reason: "MISSING_INPUT",
        missing_inputs: ["workflow_snapshot"],
      },
    ],
  };
}

function traceModel(): TraceView {
  const upper = fixture === "upper-bound";
  const nodeCount = upper ? 200 : 15;
  const duration = BigInt(nodeCount * 100);
  const truth = {
    availability: "AVAILABLE" as const,
    completeness: "FINAL" as const,
    expiry: "ACTIVE" as const,
    expires_at: null,
  };
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `node-${index.toString().padStart(3, "0")}`,
    endpoint: { trace_id: "benchmark-trace", span_id: `span-${index}` },
    label: `Recorded ${index}`,
    kind: index % 3 === 0 ? ("CLIENT" as const) : ("INTERNAL" as const),
    status: "OK" as const,
    startTimeUnixNano: BigInt(index * 100).toString(),
    endTimeUnixNano: BigInt(index * 100 + 80).toString(),
    durationNano: "80",
    startOffsetNano: BigInt(index * 100).toString(),
    flags: 1,
    traceState: index % 5 === 0 ? "benchmark=yes" : null,
    fields: [{ field: "benchmark.index", value: index }],
    truth,
    depth: Math.min(index, 9),
    ...(index === 0
      ? {}
      : { parentId: `node-${(index - 1).toString().padStart(3, "0")}` }),
  }));
  return {
    schemaVersion: "wsr.trace-view@1",
    status: "READY",
    traceId: "benchmark-trace",
    startTimeUnixNano: "0",
    endTimeUnixNano: duration.toString(),
    durationNano: duration.toString(),
    nodes,
    parentEdges: Array.from({ length: nodeCount - 1 }, (_, index) => ({
      id: `parent-${index}`,
      from: nodes[index + 1]!.endpoint,
      to: nodes[index]!.endpoint,
      truth,
    })),
    links: [
      {
        id: "link-0",
        from: nodes[0]!.endpoint,
        to: { trace_id: "remote-trace", span_id: "remote-span" },
        truth,
      },
    ],
    errors: [],
  };
}

function BenchmarkHarness() {
  const [narrow, setNarrow] = useState(false);
  const model = useMemo(
    () => (panel.startsWith("recorded-trace-") ? traceModel() : undefined),
    [],
  );

  useEffect(() => {
    let interactionFrame = 0;
    window.__wsrBenchmark.runInteraction = async (durationMs) => {
      const frames: number[] = [];
      const started = performance.now();
      let previous = started;
      await new Promise<void>((resolveInteraction) => {
        const frame = (now: number) => {
          frames.push(now - previous);
          previous = now;
          interactionFrame += 1;
          if (interactionFrame % 30 === 0) {
            const selectable = document.querySelectorAll<Element>(
              "[data-trace-renderer] [data-trace-node-id]",
            );
            selectable[interactionFrame % selectable.length]?.dispatchEvent(
              new MouseEvent("click", { bubbles: true }),
            );
          }
          if (interactionFrame % 150 === 0) setNarrow((value) => !value);
          if (now - started >= durationMs) resolveInteraction();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      return frames;
    };

    void document.fonts.ready.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.__wsrBenchmark.firstPaintMs = performance.now() - dataReady;
          window.__wsrBenchmark.ready = true;
          document.documentElement.dataset.benchmarkReady = "true";
        });
      });
    });
  }, [model]);

  const width = scaleLinear().domain([0, 1]).range([640, 960])(narrow ? 0 : 1);
  return (
    <div data-benchmark-panel={panel} style={{ width }}>
      <BiSurface>
        {panel === "recorded-trace-waterfall@1" && model !== undefined ? (
          <TraceWaterfall trace={model} />
        ) : panel === "recorded-trace-tree@1" && model !== undefined ? (
          <TraceTree trace={model} />
        ) : (
          <MetricPanel
            result={
              panel === "unavailable@1" ? unavailableResult() : ratioResult()
            }
            visualizer={
              panel === "unavailable@1" ? "numeric-card@1" : "ratio-bar@1"
            }
          />
        )}
      </BiSurface>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<BenchmarkHarness />);
