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
    expect(waterfall).toHaveAttribute("data-motion", "finite-recorded-time");
    expect(waterfall).toHaveAttribute("data-trace-renderer", "waterfall");
    expect(screen.getAllByText("100 ns").length).toBeGreaterThan(0);
    expect(screen.getByText("Duration")).toBeVisible();
    expect(screen.getByText("Start")).toBeVisible();
    expect(screen.getByText("Spans")).toBeVisible();
    expect(screen.getByText("Errors")).toBeVisible();
    expect(
      screen.getByText("Errors").closest(".trace-summary-stat"),
    ).toHaveAttribute("data-tone", "success");
    expect(screen.getByText("trace-1", { selector: "code" })).toBeVisible();
    expect(screen.queryByText(/shared recorded-time domain/i)).toBeNull();
    expect(
      screen.getByRole("region", { name: "Recorded trace minimap" }),
    ).toBeVisible();
    expect(
      screen.getByRole("tree", { name: "Recorded waterfall span outline" }),
    ).toBeVisible();
    expect(
      screen.getByRole("slider", { name: "Recorded time position" }),
    ).toHaveAttribute("aria-valuemax", "100");
    expect(
      screen.getByRole("region", { name: "Span passport" }),
    ).toHaveTextContent("root");

    await userEvent.click(
      screen.getByRole("button", { name: /tool.execute/i }),
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
    expect(screen.getByText("0 ns")).toBeVisible();
    expect(screen.getByText("25 ns")).toBeVisible();
    expect(screen.getByText("50 ns")).toBeVisible();
    expect(screen.getByText("75 ns")).toBeVisible();
    expect(screen.getAllByText("100 ns").length).toBeGreaterThan(0);

    await userEvent.click(
      screen.getByRole("button", { name: "Collapse workflow.run descendants" }),
    );
    expect(screen.queryByRole("button", { name: /tool.execute/i })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Expand all spans" }),
    );
    expect(screen.getByRole("button", { name: /tool.execute/i })).toBeVisible();

    const minimap = screen.getByRole("slider", {
      name: "Trace minimap zoom window",
    });
    expect(container.querySelector(".trace-minimap-window")).toHaveAttribute(
      "data-full",
      "true",
    );
    expect(
      container.querySelector(
        '[data-timeline-span-id="root"] .trace-indent-spacer',
      ),
    ).toHaveAttribute("data-indent-depth", "1");
    expect(
      container.querySelector(
        '[data-timeline-span-id="child"] .trace-indent-spacer',
      ),
    ).toHaveAttribute("data-indent-depth", "2");
    expect(container.querySelectorAll(".trace-indent-segment")).toHaveLength(2);
    expect(
      container.querySelector('.trace-indent-segment[data-guide-depth="0"]'),
    ).toHaveStyle({ gridRow: "1 / 3" });
    expect(
      container.querySelector('.trace-indent-segment[data-guide-depth="1"]'),
    ).toHaveStyle({ gridRow: "2 / 3" });
    expect(container.querySelector(".trace-timeline-grid")).toBeInTheDocument();
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
    expect(container.querySelector(".trace-minimap-window")).toHaveStyle({
      insetInlineStart: "25%",
      width: "50%",
    });
    expect(
      container.querySelector(
        '[data-timeline-span-id="child"] .trace-timeline-bar',
      ),
    ).toHaveStyle({ insetInlineStart: "0%", width: "30%" });

    fireEvent.pointerDown(minimap, { clientX: 50, pointerId: 2 });
    fireEvent.pointerMove(minimap, { clientX: 75, pointerId: 2 });
    fireEvent.pointerUp(minimap, { clientX: 75, pointerId: 2 });
    expect(
      container.querySelector(
        '[data-timeline-span-id="child"] .trace-timeline-bar',
      ),
    ).toHaveStyle({ display: "none" });
  });

  it("renders a call tree, keeping recorded LINK edges distinct", () => {
    render(<TraceTree trace={trace} />);

    const region = screen.getByRole("region", {
      name: "Recorded trace tree",
    });
    expect(region).toHaveAttribute("data-trace-renderer", "tree");
    const tree = screen.getByRole("tree", { name: "Recorded trace call tree" });
    expect(tree).toHaveTextContent("workflow.run");
    expect(tree).toHaveTextContent("tool.execute");
    expect(screen.getByText("Recorded LINK → trace-2:remote")).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Recorded span call tree graph" }),
    ).toBeVisible();
    expect(
      region.querySelectorAll('[data-relationship="PARENT_EDGE"]'),
    ).toHaveLength(1);
    expect(region.querySelectorAll('[data-relationship="LINK"]')).toHaveLength(
      1,
    );
    expect(
      screen.getByRole("region", { name: "Semantic camera map" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Fit tree" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Ancestors" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Descendants" })).toBeVisible();
    expect(screen.getByText(/Focus receipt/)).toBeVisible();
    expect(
      screen.getByRole("slider", { name: "Recorded time position" }),
    ).toBeVisible();
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
    expect(edges).toHaveLength(1);
    expect(edges[0]).toHaveAttribute("data-relationship-count", "129");
    expect(
      container.querySelectorAll('[data-render-detail="summary"]'),
    ).toHaveLength(130);
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
    expect(region).toHaveAttribute("data-trace-renderer", "statistics");
    expect(region).toHaveTextContent("Recorded spans2");
    expect(region).toHaveTextContent("Recorded links1");
    expect(region).toHaveTextContent("ERROR spans0");
    expect(region).toHaveTextContent("Maximum recorded duration100 ns");
    expect(region).toHaveTextContent("Recorded status inventory");
    expect(region).toHaveTextContent("Recorded kind inventory");
    expect(region).toHaveTextContent("Recorded duration distribution");
    expect(region).not.toHaveTextContent(/critical path|service map/i);
    expect(
      region.querySelector(':scope > nav[aria-label="Renderer navigation"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Trace statistics" }),
    ).toHaveAttribute("data-variant", "sectionTitle");
    expect(
      screen.getByText(
        "Exact inventory and recorded-time aggregates only; no inferred causality.",
      ),
    ).toHaveAttribute("data-variant", "caption");
    expect(screen.getByText("Recorded spans")).toHaveAttribute(
      "data-variant",
      "label",
    );
    expect(screen.getByText("2", { selector: "dd" })).toHaveAttribute(
      "data-variant",
      "value",
    );
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
