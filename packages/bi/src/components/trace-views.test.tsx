import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { TraceView } from "../domain/trace/trace-view";
import { TraceStatistics, TraceTree, TraceWaterfall } from "../public";

const trace: TraceView = {
  schemaVersion: "wsr.trace-view@1",
  status: "READY",
  traceId: "trace-1",
  startTimeUnixNano: "1000",
  endTimeUnixNano: "1100",
  durationNano: "100",
  errors: [],
  nodes: [
    {
      id: "root",
      endpoint: { trace_id: "trace-1", span_id: "root" },
      label: "workflow.run",
      kind: "INTERNAL",
      status: "OK",
      startTimeUnixNano: "1000",
      endTimeUnixNano: "1100",
      durationNano: "100",
      startOffsetNano: "0",
      flags: 1,
      traceState: null,
      fields: [{ field: "wsr.role", value: "orchestrator" }],
      truth: {
        availability: "AVAILABLE",
        completeness: "FINAL",
        expiry: "ACTIVE",
        expires_at: null,
      },
      depth: 0,
    },
    {
      id: "child",
      endpoint: { trace_id: "trace-1", span_id: "child" },
      label: "tool.execute",
      kind: "CLIENT",
      status: "OK",
      startTimeUnixNano: "1010",
      endTimeUnixNano: "1040",
      durationNano: "30",
      startOffsetNano: "10",
      flags: 257,
      traceState: "vendor=value",
      fields: [{ field: "tool", value: "shell" }],
      truth: {
        availability: "AVAILABLE",
        completeness: "FINAL",
        expiry: "ACTIVE",
        expires_at: null,
      },
      depth: 1,
      parentId: "root",
    },
  ],
  parentEdges: [
    {
      id: "parent-child-root",
      from: { trace_id: "trace-1", span_id: "child" },
      to: { trace_id: "trace-1", span_id: "root" },
      truth: {
        availability: "AVAILABLE",
        completeness: "FINAL",
        expiry: "ACTIVE",
        expires_at: null,
      },
    },
  ],
  links: [
    {
      id: "link-child-remote",
      from: { trace_id: "trace-1", span_id: "child" },
      to: { trace_id: "trace-2", span_id: "remote" },
      flags: 1,
      traceState: "linked=yes",
      truth: {
        availability: "AVAILABLE",
        completeness: "FINAL",
        expiry: "ACTIVE",
        expires_at: null,
      },
    },
  ],
};

describe("recorded Trace business panels", () => {
  it("renders a shared-scale waterfall and a lossless span passport", async () => {
    render(<TraceWaterfall trace={trace} />);

    const waterfall = screen.getByRole("region", {
      name: "Recorded trace waterfall",
    });
    expect(screen.getByTestId("trace-waterfall")).toBe(waterfall);
    expect(waterfall).toHaveAttribute("data-motion", "zoom-transition");
    expect(waterfall).toHaveAttribute("data-trace-renderer", "waterfall");
    expect(screen.getAllByText("100 ns").length).toBeGreaterThan(0);
    expect(screen.getByText("Duration")).toBeVisible();
    expect(screen.getByText("Start")).toBeVisible();
    expect(screen.getByText("Spans")).toBeVisible();
    expect(screen.getByText("Errors")).toBeVisible();
    expect(
      screen.getByText("Errors").closest(".trace-summary-stat"),
    ).toHaveAttribute("data-tone", "success");
    expect(screen.getByText("trace-1")).toHaveAttribute(
      "data-variant",
      "caption",
    );
    expect(screen.queryByText(/shared recorded-time domain/i)).toBeNull();
    expect(
      screen.getByRole("region", { name: "Recorded trace minimap" }),
    ).toBeVisible();
    expect(
      screen.getByRole("tree", { name: "Recorded waterfall span outline" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("slider", { name: "Recorded time position" }),
    ).toBeNull();
    expect(waterfall.querySelector(".trace-motion")).toBeNull();
    expect(
      screen.getByRole("region", { name: "Span passport" }),
    ).toHaveTextContent("root");
    expect(screen.getByTestId("span-passport")).toHaveTextContent("root");

    await userEvent.click(
      screen
        .getAllByTestId("trace-waterfall-node")
        .find((node) => node.getAttribute("data-trace-node-id") === "child")!,
    );
    const passport = screen.getByRole("region", { name: "Span passport" });
    expect(passport).toHaveTextContent("1010");
    expect(passport).toHaveTextContent("1040");
    expect(passport).toHaveTextContent("vendor=value");
    expect(passport).toHaveTextContent('"tool":"shell"');
    expect(passport).toHaveTextContent("FINAL");
  });

  it("binds collapse controls, minimap zoom, and exact-time ticks to the same waterfall model", async () => {
    const { container } = render(<TraceWaterfall trace={trace} />);

    expect(container.querySelector(".trace-view-tools")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Expand all spans" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Collapse all spans" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset focus" })).toHaveAttribute(
      "data-icon-button",
      "true",
    );
    expect(
      screen
        .getByRole("button", { name: "Expand all spans" })
        .closest('[role="group"]'),
    ).not.toHaveAttribute("data-segmented");
    expect(
      screen.getByRole("searchbox", { name: "Search recorded spans" }),
    ).toBeVisible();
    expect(container.querySelector(".trace-timeline-head")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Collapse workflow.run descendants" }),
    );
    expect(screen.queryByRole("button", { name: /tool.execute/i })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Expand all spans" }),
    );
    expect(
      screen
        .getAllByTestId("trace-waterfall-node")
        .find((node) => node.getAttribute("data-trace-node-id") === "child"),
    ).toBeVisible();

    const minimap = screen.getByRole("slider", {
      name: "Trace minimap zoom window",
    });
    expect(screen.getByTestId("trace-waterfall-data-zoom")).toBe(minimap);
    expect(
      screen.queryByTestId("trace-waterfall-data-zoom-selection"),
    ).toBeNull();
    const minimapRuler = screen.getByTestId("trace-waterfall-data-zoom-ruler");
    expect(
      [...minimapRuler.querySelectorAll("span")].map(
        (tick) => tick.textContent,
      ),
    ).toEqual(["0 ns", "25 ns", "50 ns", "75 ns", "100 ns"]);
    expect(minimapRuler.querySelectorAll("span")[2]).toHaveStyle({
      insetInlineStart: "50%",
    });
    const chart = screen.getByTestId("trace-waterfall-chart");
    expect(chart.tagName.toLowerCase()).toBe("svg");
    const axisTicks = screen.getAllByTestId("trace-waterfall-axis-tick");
    expect(axisTicks).toHaveLength(11);
    expect(axisTicks.map((tick) => tick.textContent)).toContain("30 ns");
    expect(axisTicks[0]!.querySelector("line")).toHaveAttribute("y1", "0");
    expect(axisTicks[0]!.querySelector("line")).toHaveAttribute("y2", "128");
    expect(axisTicks[0]!.querySelector("text")).toHaveAttribute("x", "6");
    expect(axisTicks[0]!.querySelector("text")).toHaveAttribute(
      "text-anchor",
      "start",
    );
    expect(axisTicks.at(-1)!.querySelector("text")).toBeNull();
    expect(
      screen.getByTestId("trace-waterfall-data-zoom-window"),
    ).toHaveAttribute("data-full", "true");
    expect(screen.getByTestId("trace-waterfall-span-tree")).toHaveAttribute(
      "role",
      "tree",
    );
    const waterfallRows = screen.getAllByTestId("trace-waterfall-row");
    expect(waterfallRows).toHaveLength(2);
    expect(waterfallRows[0]).toHaveAttribute("data-trace-node-id", "root");
    expect(waterfallRows[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByTestId("trace-waterfall-node")).toHaveLength(2);
    const waterfallBars = screen.getAllByTestId("trace-waterfall-bar");
    expect(waterfallBars).toHaveLength(2);
    expect(waterfallBars[1]).toHaveAttribute("data-trace-node-id", "child");
    expect(
      screen
        .getAllByTestId("trace-waterfall-label")
        .map((label) => label.textContent),
    ).toEqual(["workflow.run", "tool.execute"]);
    expect(waterfallBars[0]!.querySelector("title")).toHaveTextContent(
      "workflow.run",
    );
    expect(waterfallBars[1]!.querySelector("title")).toHaveTextContent(
      "tool.execute",
    );
    const waterfallLanes = screen.getAllByTestId("trace-waterfall-lane");
    expect(waterfallLanes).toHaveLength(2);
    expect(waterfallLanes[0]).toHaveAttribute("data-selected", "true");
    expect(waterfallLanes[0]).not.toHaveAttribute("data-row-parity");
    expect(waterfallLanes[1]).not.toHaveAttribute("data-row-parity");
    expect(
      waterfallLanes.at(-1)!.compareDocumentPosition(axisTicks[0]!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByTestId("trace-waterfall-collapse")).toHaveAttribute(
      "data-trace-node-id",
      "root",
    );
    const indentGuides = screen.getAllByTestId("trace-waterfall-indent-guide");
    expect(indentGuides).toHaveLength(1);
    expect(indentGuides[0]).toHaveAttribute("data-guide-owner-id", "child");
    expect(indentGuides[0]).toHaveAttribute("data-trace-depth", "0");
    const rootLabelParts =
      waterfallRows[0]!.querySelector(".trace-node-label")!.children;
    expect(rootLabelParts[0]).toHaveClass("trace-collapse-control");
    expect(rootLabelParts[1]).toHaveClass("trace-indent-items");
    expect(rootLabelParts[2]).toHaveClass("trace-node-main");
    const zoomWindow = screen.getByTestId("trace-waterfall-data-zoom-window");
    expect(zoomWindow).toHaveAttribute("data-full", "true");
    expect(
      container.querySelector(
        '[data-timeline-span-id="root"] .trace-indent-items',
      ),
    ).toHaveAttribute("data-indent-depth", "0");
    expect(
      container.querySelector(
        '[data-timeline-span-id="child"] .trace-indent-items',
      ),
    ).toHaveAttribute("data-indent-depth", "1");
    expect(container.querySelector(".trace-timeline-grid")).toBeNull();

    await userEvent.click(waterfallRows[0]!);
    expect(waterfallLanes[0]).toHaveAttribute("data-selected", "true");
    await userEvent.click(waterfallLanes[1]!);
    expect(waterfallRows[1]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("span-passport")).toHaveTextContent("child");
    Object.defineProperty(minimap, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        right: 100,
        top: 0,
        bottom: 40,
        width: 100,
        height: 40,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    fireEvent.pointerDown(minimap, { clientX: 25, pointerId: 1 });
    fireEvent.pointerMove(minimap, { clientX: 75, pointerId: 1 });
    fireEvent.pointerUp(minimap, { clientX: 75, pointerId: 1 });

    expect(minimap).toHaveAttribute("aria-valuetext", "25 ns to 75 ns");
    expect(
      screen
        .getAllByTestId("trace-waterfall-axis-tick")
        .map((tick) => tick.textContent),
    ).toEqual([
      "25 ns",
      "30 ns",
      "35 ns",
      "40 ns",
      "45 ns",
      "50 ns",
      "55 ns",
      "60 ns",
      "65 ns",
      "70 ns",
      "",
    ]);
    expect(zoomWindow).toHaveStyle({
      insetInlineStart: "25%",
      width: "50%",
    });
    const leftZoomHandle = screen.getByTestId(
      "trace-waterfall-data-zoom-handle-left",
    );
    const rightZoomHandle = screen.getByTestId(
      "trace-waterfall-data-zoom-handle-right",
    );
    fireEvent.pointerDown(leftZoomHandle, { clientX: 25, pointerId: 4 });
    fireEvent.pointerMove(minimap, { clientX: 15, pointerId: 4 });
    fireEvent.pointerUp(minimap, { clientX: 15, pointerId: 4 });
    expect(minimap).toHaveAttribute("aria-valuetext", "15 ns to 75 ns");
    fireEvent.pointerDown(leftZoomHandle, { clientX: 15, pointerId: 5 });
    fireEvent.pointerMove(minimap, { clientX: 25, pointerId: 5 });
    fireEvent.pointerUp(minimap, { clientX: 25, pointerId: 5 });
    fireEvent.pointerDown(rightZoomHandle, { clientX: 75, pointerId: 6 });
    fireEvent.pointerMove(minimap, { clientX: 85, pointerId: 6 });
    fireEvent.pointerUp(minimap, { clientX: 85, pointerId: 6 });
    expect(minimap).toHaveAttribute("aria-valuetext", "25 ns to 85 ns");
    fireEvent.pointerDown(rightZoomHandle, { clientX: 85, pointerId: 7 });
    fireEvent.pointerMove(minimap, { clientX: 75, pointerId: 7 });
    fireEvent.pointerUp(minimap, { clientX: 75, pointerId: 7 });
    expect(minimap).toHaveAttribute("aria-valuetext", "25 ns to 75 ns");
    const zoomedChildBar = screen
      .getAllByTestId("trace-waterfall-bar")
      .find((bar) => bar.getAttribute("data-trace-node-id") === "child");
    expect(zoomedChildBar).toHaveAttribute("x", "0");
    expect(zoomedChildBar).toHaveAttribute("width", "240");

    fireEvent.pointerDown(zoomWindow, { clientX: 40, pointerId: 2 });
    fireEvent.pointerMove(minimap, { clientX: 60, pointerId: 2 });
    fireEvent.pointerUp(minimap, { clientX: 60, pointerId: 2 });
    expect(minimap).toHaveAttribute("aria-valuetext", "45 ns to 95 ns");
    expect(zoomWindow).toHaveStyle({
      insetInlineStart: "45%",
      width: "50%",
    });
    const exitingChildTimeline = screen
      .getAllByTestId("trace-waterfall-timeline")
      .find((item) => item.getAttribute("data-trace-node-id") === "child");
    expect(exitingChildTimeline).toHaveAttribute("data-visible", "false");
    expect(exitingChildTimeline).toHaveAttribute("data-motion-phase", "exit");
    expect(exitingChildTimeline).toHaveAttribute(
      "data-motion-direction",
      "left",
    );

    fireEvent.pointerDown(zoomWindow, { clientX: 60, pointerId: 3 });
    fireEvent.pointerMove(minimap, { clientX: 30, pointerId: 3 });
    fireEvent.pointerUp(minimap, { clientX: 30, pointerId: 3 });
    expect(minimap).toHaveAttribute("aria-valuetext", "15 ns to 65 ns");
    const enteringChildTimeline = screen
      .getAllByTestId("trace-waterfall-timeline")
      .find((item) => item.getAttribute("data-trace-node-id") === "child");
    expect(enteringChildTimeline).toHaveAttribute("data-visible", "true");
    expect(enteringChildTimeline).toHaveAttribute("data-motion-phase", "enter");
    expect(enteringChildTimeline).toHaveAttribute(
      "data-motion-direction",
      "right",
    );
  });

  it("clips long timeline labels with an ellipsis and keeps the full tooltip", () => {
    const longLabel = "a.timeline.label.that.is.too.long.for.its.span";
    const traceWithLongLabel: TraceView = {
      ...trace,
      nodes: trace.nodes.map((node) =>
        node.id === "child"
          ? { ...node, durationNano: "5", label: longLabel }
          : node,
      ),
    };

    render(<TraceWaterfall trace={traceWithLongLabel} />);

    const childLabel = screen
      .getAllByTestId("trace-waterfall-label")
      .find((label) => label.getAttribute("data-trace-node-id") === "child");
    const childBar = screen
      .getAllByTestId("trace-waterfall-bar")
      .find((bar) => bar.getAttribute("data-trace-node-id") === "child");
    expect(childLabel?.textContent).toMatch(/…$/);
    expect(childLabel).toHaveAttribute("clip-path");
    expect(childLabel?.textContent).not.toBe(longLabel);
    expect(childBar?.querySelector("title")).toHaveTextContent(longLabel);
  });

  it("virtualizes large waterfalls from one left-hand scroll window", () => {
    const denseNodes = Array.from({ length: 40 }, (_, index) => ({
      ...trace.nodes[1]!,
      id: `virtual-${index}`,
      endpoint: { trace_id: "trace-1", span_id: `virtual-${index}` },
      label: `virtual.${index}`,
      startOffsetNano: String(index * 2),
    }));
    render(<TraceWaterfall trace={{ ...trace, nodes: denseNodes }} />);

    const viewport = screen.getByTestId("trace-waterfall-scroll-viewport");
    expect(viewport).toHaveAttribute("data-total-rows", "40");
    expect(viewport).toHaveAttribute("data-virtual-start", "0");
    expect(viewport).toHaveAttribute("data-virtual-end", "11");
    expect(screen.getAllByTestId("trace-waterfall-row")).toHaveLength(11);
    expect(screen.getAllByTestId("trace-waterfall-lane")).toHaveLength(11);

    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      value: 960,
    });
    fireEvent.scroll(viewport);

    expect(viewport).toHaveAttribute("data-virtual-start", "17");
    expect(viewport).toHaveAttribute("data-virtual-end", "31");
    const rows = screen.getAllByTestId("trace-waterfall-row");
    const lanes = screen.getAllByTestId("trace-waterfall-lane");
    expect(rows).toHaveLength(14);
    expect(lanes).toHaveLength(14);
    expect(rows[0]).toHaveAttribute("data-trace-node-id", "virtual-17");
    expect(rows[0]).toHaveAttribute("aria-posinset", "18");
    expect(rows[0]).toHaveAttribute("aria-setsize", "40");
    expect(lanes[0]).toHaveAttribute("data-trace-node-id", "virtual-17");
  });

  it("maps minimap span colors to the same kind and status as waterfall bars", () => {
    const traceWithError: TraceView = {
      ...trace,
      nodes: trace.nodes.map((node) =>
        node.id === "child" ? { ...node, status: "ERROR" } : node,
      ),
    };

    const { rerender } = render(<TraceWaterfall trace={traceWithError} />);

    const overview = screen.getByTestId("trace-waterfall-minimap-overview");
    const overviewSpans = screen.getAllByTestId("trace-waterfall-minimap-span");
    expect(overview.tagName.toLowerCase()).toBe("svg");
    expect(overview).toHaveAttribute("viewBox", "0 0 100 2");
    expect(overviewSpans[0]!.tagName.toLowerCase()).toBe("line");
    expect(overviewSpans[0]).toHaveAttribute("y1", "0.5");
    expect(overviewSpans[0]).toHaveAttribute("y2", "0.5");
    expect(overviewSpans[1]).toHaveAttribute("y1", "1.5");
    expect(overviewSpans[1]).toHaveAttribute("y2", "1.5");
    expect(overviewSpans[1]).toHaveAttribute("x1", "10");
    expect(overviewSpans[1]).toHaveAttribute("x2", "40");

    for (const node of traceWithError.nodes) {
      const selector = `[data-trace-node-id="${node.id}"]`;
      const minimapSpan = screen
        .getByTestId("trace-waterfall-data-zoom")
        .querySelector(`.trace-minimap-span${selector}`);
      const waterfallBar = screen
        .getByTestId("trace-waterfall-chart")
        .querySelector(`.trace-timeline-bar${selector}`);

      expect(minimapSpan).toHaveAttribute(
        "data-color-index",
        String(node.depth % 6),
      );
      expect(waterfallBar).toHaveAttribute(
        "data-color-index",
        String(node.depth % 6),
      );

      expect(minimapSpan).toHaveClass(`trace-kind-${node.kind.toLowerCase()}`);
      expect(waterfallBar).toHaveClass(`trace-kind-${node.kind.toLowerCase()}`);
      if (node.status === "ERROR") {
        expect(minimapSpan).toHaveClass("trace-status-error");
        expect(waterfallBar).toHaveClass("trace-status-error");
      } else {
        expect(minimapSpan).not.toHaveClass("trace-status-error");
        expect(waterfallBar).not.toHaveClass("trace-status-error");
      }
    }

    const denseNodes = Array.from({ length: 40 }, (_, index) => ({
      ...trace.nodes[1]!,
      id: `dense-${index}`,
      endpoint: { trace_id: "trace-1", span_id: `dense-${index}` },
      label: `dense.${index}`,
      startOffsetNano: String(index * 2),
    }));
    rerender(<TraceWaterfall trace={{ ...trace, nodes: denseNodes }} />);
    expect(
      screen.getByTestId("trace-waterfall-minimap-overview"),
    ).toHaveAttribute("viewBox", "0 0 100 40");
    const denseOverviewSpans = screen.getAllByTestId(
      "trace-waterfall-minimap-span",
    );
    expect(denseOverviewSpans).toHaveLength(40);
    expect(denseOverviewSpans[39]).toHaveAttribute("y1", "39.5");
    expect(denseOverviewSpans[39]).toHaveAttribute("stroke-width", "0.5");
  });

  it("renders a zoomable call tree with navigable minimap and directional edges", async () => {
    render(<TraceTree trace={trace} />);

    const region = screen.getByRole("region", {
      name: "Recorded trace tree",
    });
    expect(screen.getByTestId("trace-tree")).toBe(region);
    expect(region).toHaveAttribute("data-trace-renderer", "tree");
    expect(region).toHaveAttribute("data-motion", "edge-flow");
    expect(screen.getAllByTestId("trace-tree-node")).toHaveLength(2);
    const tree = screen.getByRole("tree", { name: "Recorded trace call tree" });
    expect(tree).toHaveTextContent("workflow.run");
    expect(tree).toHaveTextContent("tool.execute");
    const recordedLinks = screen.getByRole("list", {
      name: "Recorded span links",
    });
    expect(recordedLinks).toHaveTextContent("Recorded LINK → trace-2:remote");
    expect(recordedLinks).toHaveClass("trace-sr-only");
    const graph = screen.getByRole("img", {
      name: "Recorded span call tree graph",
    });
    expect(graph).toBeVisible();
    expect(graph.tagName.toLowerCase()).toBe("canvas");
    expect(graph).toHaveAttribute("data-camera-view", "0 0 980 560");
    expect(graph).toHaveAttribute("data-layout", "call-graph");
    expect(graph).toHaveAttribute("data-edge-routing", "orthogonal");
    expect(graph).toHaveAttribute("data-resolution-mode", "device-pixel-ratio");
    expect(graph).toHaveAttribute("data-node-shape", "flat-left-rounded-right");
    expect(graph).toHaveAttribute("data-parent-edge-count", "1");
    expect(graph).toHaveAttribute("data-link-count", "1");
    const canvasHeader = region.querySelector(".trace-tree-canvas-head");
    expect(canvasHeader?.querySelector("h2")).toHaveTextContent(
      "Span call tree",
    );
    expect(canvasHeader?.querySelector("h2")).toHaveAttribute(
      "data-variant",
      "subtitle1",
    );
    expect(canvasHeader?.querySelector("p")).toHaveTextContent(
      "Click a Span or exact relationship · deterministic geometry",
    );
    const cameraControls = screen.getByRole("group", {
      name: "Tree camera controls",
    });
    for (const button of cameraControls.querySelectorAll("button"))
      expect(button).toHaveAttribute("data-icon-button", "true");
    const context = region.querySelector(".trace-tree-context")!;
    expect(context.querySelector(".trace-summary-identity")).toHaveTextContent(
      "workflow.runtrace-1",
    );
    expect(context.querySelectorAll(".trace-summary-stat")).toHaveLength(3);
    expect(context).toHaveTextContent("Exact spans2");
    expect(context).toHaveTextContent("PARENT_EDGE1");
    expect(context).toHaveTextContent("LINK1");
    expect(
      screen.getByRole("list", { name: "Trace tree legend" }),
    ).toHaveTextContent("INTERNALCLIENTERRORPARENT_EDGELINKRequest flow");
    const minimap = screen.getByRole("region", {
      name: "Tree minimap navigation",
    });
    expect(minimap).toBeVisible();
    expect(screen.getByRole("button", { name: "Fit tree" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(graph).toHaveAttribute("data-camera-view", "98 56 784 448");
    expect(screen.getByTestId("trace-tree-minimap-viewport")).toHaveAttribute(
      "data-camera-width",
      "784",
    );
    Object.defineProperty(minimap, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        bottom: 80,
        height: 80,
        left: 0,
        right: 140,
        top: 0,
        width: 140,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    fireEvent.pointerDown(minimap, {
      clientX: 35,
      clientY: 40,
      pointerId: 1,
    });
    expect(graph).toHaveAttribute("data-camera-view", "0 56 784 448");
    fireEvent.pointerMove(minimap, {
      clientX: 105,
      clientY: 40,
      pointerId: 1,
    });
    expect(graph).toHaveAttribute("data-camera-view", "196 56 784 448");
    fireEvent.pointerUp(minimap, { pointerId: 1 });
    await userEvent.click(screen.getByRole("button", { name: "Fit tree" }));
    expect(graph).toHaveAttribute("data-camera-view", "0 0 980 560");
    expect(graph).toHaveAttribute("data-edge-flow-count", "2");
    expect(screen.getByRole("button", { name: "Ancestors" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Descendants" })).toBeVisible();
    expect(screen.getByText(/Focus receipt/)).toBeVisible();
    expect(
      screen.queryByRole("slider", { name: "Recorded time position" }),
    ).toBeNull();
    expect(region.querySelector(".trace-motion")).toBeNull();
    expect(
      screen.getByRole("region", { name: "Span passport" }),
    ).toHaveTextContent("root");
    const passport = screen.getByRole("region", { name: "Span passport" });
    expect(
      passport.querySelector(":scope > .trace-passport-head"),
    ).toHaveTextContent("Span PassportExact focus");
    expect(
      passport.querySelector(":scope > .trace-passport-body"),
    ).not.toBeNull();
    expect(passport.querySelector(".trace-passport-sigil")).toBeVisible();
    expect(screen.queryByText(/service map|architecture/i)).toBeNull();
  });

  it("disables call-edge flow animation when reduced motion is requested", () => {
    render(<TraceTree reducedMotion trace={trace} />);

    const region = screen.getByRole("region", {
      name: "Recorded trace tree",
    });
    expect(region).toHaveAttribute("data-motion", "off");
    expect(screen.getByTestId("trace-tree-canvas")).toHaveAttribute(
      "data-edge-flow-count",
      "0",
    );
  });

  it("derives columns from calls and orders sequential siblings by recorded start", () => {
    const early = {
      ...trace.nodes[1]!,
      id: "early",
      endpoint: { trace_id: "trace-1", span_id: "early" },
      label: "early.call",
      startTimeUnixNano: "1010",
      endTimeUnixNano: "1020",
      startOffsetNano: "10",
      durationNano: "10",
      depth: 99,
    };
    const late = {
      ...early,
      id: "late",
      endpoint: { trace_id: "trace-1", span_id: "late" },
      label: "late.call",
      startTimeUnixNano: "1060",
      endTimeUnixNano: "1070",
      startOffsetNano: "60",
    };
    render(
      <TraceTree
        trace={{
          ...trace,
          nodes: [trace.nodes[0]!, late, early],
          parentEdges: [],
          links: [],
        }}
      />,
    );

    const nodes = screen.getAllByTestId("trace-tree-node");
    const rootNode = nodes.find(
      (node) => node.getAttribute("data-trace-node-id") === "root",
    )!;
    const earlyNode = nodes.find(
      (node) => node.getAttribute("data-trace-node-id") === "early",
    )!;
    const lateNode = nodes.find(
      (node) => node.getAttribute("data-trace-node-id") === "late",
    )!;
    expect(Number(rootNode.getAttribute("data-tree-x"))).toBeLessThan(
      Number(earlyNode.getAttribute("data-tree-x")),
    );
    expect(earlyNode).toHaveAttribute("data-tree-x", "390");
    expect(earlyNode).toHaveAttribute(
      "data-tree-x",
      lateNode.getAttribute("data-tree-x"),
    );
    expect(Number(earlyNode.getAttribute("data-tree-y"))).toBeLessThan(
      Number(lateNode.getAttribute("data-tree-y")),
    );
  });

  it("coalesces large parent-edge geometry without losing the exact relationship count", () => {
    const children = Array.from({ length: 129 }, (_, index) => ({
      ...trace.nodes[1]!,
      id: `child-${index}`,
      endpoint: { trace_id: "trace-1", span_id: `child-${index}` },
      label: `tool.execute.${index}`,
      startTimeUnixNano: String(1001 + index),
      endTimeUnixNano: String(1002 + index),
      durationNano: "1",
      startOffsetNano: String(index + 1),
      parentId: "root",
    }));
    const large: TraceView = {
      ...trace,
      nodes: [trace.nodes[0]!, ...children],
      parentEdges: children.map((node, index) => ({
        ...trace.parentEdges[0]!,
        id: `parent-${index}`,
        from: node.endpoint,
      })),
      links: [],
    };

    const { container } = render(<TraceTree trace={large} />);

    const edges = container.querySelectorAll(
      '[data-relationship="PARENT_EDGE"]',
    );
    expect(edges).toHaveLength(0);
    expect(screen.getByTestId("trace-tree-canvas")).toHaveAttribute(
      "data-parent-edge-count",
      "129",
    );
    expect(
      container.querySelectorAll('[data-render-detail="summary"]'),
    ).toHaveLength(1);
    expect(screen.getAllByTestId("trace-tree-node")).toHaveLength(130);
  });

  it("disables finite recorded-time motion when reduced motion is requested", () => {
    render(<TraceWaterfall reducedMotion trace={trace} />);

    const region = screen.getByRole("region", {
      name: "Recorded trace waterfall",
    });
    expect(region).toHaveAttribute("data-motion", "off");
    expect(region).not.toHaveTextContent(/live/i);
  });

  it("renders bounded recorded statistics without inferring a service map or critical path", () => {
    render(
      <TraceStatistics
        trace={trace}
        viewNavigation={<nav aria-label="Renderer navigation">views</nav>}
      />,
    );

    const region = screen.getByRole("region", {
      name: "Recorded trace statistics",
    });
    expect(screen.getByTestId("trace-statistics")).toBe(region);
    expect(region).toHaveAttribute("data-trace-renderer", "statistics");
    expect(region).toHaveTextContent("Recorded spans2");
    expect(region).toHaveTextContent("Recorded links1");
    expect(region).toHaveTextContent("ERROR spans0");
    expect(region).toHaveTextContent("Maximum recorded duration<1 ms");
    expect(region).not.toHaveTextContent(/\b(?:ns|μs)\b/);
    expect(region).toHaveTextContent("Recorded status inventory");
    expect(region).toHaveTextContent("Recorded kind inventory");
    expect(region).toHaveTextContent("Recorded duration by kind");
    expect(region).toHaveTextContent("Recorded duration distribution");
    expect(region).not.toHaveTextContent(/critical path|service map/i);
    const intro = region.querySelector(":scope > .trace-statistics-intro");
    expect(intro?.querySelector("h2")).toHaveTextContent("Trace Statistics");
    expect(
      intro?.querySelector(":scope > .trace-statistics-summary"),
    ).not.toBeNull();
    expect(
      region.querySelector(":scope > .trace-statistics-summary"),
    ).toBeNull();
    expect(
      screen.getByRole("img", {
        name: "Recorded status inventory donut chart",
      }),
    ).toHaveAttribute("data-chart-type", "donut");
    expect(
      screen.getByRole("img", {
        name: "Recorded kind inventory pie chart",
      }),
    ).toHaveAttribute("data-chart-type", "pie");
    expect(
      screen.getByRole("img", {
        name: "Recorded duration by kind horizontal bar chart",
      }),
    ).toHaveAttribute("data-chart-type", "horizontal-bar");
    expect(
      screen.getByRole("img", {
        name: "Recorded duration distribution vertical bar chart",
      }),
    ).toHaveAttribute("data-chart-type", "vertical-bar");
    expect(
      region.querySelectorAll(
        '.trace-duration-breakdowns [role="img"][data-chart-type="donut"]',
      ),
    ).toHaveLength(1);
    expect(
      region.querySelector(':scope > nav[aria-label="Renderer navigation"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Trace Statistics" }),
    ).toHaveAttribute("data-variant", "h2");
    for (const name of [
      "Recorded status inventory",
      "Recorded kind inventory",
      "Recorded duration by kind",
      "Recorded duration distribution",
    ])
      expect(screen.getByRole("heading", { name })).toHaveAttribute(
        "data-variant",
        "subtitle1",
      );
    expect(
      screen.getByText(
        "Exact inventory and recorded-time aggregates only; no inferred causality.",
      ),
    ).toHaveAttribute("data-variant", "caption");
    expect(screen.getByText("Recorded spans")).toHaveAttribute(
      "data-variant",
      "caption",
    );
    expect(screen.getByText("2", { selector: "dd" })).toHaveAttribute(
      "data-variant",
      "h2",
    );
  });

  it("uses semantic status colors, separated kind colors, and exact cumulative duration rows", () => {
    const categoryTrace: TraceView = {
      ...trace,
      nodes: [
        { ...trace.nodes[0]!, durationNano: "100", status: "OK" },
        {
          ...trace.nodes[1]!,
          durationNano: "40",
          fields: [{ field: "wsr.statistics.topic", value: "Execution" }],
          status: "ERROR",
        },
        {
          ...trace.nodes[1]!,
          id: "unset-child",
          endpoint: { trace_id: "trace-1", span_id: "unset-child" },
          label: "category.unset",
          durationNano: "60",
          fields: [{ field: "wsr.statistics.topic", value: "Cleanup" }],
          status: "UNSET",
        },
      ],
    };

    render(<TraceStatistics trace={categoryTrace} />);

    const statusChart = screen.getByRole("img", {
      name: "Recorded status inventory donut chart",
    });
    expect(
      statusChart.querySelector('[data-category="status-ok"]'),
    ).not.toBeNull();
    expect(
      statusChart.querySelector('[data-category="status-error"]'),
    ).not.toBeNull();
    expect(
      statusChart.querySelector('[data-category="status-unset"]'),
    ).not.toBeNull();

    const kindChart = screen.getByRole("img", {
      name: "Recorded kind inventory pie chart",
    });
    expect(
      kindChart.querySelector('[data-entry-label="INTERNAL"]'),
    ).toHaveAttribute("data-color-index", "0");
    expect(
      kindChart.querySelector('[data-entry-label="CLIENT"]'),
    ).toHaveAttribute("data-color-index", "3");
    const durationByKindChart = screen.getByRole("img", {
      name: "Recorded duration by kind horizontal bar chart",
    });
    expect(
      durationByKindChart.querySelectorAll(".trace-statistics-kind-bar-row"),
    ).toHaveLength(2);
    expect(
      durationByKindChart.querySelector('[data-entry-label="INTERNAL"]'),
    ).toHaveAttribute("data-color-index", "0");
    expect(
      durationByKindChart.querySelector('[data-entry-label="CLIENT"]'),
    ).toHaveAttribute("data-color-index", "3");

    const durationChart = screen.getByRole("img", {
      name: "Recorded duration distribution vertical bar chart",
    });
    expect(
      durationChart.querySelectorAll(".trace-duration-column"),
    ).toHaveLength(3);
    expect(
      [...durationChart.querySelectorAll("[data-topic]")].map((column) =>
        column.getAttribute("data-topic"),
      ),
    ).toEqual(["Execution", "Cleanup"]);
    const breakdowns = [
      screen.getByRole("img", {
        name: "Recorded duration Execution donut chart",
      }),
      screen.getByRole("img", {
        name: "Recorded duration Cleanup donut chart",
      }),
    ];
    expect(breakdowns).toHaveLength(2);
    expect(
      breakdowns.map(
        (breakdown) =>
          breakdown.querySelectorAll(".trace-statistics-donut-segment").length,
      ),
    ).toEqual([1, 1]);
    expect(
      durationChart.querySelectorAll(".trace-duration-column")[0],
    ).toHaveTextContent("<1 msworkflow.run");
    expect(durationChart).not.toHaveTextContent(/\b(?:ns|μs)\b/);
  });

  it("uses one three-line copy and metric typography contract across Trace views", () => {
    const cases = [
      [TraceWaterfall, ["Exact recorded timeline", "workflow.run", "trace-1"]],
      [TraceTree, ["Exact recorded call graph", "workflow.run", "trace-1"]],
      [
        TraceStatistics,
        [
          "Exact recorded inventory",
          "Trace Statistics",
          "Exact inventory and recorded-time aggregates only; no inferred causality.",
        ],
      ],
    ] as const;

    for (const [Renderer, copy] of cases) {
      const { container, unmount } = render(<Renderer trace={trace} />);
      const header = container.querySelector(".trace-view-header")!;
      const headerCopy = header.querySelector(".trace-view-header-copy")!;
      expect(headerCopy).toHaveTextContent(copy.join(""));
      expect(
        [...headerCopy.children].map((item) =>
          item.getAttribute("data-variant"),
        ),
      ).toEqual(["overline", "h2", "caption"]);
      expect(header.querySelector(".trace-view-header-spacer")).not.toBeNull();
      const metrics = header.querySelector(".trace-view-header-metrics")!;
      expect(
        [...metrics.querySelectorAll("dt, small")].every(
          (item) => item.getAttribute("data-variant") === "caption",
        ),
      ).toBe(true);
      expect(
        [...metrics.querySelectorAll("dd, strong")].every(
          (item) => item.getAttribute("data-variant") === "h2",
        ),
      ).toBe(true);
      unmount();
    }
  });

  it("cycles the theme color sequence when statistics outnumber its colors", () => {
    render(
      <TraceStatistics
        trace={{
          ...trace,
          nodes: Array.from({ length: 8 }, (_, index) => ({
            ...trace.nodes[index % trace.nodes.length]!,
            id: `statistics-${index}`,
            endpoint: {
              trace_id: "trace-1",
              span_id: `statistics-${index}`,
            },
            label: `statistics.${index}`,
            fields:
              index === 0
                ? []
                : [
                    {
                      field: "wsr.statistics.topic",
                      value: `Topic ${index}`,
                    },
                  ],
          })),
        }}
      />,
    );

    expect(
      document.querySelectorAll(".trace-duration-column").length,
    ).toBeLessThanOrEqual(5);
    expect(
      [
        ...document.querySelectorAll(
          ".trace-duration-breakdowns .trace-statistics-donut-segment",
        ),
      ].map((item) => item.getAttribute("data-color-index")),
    ).toEqual(expect.arrayContaining(["0", "0", "1", "2", "3", "4", "5"]));
    expect(
      document.querySelectorAll(
        '.trace-duration-breakdown[data-topic="Other"]',
      ),
    ).toHaveLength(1);
    expect(
      document.querySelectorAll(
        ".trace-statistics-value.trace-statistics-color[data-color-index]",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("places Host renderer navigation in the same top-level region for every Trace renderer", () => {
    const navigation = <nav aria-label="Renderer navigation">views</nav>;

    for (const Renderer of [TraceWaterfall, TraceTree, TraceStatistics]) {
      const { unmount } = render(
        <Renderer trace={trace} viewNavigation={navigation} />,
      );
      const region = screen.getByLabelText(
        /Recorded trace (waterfall|tree|statistics)/i,
      );
      expect(
        region.querySelector(':scope > nav[aria-label="Renderer navigation"]'),
      ).not.toBeNull();
      expect(
        region.querySelector(
          '.trace-view-tools nav[aria-label="Renderer navigation"]',
        ),
      ).toBeNull();
      unmount();
    }
  });

  it("applies deterministic ancestor and descendant lenses without changing recorded relationships", async () => {
    render(<TraceTree trace={trace} />);

    await userEvent.click(
      screen.getByRole("treeitem", { name: /tool.execute/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Ancestors" }));
    expect(
      screen.getByText(/Ancestors receipt · 2 exact Span identities/),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Recorded trace tree" }),
    ).toHaveAttribute("data-lens", "ancestors");

    await userEvent.click(screen.getByRole("button", { name: "Descendants" }));
    expect(
      screen.getByText(/Descendants receipt · 1 exact Span identity/),
    ).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Recorded trace tree" }),
    ).toHaveAttribute("data-lens", "descendants");
  });
});
