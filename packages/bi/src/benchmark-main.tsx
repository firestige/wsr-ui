/* eslint-disable react-refresh/only-export-components -- benchmark-only entry */
import { scaleLinear } from "d3";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { BiSurface } from "./components/bi-surface";
import {
  RecordedStructureFoundation,
  type RecordedStructureViewModel,
} from "./components/recorded-structure";
import { MetricPanel } from "./components/result-visualizer";
import type { MetricResult } from "./domain/evolution/types";
import "./shared.css";

interface BenchmarkApi {
  firstPaintMs?: number;
  longTasks: number[];
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
const longTasks: number[] = [];
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) longTasks.push(entry.duration);
});
observer.observe({ type: "longtask", buffered: true });

window.__wsrBenchmark = {
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

function traceModel(): RecordedStructureViewModel {
  const upper = fixture === "upper-bound";
  const nodeCount = upper ? 120 : 10;
  const depthCount = upper ? 10 : 4;
  const depthGroups = Array.from({ length: depthCount }, (_, depth) => ({
    depth,
    nodes: Array.from(
      { length: Math.ceil(nodeCount / depthCount) },
      (_, offset) => {
        const index = depth * Math.ceil(nodeCount / depthCount) + offset;
        return index >= nodeCount
          ? null
          : {
              id: `node-${index.toString().padStart(3, "0")}`,
              label: `Recorded ${index}`,
              state: "AVAILABLE" as const,
            };
      },
    ).filter((node) => node !== null),
  }));
  const nodes = depthGroups.flatMap((group) => group.nodes);
  const relationBudget = upper ? 80 : 5;
  const parentCount = Math.max(0, relationBudget - 1);
  return {
    depthGroups,
    parentEdges: Array.from({ length: parentCount }, (_, index) => ({
      id: `parent-${index}`,
      sourceId: nodes[index % nodes.length]!.id,
      targetId: nodes[(index + 1) % nodes.length]!.id,
    })),
    links: [
      {
        id: "link-0",
        sourceId: nodes[0]!.id,
        targetId: nodes.at(-1)!.id,
        state: "AVAILABLE",
      },
    ],
    orphans: [],
  };
}

function BenchmarkHarness() {
  const [narrow, setNarrow] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const model = useMemo(
    () => (panel === "recorded-trace-graph@1" ? traceModel() : undefined),
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
            const nodes =
              model?.depthGroups.flatMap((group) => group.nodes) ?? [];
            if (nodes.length > 0) {
              setSelectedId(nodes[interactionFrame % nodes.length]!.id);
            }
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
        {panel === "recorded-trace-graph@1" && model !== undefined ? (
          <RecordedStructureFoundation
            model={{ ...model, selectedId }}
            onSelect={setSelectedId}
          />
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
